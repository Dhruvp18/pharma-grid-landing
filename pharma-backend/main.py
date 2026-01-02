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

# API Keys
GEMINI_API_KEY = os.getenv("VITE_GEMINI_API_KEY")
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

if not GEMINI_API_KEY or not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("WARNING: Missing API Keys in .env")

# Initialize Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-flash-latest')

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

# 1. Generate QR Code (Called by Owner)
# 1. Generate QR Code (Called by Owner)
@app.post("/generate-handover")
async def generate_handover(payload: dict = Body(...)):
    # payload expects {"bookingId": ...}
    booking_id = payload.get("bookingId")
    if not booking_id:
        raise HTTPException(status_code=400, detail="Missing bookingId")

    try:
        # Create a 6-digit random code
        secret_code = str(random.randint(100000, 999999))

        # Save to DB
        response = supabase.table("bookings").update({"handover_code": secret_code}).eq("id", booking_id).execute()
        
        # --- CRITICAL FIX START ---
        # Supabase returns the updated rows in response.data. 
        # If this list is empty, it means the Booking ID does not exist in the DB.
        if not response.data:
            raise HTTPException(status_code=404, detail="Booking ID not found")
        # --- CRITICAL FIX END ---
        
        print(f"🔐 Generated Code for Booking {booking_id}: {secret_code}")
        return {"qrData": secret_code}

    except HTTPException as he:
        # Allow the 404 or 400 errors to pass through to the client
        raise he
    except Exception as e:
        # Catch unexpected server errors
        print(f"Error generating handover: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# 2. Scan QR Code (Called by Renter)
@app.post("/scan-handover")
async def scan_handover(payload: dict = Body(...)):
    booking_id = payload.get("bookingId")
    scanned_code = payload.get("scannedCode")

    if not booking_id:
         raise HTTPException(status_code=400, detail="Missing bookingId")

    try:
        # Fetch real code
        response = supabase.table("bookings").select("handover_code").eq("id", booking_id).execute()
        
        # response.data is a list of dicts
        if not response.data:
            return JSONResponse(status_code=404, content={"error": "Booking not found"})
        
        booking = response.data[0]
        
        # Validate
        if str(booking.get("handover_code")) == str(scanned_code):
            # SUCCESS: Update status
            supabase.table("bookings").update({
                "status": "in_use", 
                "handover_code": None
            }).eq("id", booking_id).execute()

            print(f"🔓 Handover Successful for Booking {booking_id}")
            return {"success": True, "message": "Handover Complete!"}
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
    reason: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[])
):
    print(f"📝 Creating Item in 'items' table: {title} @ ({lat}, {lng})")
    
    try:
        # 1. Get a valid Owner ID (Demo Hack)
        # Since we don't have auth on the frontend yet, we pick the first user from 'profiles'
        user_response = supabase.table("profiles").select("id").limit(1).execute()
        
        owner_id = None
        if user_response.data and len(user_response.data) > 0:
            owner_id = user_response.data[0]['id']
        else:
            # If no users exist, we can't insert due to FK constraint.
            # We will try to insert a dummy profile if allowed, or just fail with a clear message.
            raise HTTPException(status_code=400, detail="No users found in 'profiles' table. Cannot assign owner.")

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
            "is_available": True
        }

        # 3. Insert
        response = supabase.table("items").insert(item_data).execute()
        
        if not response.data:
             raise HTTPException(status_code=500, detail="Failed to create item in Database")

        print(f"✅ Item Created ID: {response.data[0].get('id')}")
        return {"success": True, "item": response.data[0]}

    except Exception as e:
        print(f"❌ Error creating item: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


if __name__ == "__main__":
    import uvicorn
    # Emulate the PORT logic
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
