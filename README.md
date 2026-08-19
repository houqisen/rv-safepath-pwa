# 🚐 RV SafePath — Smart RV Copilot, Safe Route Planner & Cloud Sync

[![Repository](https://img.shields.io/badge/GitHub-houqisen%2Frv--safepath--pwa-181717?style=flat&logo=github)](https://github.com/houqisen/rv-safepath-pwa)
[![PWA](https://img.shields.io/badge/PWA-Installable-emerald?style=flat&logo=pwa)](https://github.com/houqisen/rv-safepath-pwa)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28?style=flat&logo=firebase)](https://firebase.google.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini%20AI-Flash-8E75B2?style=flat&logo=google)](https://aistudio.google.com/)

> **RV SafePath** is a Progressive Web App (PWA) designed specifically for RVers, camper vans, and travel trailers. It pairs your rig's exact dimensions (*height clearance, combined length, gross weight, and towing MPG*) with Google Maps, Cloud Firestore, and Gemini AI to provide low-clearance safe routing, real-time facility discovery, towing weather hazard alerts, automated multi-day trip itineraries, and cross-device cloud synchronization.

---

## 🌟 Key Features

### 🛡️ 1. Rig Dimension & Low-Clearance Guard
- **Vehicle Profiling:** Configure height (feet/inches), trailer length, combined towing length, gross vehicle weight (GVWR), electrical rating (30A/50A), propane setup, and towing MPG.
- **Accurate Expense & Range Estimations:** Calculates realistic travel duration, fuel expenses based on actual towing fuel economy, and safe fuel range thresholds (~25-gal intervals).

### 📍 2. In-Time Google Places Facility Finder
- **Live 20-Mile Radius Search:** Instant search powered by the Google Places API with specialized filters:
  - ⛽ **Fuel Stations:** Displays real-time diesel and regular gas prices directly from Google Places fuel metadata.
  - 🔥 **Verified Bulk Propane:** Strict verification filter targeting bulk LP refilling stations (U-Haul, Tractor Supply, Co-op, Pilot/Flying J) while filtering out simple tank exchange stores.
  - 🚾 **RV Dump Stations:** Find municipal and park dump stations for black/gray water disposal.
  - 🅿️ **Free Overnight Parking:** Quickly locate RV-friendly overnight stops (Walmart Supercenters, Cracker Barrel, Casinos).
  - 🏕️ **RV Parks & Campgrounds:** Filter for pull-through pads, full hookups, and club discount partners.
- **Interactive Map Markers:** Custom vector teardrop pin markers with category color-coding and popup InfoWindows.
- **One-Click Navigation:** Directly launches turn-by-turn directions in Google Maps.

### 🤖 3. Gemini AI Trip Copilot
- **Guided & Custom Itinerary Modes:** Plan multi-day road trips from simple destination lists (e.g., `Glacier NP, MT -> Yellowstone NP, WY`) or freeform prompts.
- **Seasonal & Climate Awareness:** Automatically detects travel season (Spring, Summer, Fall, Winter) and adapts campground selections and mountain pass recommendations accordingly.
- **Driving Feasibility Evaluation:** Validates whether total driving distances are realistic within your target max daily driving hours (e.g., ~4–5 hours/day) and provides pacing suggestions if limits are exceeded.
- **Dynamic 3-3-3 Pacing:** Option to enforce the classic RV 3-3-3 Rule (*≤300 miles/day, arrive before 3:00 PM, stay ≥3 nights*).
- **Cascading Stop Schedules:** Real-time cascading calculation of stop arrival times and day Camp Arrival from custom departure times.
- **Round-Trip Support:** Automatically schedules the return leg to your starting point with 0 stay nights on the final transit stop.

### 🏕️ 4. Intelligent RV Site Picker (Side-by-Side Comparison)
- On-demand campsite recommendation for any stop on your route.
- Evaluates and ranks the **Top 3 Verified RV Parks** matched to your vehicle length, clearance, and hookup needs.
- **9-Factor Comparison Matrix:**
  1. *Proximity & Town Access*
  2. *View & Setting*
  3. *Pad Length & Level Surface (Paved/Gravel)*
  4. *Electrical Service (30A / 50A / Full Hookups)*
  5. *Driving & Turn Ease (Direct right turns vs. difficult left turns across traffic)*
  6. *Starlink Sky Clearance & Cellular Reception*
  7. *Amenities & Pet Friendliness*
  8. *Estimated Rates & Club Discounts (Good Sam, KOA, Passport America)*
  9. *Best For / Verdict*
- **One-Click Apply:** Directly populates the stop with the campground name, address, and access notes.

### ☁️ 5. Cloud Firestore Real-Time Sync & User Authentication
- **User Authentication:** Sign in with 1-click Google OAuth or Email & Password (with password reset support).
- **Cross-Device Live Sync:** Uses Firestore real-time snapshot listeners to sync changes instantly across laptops, phones, and tablets without refreshing.
- **Guest-to-Cloud Auto Migration:** Seamlessly migrates local guest trips and rig profiles into the user's cloud account upon first login.
- **Offline Persistence:** Firestore IndexedDB caching keeps data available and editable even in remote campgrounds with zero cell reception.

### ⛅ 6. Live Towing Weather & Hazard Radar
- Live weather forecasts for every stop along your itinerary via Open-Meteo with geocoding fallback.
- **Automated Towing Hazard Alerts:**
  - ⚠️ **High Crosswind Advisory:** Flags dangerous crosswinds (≥25 mph) that increase trailer sway risk.
  - ❄️ **Freeze Warning:** Alerts when temperatures drop below 32°F (0°C) to protect RV plumbing.
  - ⛈️ **Severe Storm Warning:** Flags active thunderstorms, hail, or snow accumulation.

### ✅ 7. Interactive Departure & Setup Checklists
- Pre-loaded, reorderable safety task lists for **Pre-Departure** and **Camp Arrival / Setup**.
- Covers critical steps including slide-out retraction, leveling jacks, surge protector pedestal testing, water pressure regulator attachment, and safety chains.

---

## 🛠️ Tech Stack

- **Frontend Framework:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, FontAwesome 6
- **Cloud Database & Auth:** Google Cloud Firestore (Native Mode), Google Cloud Identity Platform / Firebase Auth
- **Maps & Geolocation:** Google Maps JavaScript SDK, Places Library, Directions Service, Open-Meteo Weather API
- **AI Engine:** Google Gemini API (`gemini-flash-lite-latest`, `gemini-3.5-flash`, `gemini-flash-latest`) via Google AI Studio
- **PWA:** Service Worker, Web App Manifest (Installable on iOS, Android, and Desktop)

---

## 📂 Modular Project Structure

```
src/
├── types/
│   ├── rv.ts                     # RvProfile definition & rig configuration
│   ├── itinerary.ts              # Waypoint, WaypointStop, AiPlanPreview, DestinationWeather
│   ├── places.ts                 # FacilityItem, PlaceCategory, RouteSummary, RvSitePickerResults
│   └── checklist.ts              # ChecklistTask definition
│
├── constants/
│   ├── mapStyles.ts              # DARK_MAP_STYLE (custom dark Google Maps theme)
│   ├── profileDefaults.ts        # DEFAULT_PROFILE & initial specs
│   └── checklistDefaults.ts      # INITIAL_DEPARTURE_TASKS, INITIAL_ARRIVAL_TASKS
│
├── utils/
│   ├── dateUtils.ts              # calculateTripDurationAndSeason, getWaypointDisplayDay
│   ├── addressUtils.ts           # formatResolvedPlaceAddress (POIs & parks formatting), parseDestinationList
│   └── jsonUtils.ts              # normalizeWaypoints, normalizeSiteResults
│
├── services/
│   ├── firebase.ts               # Firebase App, Auth & Firestore initialization with offline persistence
│   ├── authService.ts            # Google OAuth, Email/Password sign-in, account creation & password reset
│   ├── cloudStorageService.ts    # Cloud Firestore CRUD & real-time snapshot subscriber for profiles/trips/checklists
│   ├── geminiService.ts          # generateAiTripPlan, fetchRvSitePickerRecommendations (Gemini API cascade)
│   ├── weatherService.ts         # fetchLiveWeatherForStops, Open-Meteo geocoding & hazard alerts
│   ├── placesService.ts          # searchNearbyPlaces, bulk propane verification & fuel pricing
│   └── directionsService.ts      # calculateWaypointMetricsService (cascading stop times), calculateSafeRouteService
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx            # App branding, clearance badge, Auth dropdown & Emerald Sign In button
│   │   └── Sidebar.tsx           # Tab switcher navigation & Active RV Specs card
│   │
│   ├── tabs/
│   │   ├── InTimeFinderTab.tsx   # Google Map + nearby POI cards (Fuel, Propane, Dump, Camps, Parking)
│   │   ├── SafeRouterTab.tsx     # A-to-B safe router, polyline rendering & route summary card
│   │   ├── TripPlannerTab.tsx    # 3-3-3 metrics, stops scheduler, departure time inputs, weather tags
│   │   └── ChecklistsTab.tsx     # Pre-departure & Camp Arrival interactive checklist cards
│   │
│   └── modals/
│       ├── AuthModal.tsx         # Unified authentication modal (1-Click Google + Email/Password + Reset)
│       ├── AiCopilotModal.tsx    # Gemini AI trip planner (Guided/Custom, Plan preview, Append/Replace)
│       ├── RvSitePickerModal.tsx # Top 3 RV campsite comparison table (RV Profile Matched)
│       └── RvProfileModal.tsx    # Rig dimensions, towing MPG, propane bins, memberships & hookups
│
└── App.tsx                       # Clean root application orchestrator & state manager
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Google Cloud Project](https://console.cloud.google.com/) with:
  - Maps JavaScript API, Places API, Directions API, Geocoding API
  - Cloud Firestore Database (Native mode)
  - Identity Platform (Google & Email/Password providers enabled)
- [Google AI Studio Gemini API Key](https://aistudio.google.com/app/apikey) (Free tier supported)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/houqisen/rv-safepath-pwa.git
   cd rv-safepath-pwa
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (or configure in Netlify Environment Variables):
   ```env
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_FIREBASE_API_KEY=your_gcp_firebase_api_key
   VITE_FIREBASE_PROJECT_ID=app-rv-safe-path
   VITE_FIREBASE_AUTH_DOMAIN=app-rv-safe-path.firebaseapp.com
   VITE_FIREBASE_STORAGE_BUCKET=app-rv-safe-path.firebasestorage.app
   ```

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🔒 Firestore Security Rules

To ensure complete data privacy and security so that each user can only read and write their own data, use the following rules in your Firestore Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 📱 PWA & Offline Installation

RV SafePath is fully installable as a standalone app on all operating systems:
- **Desktop (Chrome/Edge):** Click the install icon in the address bar to add it to your desktop.
- **iOS (Safari):** Tap the **Share** button → tap **Add to Home Screen**.
- **Android (Chrome):** Tap the **Menu (three dots)** → tap **Install App** or **Add to Home screen**.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/houqisen/rv-safepath-pwa/issues).
