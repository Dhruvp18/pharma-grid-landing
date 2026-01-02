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
load_dotenv()

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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

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
        
        # Check for error is implicit in python client usually, creates exception on request failure if configured
        # But supabase-py returns a response object.
        # If response.data is empty and it should have updated, maybe check that.
        # But simplistic parity:
        
        print(f"🔐 Generated Code for Booking {booking_id}: {secret_code}")
        return {"qrData": secret_code}

    except Exception as e:
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

if __name__ == "__main__":
    import uvicorn
    # Emulate the PORT logic
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
