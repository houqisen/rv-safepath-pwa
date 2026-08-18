import { RvProfile } from '../types/rv';
import { AiPlanPreview, Waypoint } from '../types/itinerary';
import { RvSitePickerResults } from '../types/places';
import { normalizeWaypoints, normalizeSiteResults } from '../utils/jsonUtils';
import { parseDestinationList } from '../utils/addressUtils';
import { calculateTripDurationAndSeason } from '../utils/dateUtils';

const DEFAULT_GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export interface GenerateTripOptions {
  inputMode: 'guided' | 'custom';
  startLocation: string;
  destinations: string;
  departureDate: string;
  returnDate: string;
  vibeTags: string[];
  enforce333: boolean;
  isRoundTrip: boolean;
  maxDailyHours: number;
  customPrompt: string;
  profile: RvProfile;
}

export async function generateAiTripPlan(options: GenerateTripOptions): Promise<AiPlanPreview> {
  const effectiveKey = (localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_API_KEY || "").trim();
  if (!effectiveKey) {
    throw new Error("Please configure your VITE_GEMINI_API_KEY environment variable in Netlify or settings to use AI features.");
  }

  const { profile, inputMode, startLocation, destinations, departureDate, returnDate, vibeTags, enforce333, isRoundTrip, maxDailyHours, customPrompt } = options;
  const combinedLen = profile.combinedLengthFeet || profile.lengthFeet;
  const safeMpg = Number(profile.towingMpg) || 10;
  const safeFuelRangeVal = safeMpg * 25;

  let userInstructions = "";
  if (inputMode === 'guided') {
    const rawDestInput = destinations.trim() || "National Parks road trip";
    const parsedDests = parseDestinationList(rawDestInput);
    const hasSequenceArrow = rawDestInput.includes('->') || rawDestInput.includes('-->');
    const startText = startLocation.trim() || "Bellevue, WA";
    const vibesText = vibeTags.join(', ');
    const { diffDays, season, depFormatted, retFormatted } = calculateTripDurationAndSeason(departureDate, returnDate);
    
    let pacingText = "";
    if (enforce333) {
      pacingText = `STRICT PACING RULE: Follow the RV 3-3-3 Rule (maximum ~300 miles driving per day, arrive at campsite before 3:00 PM in daylight, and stay at least 3 nights at destination stops). For cross-country highway travel, schedule 1-night overnight sleep stops (stayNights = 1) at the final stop of each day.`;
    } else {
      pacingText = `UNCONSTRAINED PACING: No fixed 3-3-3 rules required. Target max daily driving time of ~${maxDailyHours} hours. For long-distance destinations, break transit into safe daily legs with 1-night sleep stops.`;
    }

    const roundTripInstruction = isRoundTrip
      ? `ROUND-TRIP REQUIREMENT: This is a ROUND-TRIP journey starting and ending at "${startText}". The final waypoint MUST return back to "${startText}", its "isHomeReturn" MUST be true, and its "stayNights" MUST be 0.`
      : `ONE-WAY REQUIREMENT: This is a ONE-WAY trip ending at the final destination.`;

    const formattedDestList = parsedDests.length > 0
      ? parsedDests.map((d, i) => `  ${i + 1}. ${d}`).join('\n')
      : `  1. ${rawDestInput}`;

    const sequenceRule = hasSequenceArrow
      ? "CRITICAL SEQUENCE: The user used '->' arrows indicating a strict travel sequence. You MUST visit the destinations in the exact numbered sequence listed above."
      : "CIRCUIT OPTIMIZATION: Organize the destinations in the most geographically optimal driving circuit.";

    userInstructions = `
      Plan an RV trip itinerary with the following parameters:
      - Starting Location / Home Base: "${startText}"
      - TARGET DESTINATIONS LIST (Note: Commas represent City, State names and MUST NOT be split):
${formattedDestList}
      - Sequence Directive: ${sequenceRule}
      - Calendar Dates: From ${depFormatted} to ${retFormatted} (${diffDays} Days Total, ${season} Season)
      - Travel Vibe / Style: ${vibesText}
      - Target Max Daily Driving Hours: ~${maxDailyHours} hours/day
      - ${pacingText}
      - ${roundTripInstruction}

      MULTI-STOP WAYPOINT SCENARIOS:
      A single travel day (waypoint) should have multiple items in "stops" when:
      1. Distance & Safe Fuel Range: On driving days > 4-5 hours (> ~250 miles), add a mid-day Stop 1 for fuel, lunch, and rest at an RV-friendly travel center before the evening campground (Stop 2).
      2. Roadside Scenic Overlooks: Iconic must-see attractions along the highway with verified oversized RV parking suitable for a ${combinedLen}ft combined rig and easy highway on/off access.
      3. Clustered Dream Destinations: Close-by attractions visited on the same day before heading to camp.
      4. Pacing: Every intermediate travel day MUST have stayNights >= 1 at its final stop. Only the final return home has stayNights = 0.
    `;
  } else {
    const promptText = customPrompt.trim();
    if (!promptText) {
      throw new Error("Please enter your trip ideas or destinations.");
    }

    userInstructions = `
      User's Custom Trip Request:
      "${promptText}"

      CUSTOM PROMPT DIRECTIVES:
      1. Check for Round-Trip intent keywords ("back home", "and back", "return", "round trip", "to X and back"). When detected, plan outbound transit legs, destination stays, return transit legs, and end with a final return to the starting origin with "isHomeReturn": true and "stayNights": 0.
      2. Check for Conditional Time Budget phrases ("unless impossible in N days", "within N days"). Calculate total round-trip distance. If a strict cap (e.g. 5 hrs/day) is mathematically impossible within the budget, scale up daily driving to realistic daylight hours (~6.5–7.5 hrs/day over enough driving days) to satisfy the user's hard calendar limit without driving overnight, and explain this scaling in the summary.
      3. Account for Time Zone transitions (PT -> MT -> CT -> ET) and ensure all arrivals occur in daylight before 4:30 PM local time.
      4. When intermediate fuel breaks, lunch stops, or roadside scenic attractions (with oversize RV parking for a ${combinedLen}ft rig) occur on the same day, group them as nested items inside that day's "stops" array, with the evening campground as the final stop where the traveler stays for M nights (stayNights >= 1).
    `;
  }

  const systemPrompt = `
    You are RV SafePath AI Copilot, an expert RV travel planning assistant.
    
    USER RIG SPECS (DYNAMICALLY INJECTED FROM ACTIVE PROFILE):
    - Starting Origin / Home: ${startLocation || "Bellevue, WA"}
    - RV Type: ${profile.rvType}
    - Combined Driving Length: ${combinedLen} ft (Ensure all stops and campsites accommodate >= ${combinedLen}ft)
    - Height Clearance: ${profile.heightFeet} ft ${profile.heightInches} in (MANDATORY: Ensure all routes avoid low clearance bridges and low tree overhangs)
    - Gross Weight: ${profile.weightLbs.toLocaleString()} lbs
    - Towing Fuel Economy: ${safeMpg} MPG (Safe towing fuel range: ~${safeFuelRangeVal} miles between fill-ups)
    - Electrical Rating: ${profile.ampRating}
    - Minimum Hookup: ${profile.minHookup}
    - Propane Setup: ${profile.propaneStyle} (${profile.propaneCount} x ${profile.propaneLb} lbs)
    - Towing Vehicle Setup: ${profile.towSetup}
    - Active Memberships: ${profile.memberships.join(', ') || 'None'}

    CRITICAL RV ROUTING & SAFETY LAWS:
    1. MANDATORY MULTI-STOP WAYPOINT STRUCTURE:
       - A Waypoint represents ONE travel/overnight day.
       - A Waypoint starts from "origin" and contains an array of "stops": [ Stop 1, Stop 2, ..., Stop K ].
       - Middle Stops (Stop 1 to Stop K-1): Daytime pauses for fuel, lunch, or must-see scenic overlooks with verified oversized RV parking suitable for a ${combinedLen}ft rig.
       - Last Stop (Stop K): The evening destination campground where the traveler checks in and stays for M nights ("stayNights" = M, where M >= 1 for all intermediate days).
       - Only the final waypoint returning the traveler home has "stayNights" = 0 and "isHomeReturn" = true.
    2. DAYLIGHT DRIVING ONLY: All daily driving legs must depart between 8:00 AM - 9:00 AM and arrive at the final evening camp before 4:00 PM - 5:00 PM in daylight. NEVER schedule overnight driving or late night arrivals.
    3. TIME ZONE SHIFTS: Account for US/Canada time zone crossings (PT -> MT -> CT -> ET). Eastbound loses 1 hr (+1 hr local clock), Westbound gains 1 hr (-1 hr local clock). Ensure local arrival is still before 4:30 PM local time and explicitly note time zone changes in 'notes'.

    OUTPUT FORMAT REQUIREMENTS:
    You MUST respond with a valid JSON object strictly matching this schema:
    {
      "tripTitle": "Short catchy trip name",
      "summary": "1-2 sentence description highlighting the route, pacing, and time zone / sleep safety notes",
      "isFeasible": true,
      "feasibilityWarning": null,
      "waypoints": [
        {
          "origin": "Starting City, State",
          "stayNights": 1,
          "isHomeReturn": false,
          "stops": [
            {
              "destination": "Daytime Stop Name, City, State",
              "depHour": 8,
              "depMin": 0,
              "depAmPm": "AM"
            },
            {
              "destination": "Overnight Campground Name, City, State",
              "depHour": 13,
              "depMin": 0,
              "depAmPm": "PM"
            }
          ],
          "notes": "Route highlights, RV site recommendations, time zone notes."
        }
      ]
    }
  `;

  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash'
  ];

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { text: userInstructions }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const rawText = data.candidates[0].content.parts[0].text;
        const parsedObj = JSON.parse(rawText);
        const waypointsList = normalizeWaypoints(parsedObj);
        if (waypointsList.length > 0) {
          return {
            tripTitle: parsedObj.tripTitle || (Array.isArray(parsedObj) && parsedObj[0]?.tripTitle) || "RV Adventure Itinerary",
            summary: parsedObj.summary || (Array.isArray(parsedObj) && parsedObj[0]?.summary) || "Custom generated itinerary for your RV journey.",
            isFeasible: parsedObj.isFeasible !== undefined ? parsedObj.isFeasible : true,
            feasibilityWarning: parsedObj.feasibilityWarning || null,
            waypoints: waypointsList
          };
        }
      } else {
        lastError = data.error?.message || "Generation error";
      }
    } catch (mErr: any) {
      lastError = mErr.message;
    }
  }

  throw new Error(lastError || "Could not generate trip plan. Please verify your connection.");
}

