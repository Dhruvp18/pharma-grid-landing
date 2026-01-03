import os
import json
import random
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
import base64

# --- CONFIGURATION ---
from pathlib import Path
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# Input Size Limit is handled by web server (e.g. Nginx, or Uvicorn). 
# FastAPI defers this to the ASGI server. Uvicorn default is fine for normal use, 
# but for 50MB uploads we might rely on default behavior which doesn't strictly impose 
# limits unless configured.

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

safety_config = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

# API Keys
GEMINI_API_KEY = os.getenv("VITE_GEMINI_API_KEY")
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")

if not GEMINI_API_KEY or not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("WARNING: Missing API Keys in .env")

# Initialize Clients
# Use Service Role Key for backend administration (Bypasses RLS) if available
supabase_key = SUPABASE_SERVICE_ROLE_KEY if SUPABASE_SERVICE_ROLE_KEY else SUPABASE_ANON_KEY
if not SUPABASE_SERVICE_ROLE_KEY:
    print("⚠️ WARNING: Using Anon Key. Functionality like Storage Uploads may fail due to RLS.")
else:
    print("🔐 Using Service Role Key (Admin Access)")

supabase: Client = create_client(SUPABASE_URL, supabase_key)
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-flash-latest', safety_settings=safety_config)

# --- Agno Agent ---
from medical_agent import get_agent_response

