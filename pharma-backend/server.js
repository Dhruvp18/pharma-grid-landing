require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

// --- CONFIGURATION ---
app.use(cors());
// Increased limit to 50mb to allow for high-res images and short videos
app.use(express.json({ limit: '50mb' }));

// Setup Multer for temporary file storage
const upload = multer({ dest: 'uploads/' });

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- HELPER: Call Gemini API ---
// We use a helper to keep the endpoints clean
async function callGemini(promptText, fileParts) {
  const requestBody = {
    contents: [{
      parts: [
        { text: promptText },
        ...fileParts
      ]
    }]
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  // Parse Markdown JSON
  const rawText = data.candidates[0].content.parts[0].text;
  const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
}


// ==========================================
//  FEATURE 1: UNIVERSAL MEDICAL AUDITOR (Multi-Image)
// ==========================================
app.post('/audit-item', upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: "Please upload at least 2 images (different angles) to verify safety." });
    }

    console.log(`🕵️ Auditing ${req.files.length} images...`);

    // 1. Prepare Images for Gemini
    const fileParts = req.files.map(file => {
      const buffer = fs.readFileSync(file.path);
      return {
        inline_data: {
          mime_type: file.mimetype,
          data: buffer.toString('base64')
        }
      };
    });

    // 2. The Universal Prompt
    const promptText = `
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
    `;

    // 3. Get Verdict
    const result = await callGemini(promptText, fileParts);

    // 4. Cleanup Files
    req.files.forEach(file => fs.unlinkSync(file.path));

    console.log("✅ Audit Verdict:", result);
    res.json(result);

  } catch (error) {
    // Cleanup on error too
    if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
    console.error("Audit Error:", error);
    res.status(500).json({ error: "Audit Failed" });
  }
});


// ==========================================
//  FEATURE 2: VIDEO AUDITOR (Optional/Bonus)
// ==========================================
app.post('/analyze-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No video uploaded" });
    
    console.log("🎥 Analyzing Video...");

    const buffer = fs.readFileSync(req.file.path);
    const filePart = [{
      inline_data: {
        mime_type: req.file.mimetype,
        data: buffer.toString('base64')
      }
    }];

    const promptText = `
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
    `;

    const result = await callGemini(promptText, filePart);
    fs.unlinkSync(req.file.path); // Cleanup
    
    console.log("✅ Video Verdict:", result);
    res.json(result);

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("Video Error:", error);
    res.status(500).json({ error: "Video Analysis Failed" });
  }
});


// ==========================================
//  FEATURE 3: QR HANDOVER LOGIC (Supabase)
// ==========================================

// 1. Generate QR Code (Called by Owner)
app.post('/generate-handover', async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    // Create a 6-digit random code
    const secretCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save to DB
    const { error } = await supabase
      .from('bookings')
      .update({ handover_code: secretCode })
      .eq('id', bookingId);
      
    if (error) throw error;
    
    console.log(`🔐 Generated Code for Booking ${bookingId}: ${secretCode}`);
    res.json({ qrData: secretCode });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Scan QR Code (Called by Renter)
app.post('/scan-handover', async (req, res) => {
  try {
    const { bookingId, scannedCode } = req.body;
    
    // Fetch real code
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('handover_code')
      .eq('id', bookingId)
      .single();
      
    if (error || !booking) return res.status(404).json({ error: "Booking not found" });
    
    // Validate
    if (booking.handover_code === scannedCode) {
      // SUCCESS: Update status
      await supabase
        .from('bookings')
        .update({ status: 'in_use', handover_code: null }) // Clear code
        .eq('id', bookingId);
        
      console.log(`🔓 Handover Successful for Booking ${bookingId}`);
      res.json({ success: true, message: "Handover Complete!" });
    } else {
      res.status(400).json({ success: false, message: "Invalid QR Code" });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- START SERVER ---
app.listen(PORT, () => console.log(`🚀 Pharma-Grid Backend running on port ${PORT}`));