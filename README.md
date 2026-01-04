# Pharma Grid 🏥

Pharma Grid is a comprehensive platform designed to bridge the gap between medical equipment owners and those in need. It facilitates the rental, sale, and verified exchange of medical devices, ensuring safety and trust through AI-powered auditing and secure logistics.

## 🌟 Product Overview

Pharma Grid solves the challenge of finding reliable, affordable medical equipment by creating a localized marketplace. Whether it's a hospital bed, an oxygen concentrator, or a simple wheelchair, Pharma Grid allows users to:
- **Discover** equipment nearby using an interactive map.
- **Rent or Buy** devices with transparent pricing.
- **Verify** quality via AI-driven image and video audits.
- **Secure** transactions with QR-code based handovers.
- **Consult** an AI Medical Companion for device usage and general health queries.

## 🚀 Key Features

### 🔍 Discovery & Marketplace
- **Interactive Map**: Visualize available equipment in your vicinity using TomTom maps integration.
- **Detailed Listings**: View comprehensive item details, including specifications, pricing, and availability.
- **Advanced Search**: Filter by equipment type, hospital name, or specific requirements.

### 🛡️ AI Safety Ecosystem
- **Universal Medical Auditor**: Automatically identifies medical devices from uploaded photos and performs a dynamic safety check (e.g., checking for frayed wires in electronics or worn rubber in mobility aids).
- **Return Item Auditor**: Compares "Return" photos against "Original" listing photos to detect new damages and suggest fair deposit deductions.
- **Video Analysis**: (Beta) Analyzes video feeds for operational flaws like wobbling wheels or strange noises.

### 🔐 Secure Logistics
- **QR Handover System**: Generates secure 6-digit codes for both pickup and return handovers to ensure physical item transfer before status updates.
- **Booking Management**: Track rental durations, overdue penalties, and completion statuses.

### 🤖 Smart Assistance
- **AI Medical Companion**: A built-in chat widget powered by Google Gemini to answer questions about device usage, medical terms, or general health advice.

### 👤 User Features
- **Public Profiles**: Build trust with verified profiles and aggregated user ratings.
- **Review System**: Leave feedback for items and owners to help the community make informed decisions.
- **Dashboard**: Manage your listings, bookings, and return requests in one place.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Shadcn UI, Radix UI
- **Maps**: TomTom International Web SDK
- **State Management**: React Query (@tanstack/react-query)
- **Forms**: React Hook Form + Zod
- **Routing**: React Router DOM v6
- **Icons**: Lucide React

### Backend (`pharma-backend`)
- **Framework**: FastAPI (Python)
- **AI**: Google Gemini (via `google-generativeai`), Agno Agent Framework
- **Database**: Supabase (PostgreSQL)
- **Server**: Uvicorn

## 📦 Installation & Setup

### Prerequisites
- Node.js & npm
- Python 3.8+
- Supabase Account (for Database & Auth)
- Google Gemini API Key
- TomTom Developer Key

### 1. Clone the Repository
```bash
git clone <repository-url>
cd pharma-grid-landing
```

### 2. Frontend Setup
Navigate to the root directory and install dependencies:
```bash
npm install
```

Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TOMTOM_API_KEY=your_tomtom_api_key
```

Run the development server:
```bash
npm run dev
```

### 3. Backend Setup
Navigate to the backend directory:
```bash
cd pharma-backend
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Ensure your `.env` file (in the project root) also contains backend keys:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (Optional, for admin tasks)
```

Run the backend server:
```bash
# Using Python directly
python main.py

# OR using Uvicorn
uvicorn main:app --reload --port 3000
```

## 🧪 Usage Flow
1.  **Register/Login**: Sign up using your email via Supabase Auth.
2.  **List an Item**: Go to "List Device", upload photos (which are auto-audited by AI), and set your price.
3.  **Rent**: Browse the map, select an item, and request a booking.
4.  **Pickup**: Meet the owner. The owner scans your "Pickup QR Code" to start the rental.
5.  **Return**: Meet the owner again. Upload return photos for AI damage check. The owner scans your "Return QR Code" to complete the transaction.

## Contributors

- [Dhruv Panchal](https://github.com/Dhruvp18)
- [Viraj Vora](https://github.com/viraj200524)