# --- HELPER: Call Gemini API ---
# We use a helper to keep the endpoints clean, mimicking the Node structure
async def call_gemini(prompt_text: str, file_parts: list):
    try:
        # Construct content for Gemini
        # file_parts format expected: [{"mime_type": "...", "data": b64_bytes}] 
        # But google-generativeai lib usage is usually: [prompt, image1, image2...]
        # Here we will adapt to the library's preferred input format.
        
        contents = [prompt_text]
        for part in file_parts:
            # part is {"mime_type": ..., "data": ...} (base64 string)
            # The python lib 'generate_content' accepts a list where items can be 
            # simple dicts for blobs: {'mime_type': '...', 'data': b'...'} 
            # Note: 'data' requires items to be raw bytes, not base64 string if using the dict format directly 
            # OR we can just pass the same structure if we construct the Request object manually.
            # However, easier way with this lib is:
            contents.append({
                "mime_type": part["mime_type"],
                "data": base64.b64decode(part["data"])
            })

        response = model.generate_content(contents)
        
        if not response.text:
             raise Exception("Empty response from Gemini")
             
        # Parse JSON from Markdown
        raw_text = response.text
        json_string = raw_text.replace("```json", "").replace("```", "").strip()
        return json.loads(json_string)

    except Exception as e:
        print(f"Gemini Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
#  FEATURE 1: UNIVERSAL MEDICAL AUDITOR (Multi-Image)
# ==========================================
@app.post("/audit-item")
async def audit_item(images: List[UploadFile] = File(...)):
    if len(images) < 2:
        return JSONResponse(
            status_code=400,
            content={"error": "Please upload at least 2 images (different angles) to verify safety."}
        )

    print(f"🕵️ Auditing {len(images)} images...")

    try:
        # 1. Prepare Images for Gemini
        file_parts = []
        for file in images:
            content = await file.read()
            file_parts.append({
                "mime_type": file.content_type,
                "data": base64.b64encode(content).decode('utf-8') 
            })

        # 2. The Universal Prompt
        prompt_text = """
          You are an expert AI Biomedical Engineer and Safety Inspector.
          Analyze these photos of a pre-owned item being listed for rental/sale.

          --- PHASE 1: IDENTIFICATION ---
          Identify the item. 
          - Is it a recognizable medical device, healthcare aid, or pharmaceutical product? 
          - (Examples: BP Monitor, Glucometer, CPAP, Nebulizer, Walker, Hospital Bed, Smart Watch with Health features, Pills, Syrups etc.)
          - If it is NOT medical (e.g., a toaster, a toy, a gaming console), REJECT it immediately.

          --- PHASE 2: DYNAMIC SAFETY CHECK ---
          Based on the item identified, check for its specific failure points:
          
          A. ELECTRONICS (BP Monitors, Thermometers, Oximeters):
             - Is the screen cracked or "bleeding" pixels?
             - Are battery compartments clean (no white acid corrosion)?
             - Are wires/cuffs frayed or peeling?
          
          B. MECHANICAL / MOBILITY (Walkers, Crutches, Wheelchairs):
             - Are rubber tips/feet worn out?
             - Is there rust on joints?
             - Are brakes functional (if visible)?
             - Is it shown in BOTH open and folded states? (If applicable)
          
          C. STERILE/CONSUMABLES (Pills, Test Strips, Syrups):
             - Is the Factory Seal intact?
             - Is the Expiry Date visible and future-dated?
             - Is the box crushed or water-damaged?

          --- PHASE 3: VERDICT ---
          Return strictly valid JSON:
          {
            "status": "verified" | "rejected" | "needs_more_info",
            "item_identified": "string (The specific name, e.g., 'Omron BP Monitor')",
            "safety_score": number (1-10, where 10 is factory new),
            "flaws_found": ["string", "string"], 
            "reason": "string (Professional assessment)",
            "missing_evidence": "string" (If you cannot see the Screen, or the Cuff, or the Expiry Date, ask for it specifically.)
          }
        """

        # 3. Get Verdict
        result = await call_gemini(prompt_text, file_parts)
        
        print("✅ Audit Verdict:", result)
        return result

    except Exception as e:
        print("Audit Error:", e)
        # In case of error, we can return 500
        return JSONResponse(status_code=500, content={"error": "Audit Failed"})


# ==========================================
#  FEATURE 2: VIDEO AUDITOR (Optional/Bonus)
# ==========================================
@app.post("/analyze-video")
async def analyze_video(video: UploadFile = File(...)):
    print("🎥 Analyzing Video...")
    try:
        content = await video.read()
        file_part = [{
            "mime_type": video.content_type,
            "data": base64.b64encode(content).decode('utf-8')
        }]

        prompt_text = """
          You are a Safety Officer. Watch this video of a medical item.
          1. IDENTIFY: What item is this?
          2. FLAW CHECK: Look for wobbling wheels, rust, broken seals, or strange noises.
          
          Return JSON:
          {
            "is_medical": boolean,
            "is_safe": boolean,
            "item_name": "string",
            "flaws": ["string"], 
            "summary": "string"
          }
        """

        result = await call_gemini(prompt_text, file_part)
        print("✅ Video Verdict:", result)
        return result

    except Exception as e:
        print("Video Error:", e)
        return JSONResponse(status_code=500, content={"error": "Video Analysis Failed"})


# ==========================================
#  FEATURE 3: QR HANDOVER LOGIC (Supabase)
# ==========================================

# 1. Generate QR Code (Called by Owner or Renter depending on flow)
@app.post("/generate-handover")
async def generate_handover(payload: dict = Body(...)):
    # payload expects {"bookingId": ..., "handoverType": "pickup" | "return"}
    booking_id = payload.get("bookingId")
    handover_type = payload.get("handoverType", "pickup") # Default to pickup for backward capability

    if not booking_id:
        raise HTTPException(status_code=400, detail="Missing bookingId")

    try:
        # Create a 6-digit random code
        secret_code = str(random.randint(100000, 999999))

        # Save to DB
        response = supabase.table("bookings").update({
            "handover_code": secret_code,
            # We might want to track what THIS code is for, but assuming single active code is enough
        }).eq("id", booking_id).execute()
        
        # Check if booking exists
        if not response.data:
            raise HTTPException(status_code=404, detail="Booking ID not found")
        
        print(f"🔐 Generated {handover_type.upper()} Code for Booking {booking_id}: {secret_code}")
        return {"qrData": secret_code}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error generating handover: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# 2. Scan QR Code (Called by Renter or Owner depending on flow)
@app.post("/scan-handover")
async def scan_handover(payload: dict = Body(...)):
    booking_id = payload.get("bookingId")
    scanned_code = payload.get("scannedCode")
    handover_type = payload.get("handoverType", "pickup")

    if not booking_id:
         raise HTTPException(status_code=400, detail="Missing bookingId")

    try:
        # Fetch real code and item_id (needed for return to free up item)
        response = supabase.table("bookings").select("handover_code, item_id").eq("id", booking_id).execute()
        
        if not response.data:
            return JSONResponse(status_code=404, content={"error": "Booking not found"})
        
        booking = response.data[0]
        
        # Validate
        if str(booking.get("handover_code")) == str(scanned_code):
            
            updates = {"handover_code": None}
            
            if handover_type == 'pickup':
                updates["status"] = "in_use"
                message = "Rental Started! Handover Complete."
            
            elif handover_type == 'return':
                updates["status"] = "completed"
                # Make item available again
                supabase.table("items").update({"is_available": True}).eq("id", booking["item_id"]).execute()
                message = "Return Successful! Item is now available."
            
            # Update Booking
            supabase.table("bookings").update(updates).eq("id", booking_id).execute()

            print(f"🔓 {handover_type.upper()} Handover Successful for Booking {booking_id}")
            return {"success": True, "message": message}
        else:
            return JSONResponse(
                status_code=400, 
                content={"success": False, "message": "Invalid QR Code"}
            )

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ==========================================
#  FEATURE 4: CREATE LISTING (Supabase)
# ==========================================
@app.post("/create-listing")
async def create_listing(
    title: str = Form(...),
    category: str = Form(...),
    description: str = Form(...),
    price: str = Form(...),
    location: str = Form(...),
    lat: Optional[str] = Form(None),
    lng: Optional[str] = Form(None),
    verified: bool = Form(...),
    safety_score: int = Form(...),
    owner_id: str = Form(...),
    contact_email: Optional[str] = Form(None),
    contact_phone: Optional[str] = Form(None),
    user_email: Optional[str] = Form(None),
    user_name: Optional[str] = Form(None),
    reason: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[])
):
    print(f"📝 Creating Item in 'items' table: {title} @ ({lat}, {lng}) Owner: {owner_id}")
    
    try:
        # 1. Owner ID is now passed from Frontend (Supabase Auth ID)
        if not owner_id:
            raise HTTPException(status_code=400, detail="Missing owner_id")

        # --- FIX: Ensure Profile Exists (Foreign Key Constraint) ---
        # The public.profiles table might not have this user if no trigger is set up.
        # We manually upsert the profile to valid the FK in 'items'.
        if user_email: # Only try to sync profile if we have data
            try:
                profile_data = {
                    "id": owner_id,
                    # "email": user_email, # REMOVED: Schema does not have email column
                    # "full_name": user_name or "User", 
                }
                
                # Using upsert is safer
                supabase.table("profiles").upsert(profile_data).execute()
                print(f"👤 Profile synced for {owner_id}")
            except Exception as pe:
                print(f"⚠️ Warning syncing profile: {pe}")
                # We continue, hoping the profile exists or the error was benign.
                # If strictly FK fails, the next step will catch it.

        # 2. Prepare Data for 'items' schema
        ai_status = "verified" if verified else "pending"
        ai_full_reason = f"Score: {safety_score}/10. {reason or ''}"
        
        # Image Handling: Use a placeholder since we don't have storage buckets set up 
        # and 'items' expects a single 'image_url' text field.
        # In a real app, we would upload the file to Supabase Storage and get the URL.
        final_image_url = "https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&auto=format&fit=crop"

        item_data = {
            "owner_id": owner_id,
            "title": title,
            "category": category,
            "description": description,
            "price_per_day": float(price) if price else 0,
            "address_text": location,
            "lat": float(lat) if lat else None,
            "lng": float(lng) if lng else None,
            "image_url": final_image_url,
            "ai_status": ai_status,
            "ai_reason": ai_full_reason,
            "ai_reason": ai_full_reason,
            "is_available": True,
            # We try to save contact info if columns exist
            # Note: User reported DB columns have typos: 'contect_email' and 'contect_phone'
            "contact_email": contact_email,
            "contact_phone": contact_phone,
            "images": []
        }

        # 3. Insert
        # If schema is missing columns, we might need to be dynamic, but FastAPI/Pydantic/Supabase usually want strictness.
        # We'll proceed assuming columns exist as per user request.
        response = supabase.table("items").insert(item_data).execute()
        
        if not response.data:
             raise HTTPException(status_code=500, detail="Failed to create item in Database")

        new_item = response.data[0]
        new_item_id = new_item.get('id')
        print(f"✅ DB Item Created: {new_item_id}")

        # 4. Upload Images to Supabase Storage (device-images bucket)
        uploaded_image_url = None
        all_image_urls = []
        
        if images:
            print(f"📤 Uploading {len(images)} images for item {new_item_id}...")
            try:
                for idx, file in enumerate(images):
                    # Reset file cursor just in case it was read before
                    await file.seek(0)
                    file_content = await file.read()
                    
                    # Naming: {item_id}/{original_filename}
                    file_path = f"{new_item_id}/{file.filename}"
                    
                    # Upload to Supabase Storage
                    storage_res = supabase.storage.from_("device-images").upload(
                        path=file_path,
                        file=file_content,
                        file_options={"content-type": file.content_type, "x-upsert": "true"}
                    )
                    
                    # Get Public URL
                    public_url_resp = supabase.storage.from_("device-images").get_public_url(file_path)
                    
                    # Add to list
                    all_image_urls.append(public_url_resp)

                    if idx == 0:
                        uploaded_image_url = public_url_resp
            
            except Exception as storage_err:
                print(f"⚠️ Storage Upload Error: {storage_err}")
                # We proceed without failing
        
        # 5. Update 'image_url' and 'images' array in DB
        if uploaded_image_url:
            print(f"🖼️ Updating Item Image URLs...")
            update_payload = {
                "image_url": uploaded_image_url,
                "images": all_image_urls 
            }
            supabase.table("items").update(update_payload).eq("id", new_item_id).execute()
            new_item['image_url'] = uploaded_image_url
            new_item['images'] = all_image_urls

        print(f"✅ Listing Complete ID: {new_item_id}")
        return {"success": True, "item": new_item}

    except Exception as e:
        print(f"❌ Error creating item: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# ==========================================
#  FEATURE 5: REVIEWS & RATINGS (Supabase)
# ==========================================

@app.post("/reviews")
async def create_review(
    booking_id: str = Body(...),
    rating: int = Body(...),
    comment: str = Body(...),
    reviewer_id: str = Body(...)
):
    try:
        # 1. Verify Booking exists
        booking_res = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not booking_res.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        booking = booking_res.data[0]
        
        # 2. Extract item_id and owner_id from booking
        item_id = booking.get("item_id")
        owner_id = booking.get("owner_id")
        
        # 3. Insert Review
        data = {
            "booking_id": booking_id,
            "reviewer_id": reviewer_id,
            "rating": rating,
            "comment": comment,
            "item_id": item_id,
            "owner_id": owner_id
        }
        
        res = supabase.table("reviews").insert(data).execute()
        
        if not res.data:
             raise HTTPException(status_code=500, detail="Failed to save review")
             
        return {"success": True, "review": res.data[0]}

    except Exception as e:
        print(f"Review Error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/reviews/item/{item_id}")
async def get_item_reviews(item_id: str):
    try:
        # Fetch reviews with reviewer details
        # Note: Supabase-py syntax for foreign table join is usually select("*, profiles(*)")
        # Assuming foreign keys are set up correctly: reviews.reviewer_id -> profiles.id
        res = supabase.table("reviews").select("*, profiles:reviewer_id(full_name, avatar_url)").eq("item_id", item_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"Get Item Reviews Error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/reviews/owner/{owner_id}")
async def get_owner_reviews(owner_id: str):
    try:
        # Fetch reviews for all items owned by this user
        res = supabase.table("reviews").select("*, profiles:reviewer_id(full_name, avatar_url), items(title)").eq("owner_id", owner_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"Get Owner Reviews Error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/profile/{user_id}")
async def get_public_profile(user_id: str):
    try:
        # 1. Get Profile Info
        profile_res = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if not profile_res.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        profile = profile_res.data
        
        # 2. Get Aggregated Rating
        # Supabase-py doesn't have easy AVG helper yet without stored procedure/RPC. 
        # We will fetch all ratings (lightweight) and calc avg in python for now, or use RPC if user prefers.
        # Python approach is easier for prototype.
        reviews_res = supabase.table("reviews").select("rating").eq("owner_id", user_id).execute()
        
        ratings = [r['rating'] for r in reviews_res.data]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
        
        return {
            "profile": profile,
            "rating": round(avg_rating, 1),
            "total_reviews": len(ratings)
        }
        
    except Exception as e:
         print(f"Profile Error: {e}")
         return JSONResponse(status_code=500, content={"error": str(e)})


# ==========================================
#  FEATURE 7: AI COMPANION & MEDICAL AGENT
# ==========================================
@app.post("/chat-ai")
async def chat_ai(payload: dict = Body(...)):
    message = payload.get("message")
    context = payload.get("context", {}) # Optional: {device_name, category, ...}
    
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    print(f"🤖 AI Chat Query: {message} | Context: {context.get('device_name', 'None')}")
    
    try:
        # Delegate to Agno Agent
        response = get_agent_response(message, context)
        return {"response": response}

    except Exception as e:
        print(f"AI Agent Error: {e}")
        return JSONResponse(status_code=500, content={"error": "AI Service Unavailable"})


if __name__ == "__main__":
    import uvicorn
    # Emulate the PORT logic
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