export interface SitePickerOptions {
  destination: string;
  stayNights: number;
  season?: string;
  profile: RvProfile;
}

export async function fetchRvSitePickerRecommendations(options: SitePickerOptions): Promise<RvSitePickerResults> {
  const effectiveKey = (localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_API_KEY || "").trim();
  if (!effectiveKey) {
    throw new Error("Please configure your Gemini API Key in Netlify environment variables.");
  }

  const { destination, stayNights, season = 'Summer', profile } = options;
  const combinedLen = profile.combinedLengthFeet || profile.lengthFeet;
  const hookupLabels: Record<string, string> = {
    full: 'Must Be Full Hookups (Water, 30A/50A Electric, and Sewer at campsite)',
    partial: 'Water & Electric OK (Sewer dump station on campground premises)',
    electric: 'Electric Only OK (30A/50A power pedestal)',
    dry: 'Dry Camping / Boondocking OK (Off-grid, no hookups required)'
  };
  const hookupPrefDesc = hookupLabels[profile.minHookup] || profile.minHookup;

  const systemPrompt = `
    You are RV SafePath Site Selection Expert, specialized in matching campgrounds and RV resorts to specific vehicle dimensions and towing setups.
    
    USER'S ACTIVE RV RIG SPECS:
    - RV Type: ${profile.rvType}
    - Height Clearance: ${profile.heightFeet} ft ${profile.heightInches} in (Ensure low branch clearance on entrance roads)
    - Combined Driving Length: ${combinedLen} ft (Ensure campsite pads accommodate >= ${combinedLen}ft)
    - Electrical Service: ${profile.ampRating}
    - Hookup Requirement: ${hookupPrefDesc}
    - Towing / Drive Setup: ${profile.towSetup}
    - Active Memberships: ${profile.memberships.join(', ') || 'None'}
    - Travel Season: ${season}

    TASK:
    Find and compare the Top 3 best, real, and verified RV parks or campgrounds in or immediately adjacent to "${destination}" for a stay of ${stayNights} nights during ${season}.
    CRITICAL EVALUATION FACTORS:
    1. Maneuverability & Towing Ease: Note whether highway turn-off is an easy right-hand turn or a difficult left-turn across oncoming traffic, entrance road width, and pull-through vs back-in pads.
    2. Proximity: Distance to main parks, lake/river, or town.
    3. Hookups & Utilities (FHU Status): Clearly classify whether the campsite offers FULL HOOKUPS (FHU: Water, 30A/50A Electric, and Sewer at site), PARTIAL HOOKUPS (Water + 30A/50A Electric only, with dump station), or DRY CAMPING. Match the user's hookup requirement: "${hookupPrefDesc}".
    4. Starlink & Connectivity: Open sky vs tree canopy, cell reception.
    5. Seasonality & Amenities: Dog park, heated risers in freeze, pool, club discounts.

    OUTPUT FORMAT:
    Respond strictly in valid JSON matching this schema:
    {
      "location": "${destination}",
      "sites": [
        {
          "name": "Campground Name",
          "address": "Full Street Address, City, State/Province, Zip",
          "category": "Private RV Resort / Provincial or State Park / National Park / KOA",
          "proximity": "e.g., 2.5 miles to Park West Entrance; 5 min drive to groceries",
          "viewSetting": "e.g., Lakefront mountain view; peaceful pine forest backdrop",
          "padType": "e.g., 50ft Paved Pull-Through (Level Concrete)",
          "hookups": "e.g., Full Hookup (30A & 50A, City Water, Sewer at site)",
          "turnEase": "e.g., Direct right-hand turn off Hwy 1; wide two-lane swing, no tight turns",
          "connectivity": "e.g., Wide open southern sky (Great for Starlink); strong Verizon LTE",
          "amenities": "e.g., Dog park, clean hot showers, laundry, fire pits, camp store",
          "priceDiscounts": "e.g., ~$65–$85/night (Good Sam 10% discount accepted)",
          "bestFor": "e.g., Best for Big Rigs & Easy Highway Access"
        }
      ]
    }
  `;

  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash'
  ];

  let lastErr = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      const data = await res.json();
      if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const rawText = data.candidates[0].content.parts[0].text;
        const parsedObj = JSON.parse(rawText);
        const sitesList = normalizeSiteResults(parsedObj);
        if (sitesList.length > 0) {
          return {
            location: destination,
            sites: sitesList
          };
        }
      } else {
        lastErr = data.error?.message || "Generation error";
      }
    } catch (mErr: any) {
      lastErr = mErr.message;
    }
  }

  throw new Error(lastErr || "Could not find RV sites. Please verify destination and try again.");
}
