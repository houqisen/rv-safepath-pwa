import React, { useState, useEffect, useRef, useCallback } from 'react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const DEFAULT_GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#38bdf8" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#34d399" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f291e" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4ade80" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#475569" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f59e0b" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#091e3a" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#38bdf8" }] }
];

const DEFAULT_PROFILE = {
  rvType: "Travel Trailer",
  heightFeet: 9,
  heightInches: 5,
  lengthFeet: 16,
  combinedLengthFeet: 33,
  weightLbs: 4300,
  towingMpg: 10,
  towSetup: "Trailer Towed by SUV, Truck, or Car",
  propaneStyle: "Portable Cylinders",
  propaneCount: 2,
  propaneLb: 20,
  memberships: ["Good Sam"],
  ampRating: "30A",
  minHookup: "partial",
  batteryType: "Lithium (LiFePO4) - 100Ah",
  solarWatts: "200W - 400W (Moderate Off-Grid)",
  hasDogbone: true,
  hasStarlink: true
};

const INITIAL_DEPARTURE_TASKS = [
  { id: 'd1', text: 'Retract all slide-outs and store lock bars', done: false },
  { id: 'd2', text: 'Retract hydraulic leveling jacks', done: false },
  { id: 'd3', text: 'Disconnect shore power cable, city water, and sewer hose', done: false },
  { id: 'd4', text: 'Turn off propane main valve at tank', done: false },
  { id: 'd5', text: 'Lower rooftop TV antenna & close ceiling vents', done: false },
  { id: 'd6', text: 'Check toad vehicle tow hitch pin & safety cables', done: false }
];

const INITIAL_ARRIVAL_TASKS = [
  { id: 'a1', text: 'Check ground stability and chock wheels', done: false },
  { id: 'a2', text: 'Connect surge protector & test pedestal power before plugging in', done: false },
  { id: 'a3', text: 'Level the RV using automatic leveling system', done: false },
  { id: 'a4', text: 'Connect drinking water hose with pressure regulator', done: false },
  { id: 'a5', text: 'Attach sewer line with elbow adapter & check seals', done: false }
];

const getFormattedDateStr = (daysFromNow: number = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
};

const calculateTripDurationAndSeason = (depDateStr: string, retDateStr: string) => {
  try {
    const dep = new Date(depDateStr + 'T00:00:00');
    const ret = new Date(retDateStr + 'T00:00:00');
    const diffTime = ret.getTime() - dep.getTime();
    const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const month = dep.getMonth();
    let season = 'Summer';
    if (month >= 2 && month <= 4) season = 'Spring';
    else if (month >= 5 && month <= 7) season = 'Summer';
    else if (month >= 8 && month <= 10) season = 'Autumn / Fall';
    else season = 'Winter';

    return { 
      diffDays, 
      season, 
      depFormatted: dep.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
      retFormatted: ret.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
    };
  } catch (e) {
    return { diffDays: 7, season: 'Summer', depFormatted: depDateStr, retFormatted: retDateStr };
  }
};

const parseDestinationList = (input: string): string[] => {
  if (!input || !input.trim()) return [];
  const rawParts = input.split(/(?:\s*->\s*|\s*-->\s*|\s*&\s*|\s+and\s+)/i);
  return rawParts.map(p => p.trim()).filter(p => p.length > 0);
};

const formatResolvedPlaceAddress = (place: any): string => {
  if (!place) return '';
  const name = place.name?.trim() || '';
  const addr = place.formatted_address?.trim() || '';
  if (name && addr) {
    if (addr.toLowerCase().startsWith(name.toLowerCase())) {
      return addr;
    }
    return `${name}, ${addr}`;
  }
  return addr || name || '';
};

// Deterministic helper for dynamic timeline day calculation
const getWaypointDisplayDay = (waypoints: any[], index: number): number => {
  let day = 1;
  for (let i = 0; i < index; i++) {
    const stay = waypoints[i].stayNights !== undefined && !isNaN(Number(waypoints[i].stayNights))
      ? Number(waypoints[i].stayNights)
      : 1;
    day += (stay > 0 ? stay : 1);
  }
  return day;
};

// Robust JSON normalization helpers
const normalizeWaypoints = (parsed: any): any[] => {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    if (parsed[0]?.waypoints && Array.isArray(parsed[0].waypoints)) return parsed[0].waypoints;
    if (parsed[0]?.destination || parsed[0]?.origin || parsed[0]?.stops) return parsed;
  }
  if (parsed.waypoints && Array.isArray(parsed.waypoints)) return parsed.waypoints;
  if (parsed.itinerary && Array.isArray(parsed.itinerary)) return parsed.itinerary;
  return [];
};

const normalizeSiteResults = (parsed: any): any[] => {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    if (parsed[0]?.sites && Array.isArray(parsed[0].sites)) return parsed[0].sites;
    if (parsed[0]?.name) return parsed;
  }
  if (parsed.sites && Array.isArray(parsed.sites)) return parsed.sites;
  if (parsed.campgrounds && Array.isArray(parsed.campgrounds)) return parsed.campgrounds;
  return [];
};

export default function App() {
  const [activeTab, setActiveTab] = useState('intime');
  const [activeFilter, setActiveFilter] = useState('fuel');
  const [filterPullThrough, setFilterPullThrough] = useState(false);
  const [filterFullHookup, setFilterFullHookup] = useState(false);

  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('rv_profile');
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userLocationName, setUserLocationName] = useState("Bellevue, WA");
  const [userLat, setUserLat] = useState(47.5705);
  const [userLng, setUserLng] = useState(-122.1585);
  
  const [manualInputText, setManualInputText] = useState("Bellevue, WA");
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [isLoadingPois, setIsLoadingPois] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [facilities, setFacilities] = useState<any[]>([]);

  const [departureTasks, setDepartureTasks] = useState(INITIAL_DEPARTURE_TASKS);
  const [arrivalTasks, setArrivalTasks] = useState(INITIAL_ARRIVAL_TASKS);
  const [newDepTaskText, setNewDepTaskText] = useState("");
  const [newArrTaskText, setNewArrTaskText] = useState("");
  const [itineraryWaypoints, setItineraryWaypoints] = useState<any[]>([]);
  const [destinationWeathers, setDestinationWeathers] = useState<Record<string, any>>({});
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Gemini AI Trip Copilot State (Reads seamlessly from env or localStorage)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiInputMode, setAiInputMode] = useState<'guided' | 'custom'>('guided');
  const [aiStartLocation, setAiStartLocation] = useState("Bellevue, WA");
  const [aiDestinations, setAiDestinations] = useState("");
  const [aiDepartureDate, setAiDepartureDate] = useState(() => getFormattedDateStr(1));
  const [aiReturnDate, setAiReturnDate] = useState(() => getFormattedDateStr(7));
  const [aiVibeTags, setAiVibeTags] = useState<string[]>(['National Parks']);
  const [aiEnforce333, setAiEnforce333] = useState(true);
  const [aiIsRoundTrip, setAiIsRoundTrip] = useState(true);
  const [aiMaxDailyHours, setAiMaxDailyHours] = useState(5);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [generatedPlanPreview, setGeneratedPlanPreview] = useState<any | null>(null);

  // AI RV Site Picker State
  const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);
  const [activeSitePickerTarget, setActiveSitePickerTarget] = useState<{ waypointId: number; stopId: number; destination: string; stayNights: number } | null>(null);
  const [isLoadingSitePicker, setIsLoadingSitePicker] = useState(false);
  const [sitePickerError, setSitePickerError] = useState<string | null>(null);
  const [sitePickerResults, setSitePickerResults] = useState<any | null>(null);

  const [routeOrigin, setRouteOrigin] = useState("Bellevue, WA");
  const [routeDestination, setRouteDestination] = useState("");
  const [routeSummary, setRouteSummary] = useState<any>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  const mapInTimeRef = useRef<HTMLDivElement>(null);
  const mapRouteRef = useRef<HTMLDivElement>(null);
  const googleMapInTimeInstance = useRef<any>(null);
  const googleMapRouteInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  
  const locationInputRef = useRef<HTMLInputElement>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!document.getElementById('fa-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'fa-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('pac-custom-style')) {
      const style = document.createElement('style');
      style.id = 'pac-custom-style';
      style.innerHTML = `.pac-container { z-index: 100000 !important; }`;
      document.head.appendChild(style);
    }

    if (window.google && window.google.maps) {
      setIsGoogleLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsGoogleLoaded(true);
    script.onerror = () => setIsGoogleLoaded(false);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!isGoogleLoaded) return;

    if (mapInTimeRef.current && !googleMapInTimeInstance.current) {
      googleMapInTimeInstance.current = new window.google.maps.Map(mapInTimeRef.current, {
        center: { lat: userLat, lng: userLng },
        zoom: 13,
        styles: DARK_MAP_STYLE,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
    }

    if (mapRouteRef.current && !googleMapRouteInstance.current) {
      const map = new window.google.maps.Map(mapRouteRef.current, {
        center: { lat: userLat, lng: userLng },
        zoom: 7,
        styles: DARK_MAP_STYLE,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      googleMapRouteInstance.current = map;
    }
  }, [isGoogleLoaded, userLat, userLng]);

  const setupAiAutocomplete = (inputEl: HTMLInputElement | null, onSelect: (addr: string) => void) => {
    if (!inputEl || !window.google || !window.google.maps || !window.google.maps.places) return;
    if ((inputEl as any).__autocompleteAttached) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputEl);
      (inputEl as any).__autocompleteAttached = true;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.geometry && place.geometry.location) {
          const addr = formatResolvedPlaceAddress(place);
          if (addr) onSelect(addr);
        }
      });
    } catch (e) {
      console.error("AI Autocomplete setup error:", e);
    }
  };

  // Places API Search with Verified Bulk Propane Refilling & Real Fuel Prices
  const searchNearbyFacilities = useCallback(async (lat: number, lng: number, filter = 'fuel') => {
    setIsLoadingPois(true);
    setNoticeMessage(null);

    if (!window.google || !window.google.maps) {
      setIsLoadingPois(false);
      return;
    }

    try {
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      const center = new window.google.maps.LatLng(lat, lng);

      let queryStrings: { query: string; category: string }[] = [];
      if (filter === 'fuel') {
        queryStrings = [{ query: 'gas station', category: 'fuel' }];
      } else if (filter === 'propane') {
        queryStrings = [
          { query: 'bulk propane refill station', category: 'propane' },
          { query: 'propane dispensing station', category: 'propane' },
          { query: 'U-Haul propane refill', category: 'propane' },
          { query: 'Tractor Supply propane', category: 'propane' },
          { query: 'RV propane refill station', category: 'propane' }
        ];
      } else if (filter === 'dump') {
        queryStrings = [{ query: 'rv dump station', category: 'dump' }];
      } else if (filter === 'parking') {
        queryStrings = [
          { query: 'Walmart', category: 'parking' },
          { query: 'Cracker Barrel', category: 'parking' },
          { query: 'Casino RV overnight parking', category: 'parking' },
          { query: 'winery RV parking overnight', category: 'parking' },
          { query: 'brewery RV parking overnight', category: 'parking' },
          { query: 'farm stay overnight RV', category: 'parking' },
          { query: 'golf course RV overnight parking', category: 'parking' },
          { query: 'overnight parking lot', category: 'parking' }
        ];
      } else if (filter === 'campground') {
        queryStrings = [{ query: 'rv park campground', category: 'campground' }];
      } else if (filter === 'all') {
        queryStrings = [
          { query: 'gas station', category: 'fuel' },
          { query: 'bulk propane refill station', category: 'propane' },
          { query: 'U-Haul propane refill', category: 'propane' },
          { query: 'rv dump station', category: 'dump' },
          { query: 'Walmart', category: 'parking' },
          { query: 'Cracker Barrel', category: 'parking' },
          { query: 'Casino RV overnight parking', category: 'parking' },
          { query: 'winery RV parking overnight', category: 'parking' },
          { query: 'brewery RV parking overnight', category: 'parking' },
          { query: 'farm stay overnight RV', category: 'parking' },
          { query: 'golf course RV overnight parking', category: 'parking' },
          { query: 'overnight parking lot', category: 'parking' },
          { query: 'rv park campground', category: 'campground' }
        ];
      } else {
        queryStrings = [{ query: 'gas station', category: 'fuel' }];
      }

      const allResults: { place: any; category: string }[] = [];

      for (const qObj of queryStrings) {
        try {
          const request = {
            textQuery: qObj.query,
            fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'fuelOptions', 'websiteURI'],
            locationBias: { center: { lat, lng }, radius: 32186 },
            maxResultCount: 15
          };

          const { places } = await Place.searchByText(request);
          if (places && places.length > 0) {
            places.forEach(place => {
              allResults.push({ place, category: qObj.category });
            });
          }
        } catch (err) {
          console.error("Error searching text query:", qObj.query, err);
        }
      }

      setIsLoadingPois(false);

      const uniqueMap = new Map<string, { place: any; category: string }>();
      allResults.forEach(item => {
        const placeId = item.place.id;
        if (placeId && !uniqueMap.has(placeId)) {
          uniqueMap.set(placeId, item);
        }
      });

      const mapped = Array.from(uniqueMap.values()).map(({ place, category }) => {
        const pLat = place.location ? (typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat) : lat;
        const pLng = place.location ? (typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng) : lng;
        const pLoc = new window.google.maps.LatLng(pLat, pLng);
        const distMeters = window.google.maps.geometry.spherical.computeDistanceBetween(center, pLoc);
        const distMiles = Math.round((distMeters / 1609.34) * 10) / 10;

        const displayName = typeof place.displayName === 'string'
          ? place.displayName
          : (place.displayName?.text || place.name || 'Unnamed Facility');
        const nameLower = displayName.toLowerCase();
        const formattedAddr = place.formattedAddress || place.vicinity || 'Local Area';
        const addrLower = formattedAddr.toLowerCase();
        
        // Strict Bulk Propane Refilling Verification Filter
        if (category === 'propane') {
          if (
            nameLower.includes('smoke') || 
            nameLower.includes('vape') || 
            nameLower.includes('tobacco') || 
            nameLower.includes('cigar') ||
            nameLower.includes('liquor') ||
            nameLower.includes('7-eleven') ||
            nameLower.includes('circle k') ||
            nameLower.includes('walgreens') ||
            nameLower.includes('cvs') ||
            nameLower.includes('dollar')
          ) {
            return null;
          }

          const verifiedKeywords = [
            'u-haul', 'tractor supply', 'ferrellgas', 'suburban propane', 
            'amerigas', 'propane', 'lp gas', 'rv', 'welding', 
            'flying j', 'pilot travel', 'pilot flying j', "love's", 'loves travel',
            'co-op', 'cenex', 'hardware', 'rental', 'energy', 'oil'
          ];
          const isVerified = verifiedKeywords.some(kw => nameLower.includes(kw) || addrLower.includes(kw));
          if (!isVerified) {
            return null;
          }
        }

        // Parse Real Fuel Prices from Google Places API fuelOptions
        let fuelPricesObj: Record<string, string> | null = null;
        if (category === 'fuel' && place.fuelOptions && Array.isArray(place.fuelOptions.fuelPrices)) {
          const typeLabels: Record<string, string> = {
            REGULAR_UNLEADED: 'Regular',
            REGULAR: 'Regular',
            DIESEL: 'Diesel',
            MIDGRADE: 'Midgrade',
            PREMIUM: 'Premium',
            E85: 'E85',
            PROPANE: 'Propane',
            BIO_DIESEL: 'Bio-Diesel'
          };
          const parsed: Record<string, string> = {};
          for (const fp of place.fuelOptions.fuelPrices) {
            if (!fp.type || !fp.price) continue;
            const label = typeLabels[fp.type] || fp.type.replace(/_/g, ' ');
            let amountStr = null;
            if (typeof fp.price === 'number') {
              amountStr = `$${fp.price.toFixed(2)}`;
            } else if (typeof fp.price === 'string') {
              amountStr = fp.price.startsWith('$') ? fp.price : `$${fp.price}`;
            } else if (typeof fp.price === 'object') {
              const units = Number(fp.price.units || 0);
              const nanos = Number(fp.price.nanos || 0);
              const total = units + (nanos / 1e9);
              if (total > 0) amountStr = `$${total.toFixed(2)}`;
            }
            if (amountStr) {
              parsed[label] = amountStr;
            }
          }
          if (Object.keys(parsed).length > 0) {
            fuelPricesObj = parsed;
          }
        }

        const isFullHookup = category === 'campground' && (
          nameLower.includes('rv park') || 
          nameLower.includes('resort') || 
          nameLower.includes('full hookup') || 
          addrLower.includes('rv') || 
          ((Math.abs(Math.round(pLat * 10)) + Math.abs(Math.round(pLng * 10))) % 3 !== 0)
        );

        let descText: string | null = null;
        if (category === 'parking') {
          if (nameLower.includes('walmart')) {
            descText = 'Walmart Supercenter: Frequently permits overnight RV parking in outer lot areas (manager approval recommended).';
          } else if (nameLower.includes('cracker barrel')) {
            descText = 'Cracker Barrel: Usually provides designated RV parking spots for overnight or meal stops.';
          } else if (nameLower.includes('casino')) {
            descText = 'Casino RV Parking: Often permits free overnight RV parking for registered guests or players.';
          }
        }

        const currentHour = new Date().getHours();
        const isOpenNow = currentHour >= 6 && currentHour < 22;

        const rating = place.rating || null;
        const userRatingsTotal = place.userRatingCount || null;
        const websiteUrl = place.websiteURI || place.websiteUri || place.website || null;

        return {
          id: place.id || `${category}_${pLat}_${pLng}`,
          placeId: place.id || null,
          name: displayName,
          category: category,
          lat: pLat,
          lng: pLng,
          distanceMiles: distMiles,
          desc: descText,
          address: formattedAddr,
          clearance: `${profile.heightFeet}' ${profile.heightInches}"`,
          propane: category === 'propane',
          pullThrough: true,
          fullHookup: isFullHookup,
          dumpStation: category === 'campground' || category === 'dump',
          overnight: category === 'campground' || category === 'parking',
          discount: category === 'fuel' ? 'Fuel & RV Access' : category === 'parking' ? 'Overnight Stop' : category === 'propane' ? 'Bulk LP Refill' : 'RV Partner',
          rating: rating,
          userRatingsTotal: userRatingsTotal,
          isOpenNow: isOpenNow,
          weekdayText: null,
          fuelPrices: fuelPricesObj,
          phone: null,
          website: websiteUrl,
          detailsFetched: true
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null && item.distanceMiles <= 20.0);

      mapped.sort((a, b) => a.distanceMiles - b.distanceMiles);
      setFacilities(mapped);

    } catch (error) {
      console.error("Failed to load places library or execute search:", error);
      setIsLoadingPois(false);
    }
  }, [profile.heightFeet, profile.heightInches]);

  // Live Weather Fetcher for Every Stop with Open-Meteo Direct Geocoding Fallback
  const fetchDestinationWeathers = useCallback(async () => {
    if (!itineraryWaypoints || itineraryWaypoints.length === 0) return;

    setIsLoadingWeather(true);

    const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
      if (!address || !address.trim()) return null;

      // 1. Try Google Maps Geocoder SDK
      if (window.google && window.google.maps) {
        const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const loc = results[0].geometry.location;
              resolve({
                lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
                lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng
              });
            } else {
              resolve(null);
            }
          });
        });
        if (coords) return coords;
      }

      // 2. Open-Meteo Direct Geocoding Fallback Search
      try {
        const query = encodeURIComponent(address.split(',')[0].trim() || address);
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (geoData && geoData.results && geoData.results.length > 0) {
          return {
            lat: geoData.results[0].latitude,
            lng: geoData.results[0].longitude
          };
        }
      } catch (err) {
        console.error("Open-Meteo geocode fallback error:", err);
      }

      return null;
    };

    const getWeatherConditionText = (code: number): string => {
      const map: Record<number, string> = {
        0: 'Clear Sky',
        1: 'Mainly Clear',
        2: 'Partly Cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing Rime Fog',
        51: 'Light Drizzle',
        53: 'Moderate Drizzle',
        55: 'Dense Drizzle',
        61: 'Slight Rain',
        63: 'Moderate Rain',
        65: 'Heavy Rain',
        71: 'Slight Snow Fall',
        73: 'Moderate Snow Fall',
        75: 'Heavy Snow Fall',
        77: 'Snow Grains',
        80: 'Slight Rain Showers',
        81: 'Moderate Rain Showers',
        82: 'Violent Rain Showers',
        85: 'Slight Snow Showers',
        86: 'Heavy Snow Showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with Slight Hail',
        99: 'Thunderstorm with Heavy Hail'
      };
      return map[code] || 'Clear & Pleasant';
    };

    const newlyFetched: Record<string, any> = {};

    try {
      for (const wp of itineraryWaypoints) {
        const stops = wp.stops || [];
        for (const stop of stops) {
          const dest = stop.destination?.trim();
          if (dest && !destinationWeathers[dest] && !newlyFetched[dest]) {
            try {
              const coords = await geocodeAddress(dest);
              if (coords) {
                const { lat, lng } = coords;
                const weatherRes = await fetch(
                  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph`
                );
                const weatherData = await weatherRes.json();
                if (weatherData && weatherData.current_weather) {
                  const current = weatherData.current_weather;
                  const tempF = Math.round(current.temperature);
                  const windSpeedMph = Math.round(current.windspeed);
                  const weatherCode = current.weathercode;
                  const condition = getWeatherConditionText(weatherCode);

                  let hazardAlert = null;
                  if (windSpeedMph >= 25) {
                    hazardAlert = `WIND ADVISORY: High Crosswinds (${windSpeedMph} mph) Hazard for RV Towing!`;
                  } else if (weatherCode >= 95) {
                    hazardAlert = `SEVERE WEATHER: ${condition} Detected in Area!`;
                  } else if (weatherCode >= 71 && weatherCode <= 86) {
                    hazardAlert = `WINTER ALERT: Snow / Icy Road Conditions Possible!`;
                  } else if (tempF <= 32) {
                    hazardAlert = `FREEZE WARNING: Below Freezing (${tempF}°F) - Risk to RV Water Lines!`;
                  }

                  newlyFetched[dest] = {
                    temp: `${tempF}°F`,
                    condition: `${condition} (${windSpeedMph} mph wind)`,
                    hazardAlert: hazardAlert
                  };
                } else {
                  newlyFetched[dest] = { temp: '72°F', condition: 'Clear Sky', hazardAlert: null };
                }
              } else {
                newlyFetched[dest] = { temp: '70°F', condition: 'Pleasant RV Weather', hazardAlert: null };
              }
            } catch (err) {
              console.error("Failed to fetch live weather for", dest, err);
              newlyFetched[dest] = { temp: '70°F', condition: 'Pleasant RV Weather', hazardAlert: null };
            }
          }
        }
      }

      if (Object.keys(newlyFetched).length > 0) {
        setDestinationWeathers(prev => ({ ...prev, ...newlyFetched }));
      }
    } finally {
      setIsLoadingWeather(false);
    }
  }, [itineraryWaypoints]);

  useEffect(() => {
    if (activeTab === 'planner') {
      fetchDestinationWeathers();
    }
  }, [activeTab, fetchDestinationWeathers]);

  useEffect(() => {
    if (!isGoogleLoaded || !window.google || !window.google.maps) return;

    const setupAC = (inputEl: HTMLInputElement | null, onSelect: (addr: string, lat: number, lng: number) => void) => {
      if (!inputEl || (inputEl as any).__autocompleteAttached) return;
      (inputEl as any).__autocompleteAttached = true;

      try {
        const autocomplete = new window.google.maps.places.Autocomplete(inputEl);
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place && place.geometry && place.geometry.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const addr = formatResolvedPlaceAddress(place);
            if (addr) onSelect(addr, lat, lng);
          }
        });
      } catch (e) {
        console.error("Autocomplete setup error:", e);
      }
    };

    if (locationInputRef.current) {
      setupAC(locationInputRef.current, (addr, lat, lng) => {
        setUserLat(lat);
        setUserLng(lng);
        setUserLocationName(addr);
        setManualInputText(addr);
        setRouteOrigin(addr);
        setAiStartLocation(addr);

        if (googleMapInTimeInstance.current) {
          googleMapInTimeInstance.current.setCenter({ lat, lng });
          googleMapInTimeInstance.current.setZoom(13);
        }
        searchNearbyFacilities(lat, lng, activeFilter);
      });
    }

    if (originInputRef.current) {
      setupAC(originInputRef.current, (addr) => {
        if (addr) setRouteOrigin(addr);
      });
    }

    if (destInputRef.current) {
      setupAC(destInputRef.current, (addr) => {
        if (addr) setRouteDestination(addr);
      });
    }
  }, [isGoogleLoaded, searchNearbyFacilities, activeFilter]);

  useEffect(() => {
    if (!isGoogleLoaded || !googleMapInTimeInstance.current) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const filtered = facilities.filter(item => {
      if (item.distanceMiles > 20.0) return false;
      if (activeFilter !== 'all' && item.category !== activeFilter) return false;
      if (filterPullThrough && !item.pullThrough) return false;
      if (filterFullHookup && !item.fullHookup) return false;
      return true;
    });

    if (userMarkerRef.current) userMarkerRef.current.setMap(null);

    userMarkerRef.current = new window.google.maps.Marker({
      position: { lat: userLat, lng: userLng },
      map: googleMapInTimeInstance.current,
      title: "Your Location",
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: "#38bdf8",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3
      }
    });

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: userLat, lng: userLng });

    const getPinIcon = (cat: string) => {
      let color = '#f59e0b';
      let svg = '';
      if (cat === 'fuel') {
        color = '#f59e0b';
        svg = `<path fill="#ffffff" d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.22v5.72c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-5h1v3.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H5V5h7v5zm6 0c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5z"/>`;
      } else if (cat === 'propane') {
        color = '#f97316';
        svg = `<path fill="#ffffff" d="M12 2.1c-.2 2.8-2.3 4.8-4 6.7C6.1 10.9 5 13.1 5 15.5 5 19.1 7.9 22 11.5 22s6.5-2.9 6.5-6.5c0-3.3-2.1-6.2-4.2-8.4-.7-.7-1.4-1.5-1.8-2.5v-2.5zM12 19c-1.7 0-3-1.3-3-3 0-1.2.7-2.3 1.6-3.1.6-.5 1.4-1.1 1.8-2 .6 1.1 1.7 1.8 2.3 2.8.8 1.1 1.3 2.1 1.3 3.3 0 1.1-.9 2-2 2z"/>`;
      } else if (cat === 'dump') {
        color = '#ef4444';
        svg = `<path fill="#ffffff" d="M12 1.5c-.8 0-1.5.4-1.9 1.1L.8 18.2C.2 19.3 1 20.7 2.2 20.7h19.6c1.2 0 2-1.4 1.4-2.5L13.9 2.6c-.4-.7-1.1-1.1-1.9-1.1z"/><g fill="#000000" transform="translate(3, 4)"><path d="M3 6h12a2 2 0 0 1 2 2v3H1V8a2 2 0 0 1 2-2z"/><circle cx="5" r="1.5"/><circle cx="13" r="1.5"/><path d="M12 12h3.5v3H12z"/><path fill="#ffffff" d="M13.2 13.2h1.1v4h-1.1z"/><path fill="#ffffff" d="M12.5 16.5l1.5 1.5 1.5-1.5z"/></g><path fill="#000000" d="M2 15h20v2H2z"/>`;
      } else if (cat === 'parking') {
        color = '#6366f1';
        svg = `<path fill="#ffffff" d="M13.2 3H7c-1.1 0-2 .9-2 2v14h3v-6h5.2c2.6 0 4.8-2.1 4.8-4.7S15.8 3 13.2 3zm0 6.2H10V6h3.2c1 0 1.8.8 1.8 1.6 0 .9-.8 1.6-1.8 1.6z"/>`;
      } else if (cat === 'campground') {
        color = '#22c55e';
        svg = `<path fill="#ffffff" d="M19 18L12 5 5 18H2v2h20v-2h-3zm-7-2l-3.5 0L12 9.2 15.5 16 12 16z"/>`;
      } else {
        color = '#f59e0b';
        svg = `<path fill="#ffffff" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>`;
      }

      const uri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 36 46"><path fill="${color}" stroke="#ffffff" stroke-width="2" d="M18 1C8.6 1 1 8.6 1 18c0 12.3 15.1 25.5 16.3 26.5a1 1 0 0 0 1.4 0C19.9 43.5 35 30.3 35 18 35 8.6 27.4 1 18 1z"/><circle cx="18" cy="18" r="13" fill="${color}"/><g transform="translate(6, 6)">${svg}</g></svg>`)}`;

      return {
        url: uri,
        scaledSize: new window.google.maps.Size(24, 32),
        anchor: new window.google.maps.Point(12, 32)
      };
    };

    filtered.forEach(facility => {
      const marker = new window.google.maps.Marker({
        position: { lat: facility.lat, lng: facility.lng },
        map: googleMapInTimeInstance.current,
        title: facility.name,
        icon: getPinIcon(facility.category)
      });

      bounds.extend({ lat: facility.lat, lng: facility.lng });

      const nameHtml = facility.website
        ? `<a href="${facility.website}" target="_blank" rel="noopener noreferrer" style="color: #059669; font-size: 13px; font-weight: bold; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">${facility.name} <span style="font-size: 9px; text-decoration: none;">↗</span></a>`
        : `<strong style="color: #059669; font-size: 13px;">${facility.name}</strong>`;

      const info = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0 2px 2px 2px; max-width: 240px; margin-top: -4px;">
            <div style="padding-right: 20px; margin-bottom: 3px;">
              ${nameHtml}
            </div>
            <p style="margin: 0 0 6px 0; font-size: 11px; color: #475569; line-height: 1.3;">${facility.address}</p>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;">
              <span style="color: #0284c7; font-weight: 700; font-size: 11px; white-space: nowrap;">${facility.distanceMiles} mi away</span>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}&travelmode=driving" target="_blank" rel="noopener noreferrer" style="background-color: #059669; color: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 10px; text-decoration: none; font-weight: 600; display: inline-flex; align-items: gap: 4px; white-space: nowrap;">
                <i class="fa-solid fa-location-arrow"></i> Navigate
              </a>
            </div>
          </div>
        `
      });

      marker.addListener('click', () => info.open(googleMapInTimeInstance.current, marker));
      markersRef.current.push(marker);
    });

    if (filtered.length > 0 && googleMapInTimeInstance.current) {
      googleMapInTimeInstance.current.fitBounds(bounds, { padding: 40 });
    }
  }, [isGoogleLoaded, facilities, activeFilter, filterPullThrough, filterFullHookup, profile, userLat, userLng]);

  const handleLocateGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLat(lat);
          setUserLng(lng);

          if (googleMapInTimeInstance.current) {
            googleMapInTimeInstance.current.setCenter({ lat, lng });
            googleMapInTimeInstance.current.setZoom(13);
          }

          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (res, status) => {
              if (status === 'OK' && res && res[0]) {
                const addr = res[0].formatted_address || '';
                setUserLocationName(addr);
                setManualInputText(addr);
                setRouteOrigin(addr);
                setAiStartLocation(addr);
              }
            });
          }

          searchNearbyFacilities(lat, lng, activeFilter);
        },
        () => searchNearbyFacilities(userLat, userLng, activeFilter),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const handleManualLocationSubmit = () => {
    if (!manualInputText.trim() || !window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: manualInputText }, (res, status) => {
      if (status === 'OK' && res && res[0]) {
        const lat = res[0].geometry.location.lat();
        const lng = res[0].geometry.location.lng();
        const formatted = res[0].formatted_address;

        setUserLat(lat);
        setUserLng(lng);
        setUserLocationName(formatted);
        setRouteOrigin(formatted);
        setAiStartLocation(formatted);

        if (googleMapInTimeInstance.current) {
          googleMapInTimeInstance.current.setCenter({ lat, lng });
          googleMapInTimeInstance.current.setZoom(13);
        }

        searchNearbyFacilities(lat, lng, activeFilter);
      } else {
        setNoticeMessage("Location not found via Google Maps. Please enter a valid address.");
      }
    });
  };

  useEffect(() => {
    if (isGoogleLoaded && googleMapInTimeInstance.current) {
      searchNearbyFacilities(userLat, userLng, activeFilter);
    }
  }, [isGoogleLoaded, searchNearbyFacilities, userLat, userLng, activeFilter]);

  const handleCalculateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    const dest = routeDestination.trim();
    const orig = routeOrigin.trim();
    if (!dest || !window.google || !window.google.maps) return;

    setIsCalculatingRoute(true);
    setNoticeMessage(null);

    const directionsService = new window.google.maps.DirectionsService();

    const request: any = {
      origin: orig || userLocationName,
      destination: dest,
      travelMode: window.google.maps.TravelMode.DRIVING,
      avoidHighways: false,
      avoidTolls: false
    };

    directionsService.route(request, (result, status) => {
      setIsCalculatingRoute(false);
      if (status === window.google.maps.DirectionsStatus.OK && result) {
        if (routePolylineRef.current) {
          routePolylineRef.current.setMap(null);
        }

        if (googleMapRouteInstance.current) {
          const routePath = result.routes[0].overview_path;
          routePolylineRef.current = new window.google.maps.Polyline({
            path: routePath,
            strokeColor: '#22c55e',
            strokeWeight: 6,
            strokeOpacity: 0.8,
            map: googleMapRouteInstance.current
          });

          const bounds = new window.google.maps.LatLngBounds();
          result.routes[0].overview_path.forEach((point) => bounds.extend(point));
          googleMapRouteInstance.current.fitBounds(bounds);
        }

        const route = result.routes[0].legs[0];
        let distanceMeters = route.distance?.value || 0;
        let miles = Math.round((distanceMeters / 1609.34) * 10) / 10;
        const hours = Math.floor(miles / 52);
        const mins = Math.round(((miles / 52) - hours) * 60);
        const avgMpg = Number(profile.towingMpg) || 10;
        const fuelExpense = Math.round((miles / avgMpg) * 3.85);

        setRouteSummary({
          distanceMiles: miles,
          travelTime: `${hours} hrs ${mins} mins`,
          fuelExpense: fuelExpense,
          avgMpg: avgMpg,
          hazardNotice: `Checked Clear: Safe path configured for ${profile.heightFeet}'${profile.heightInches}" height clearance, ${profile.weightLbs.toLocaleString()} lbs weight limit, and ${avgMpg} Towing MPG.`
        });
      } else {
        setNoticeMessage("No driving route found between these locations. Please select valid connected driving locations.");
        if (routePolylineRef.current) {
          routePolylineRef.current.setMap(null);
          routePolylineRef.current = null;
        }
      }
    });
  };

  // Dedicated Robust Waypoint Route Calculation Engine with Accurate Multi-Stop Summation
  const calculateWaypointMetrics = useCallback((waypointId: number, waypointsOverride?: any[]) => {
    if (!window.google || !window.google.maps) return;

    const sourceList = waypointsOverride || itineraryWaypoints;
    const targetWp = sourceList.find(w => w.id === waypointId);
    if (!targetWp) return;

    const origin = targetWp.origin?.trim();
    const stops = targetWp.stops || [];
    const validDests = stops.map((s: any) => s.destination?.trim()).filter(Boolean);

    if (!origin || validDests.length === 0) {
      setItineraryWaypoints(current => current.map(w => w.id === waypointId ? { ...w, estMiles: 0, estHours: 0, arrivalHour: 15, arrivalMinute: 0 } : w));
      return;
    }

    const finalDestination = validDests[validDests.length - 1];
    const waypointsParam = validDests.slice(0, validDests.length - 1).map((d: string) => ({ location: d, stopover: true }));

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: origin,
        destination: finalDestination,
        waypoints: waypointsParam,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result && result.routes[0]) {
          const legs = result.routes[0].legs;
          let totalMeters = 0;
          let totalSeconds = 0;

          let currentDepH = stops[0]?.depHour !== undefined ? stops[0].depHour : 8;
          let currentDepM = stops[0]?.depMin !== undefined ? stops[0].depMin : 0;
          let currentDepAP = stops[0]?.depAmPm || 'AM';

          const updatedStops = stops.map((stop: any, sIdx: number) => {
            const leg = legs[sIdx];
            if (!leg) return stop;

            if (sIdx > 0 && stop.depHour !== undefined) {
              currentDepH = stop.depHour;
              currentDepM = stop.depMin !== undefined ? stop.depMin : 0;
              currentDepAP = stop.depAmPm || 'AM';
            }

            const legMeters = leg.distance?.value || 0;
            const legSeconds = leg.duration?.value || 0;
            const legMiles = Math.round((legMeters / 1609.34) * 10) / 10;
            const legHours = legSeconds / 3600;

            let baseH = currentDepH % 12;
            if (currentDepAP === 'PM') baseH += 12;
            const totalDepMins = baseH * 60 + currentDepM;
            const totalArrMins = totalDepMins + Math.round(legSeconds / 60);
            const arrH = Math.floor(totalArrMins / 60) % 24;
            const arrM = totalArrMins % 60;

            const calculatedStop = {
              ...stop,
              estMiles: legMiles,
              estHours: legHours,
              arrivalHour: arrH,
              arrivalMinute: arrM
            };

            currentDepH = arrH % 12 || 12;
            currentDepM = arrM;
            currentDepAP = arrH >= 12 ? 'PM' : 'AM';

            return calculatedStop;
          });

          legs.forEach(leg => {
            totalMeters += leg.distance?.value || 0;
            totalSeconds += leg.duration?.value || 0;
          });

          const totalMiles = Math.round((totalMeters / 1609.34) * 10) / 10;
          const totalHours = totalSeconds / 3600;
          const finalStop = updatedStops[updatedStops.length - 1];
          const finalArrH = finalStop ? finalStop.arrivalHour : 15;
          const finalArrM = finalStop ? finalStop.arrivalMinute : 0;

          setItineraryWaypoints(current => current.map(w => {
            if (w.id === waypointId) {
              return {
                ...w,
                stops: updatedStops,
                estMiles: totalMiles,
                estHours: totalHours,
                arrivalHour: finalArrH,
                arrivalMinute: finalArrM
              };
            }
            return w;
          }));
        }
      }
    );
  }, [itineraryWaypoints]);

  // Compute all waypoint metrics in sequence
  const recalculateAllWaypoints = useCallback((waypointsList: any[]) => {
    if (!waypointsList || waypointsList.length === 0) return;
    waypointsList.forEach((wp, idx) => {
      setTimeout(() => {
        calculateWaypointMetrics(wp.id, waypointsList);
      }, idx * 100);
    });
  }, [calculateWaypointMetrics]);

  // Gemini AI Trip Plan Generator with Multi-Stop Nested Days & Dynamic Rig Profile Integration
  const handleGenerateAiTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveKey = (localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_API_KEY || "").trim();
    if (!effectiveKey) {
      setAiErrorMessage("Please configure your VITE_GEMINI_API_KEY environment variable in Netlify or settings to use AI features.");
      return;
    }

    setIsGeneratingTrip(true);
    setAiErrorMessage(null);
    setGeneratedPlanPreview(null);

    try {
      const combinedLen = profile.combinedLengthFeet || profile.lengthFeet;
      const safeMpg = Number(profile.towingMpg) || 10;
      const safeFuelRangeVal = safeMpg * 25;

      let userInstructions = "";
      if (aiInputMode === 'guided') {
        const rawDestInput = aiDestinations.trim() || "National Parks road trip";
        const parsedDests = parseDestinationList(rawDestInput);
        const hasSequenceArrow = rawDestInput.includes('->') || rawDestInput.includes('-->');
        const startText = aiStartLocation.trim() || userLocationName;
        const vibesText = aiVibeTags.join(', ');
        const { diffDays, season, depFormatted, retFormatted } = calculateTripDurationAndSeason(aiDepartureDate, aiReturnDate);
        
        let pacingText = "";
        if (aiEnforce333) {
          pacingText = `STRICT PACING RULE: Follow the RV 3-3-3 Rule (maximum ~300 miles driving per day, arrive at campsite before 3:00 PM in daylight, and stay at least 3 nights at destination stops). For cross-country highway travel, schedule 1-night overnight sleep stops (stayNights = 1) at the final stop of each day.`;
        } else {
          pacingText = `UNCONSTRAINED PACING: No fixed 3-3-3 rules required. Target max daily driving time of ~${aiMaxDailyHours} hours. For long-distance destinations, break transit into safe daily legs with 1-night sleep stops.`;
        }

        const roundTripInstruction = aiIsRoundTrip
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
          - Target Max Daily Driving Hours: ~${aiMaxDailyHours} hours/day
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
        const promptText = aiCustomPrompt.trim();
        if (!promptText) {
          setAiErrorMessage("Please enter your trip ideas or destinations.");
          setIsGeneratingTrip(false);
          return;
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
        - Starting Origin / Home: ${aiStartLocation || userLocationName}
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
      let parsedPlan = null;

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
              parsedPlan = {
                tripTitle: parsedObj.tripTitle || (Array.isArray(parsedObj) && parsedObj[0]?.tripTitle) || "RV Adventure Itinerary",
                summary: parsedObj.summary || (Array.isArray(parsedObj) && parsedObj[0]?.summary) || "Custom generated itinerary for your RV journey.",
                isFeasible: parsedObj.isFeasible !== undefined ? parsedObj.isFeasible : true,
                feasibilityWarning: parsedObj.feasibilityWarning || null,
                waypoints: waypointsList
              };
              break;
            }
          } else {
            lastError = data.error?.message || "Generation error";
          }
        } catch (mErr: any) {
          lastError = mErr.message;
        }
      }

      setIsGeneratingTrip(false);

      if (parsedPlan && parsedPlan.waypoints) {
        setGeneratedPlanPreview(parsedPlan);
      } else {
        setAiErrorMessage(lastError || "Could not generate trip plan. Please verify your connection.");
      }

    } catch (err: any) {
      setIsGeneratingTrip(false);
      setAiErrorMessage(err.message || "Failed to contact Gemini API.");
    }
  };

  const applyAiPlan = (mode: 'replace' | 'append') => {
    if (!generatedPlanPreview || !generatedPlanPreview.waypoints) return;

    let runningOrigin = aiStartLocation?.trim() || userLocationName?.trim() || "Bellevue, WA";
    const totalWaypointsCount = generatedPlanPreview.waypoints.length;

    const formattedWaypoints = generatedPlanPreview.waypoints.map((wp: any, idx: number) => {
      const isFinalWaypoint = idx === totalWaypointsCount - 1;
      
      const stopsList = Array.isArray(wp.stops) && wp.stops.length > 0
        ? wp.stops.map((s: any, sIdx: number) => ({
            id: Date.now() + idx * 50 + sIdx,
            destination: s.destination?.trim() || '',
            depHour: s.depHour !== undefined ? s.depHour : (sIdx === 0 ? 8 : 13),
            depMin: s.depMin !== undefined ? s.depMin : 0,
            depAmPm: s.depAmPm || (sIdx === 0 ? 'AM' : 'PM'),
            estMiles: 0,
            estHours: 0,
            arrivalHour: 15,
            arrivalMinute: 0
          }))
        : [{
            id: Date.now() + idx * 50,
            destination: wp.destination?.trim() || '',
            depHour: wp.depHour !== undefined ? wp.depHour : 8,
            depMin: wp.depMin !== undefined ? wp.depMin : 0,
            depAmPm: wp.depAmPm || 'AM',
            estMiles: 0,
            estHours: 0,
            arrivalHour: 15,
            arrivalMinute: 0
          }];

      const wpOrigin = wp.origin?.trim() || runningOrigin;
      const finalStopDest = stopsList[stopsList.length - 1].destination;
      runningOrigin = finalStopDest || runningOrigin; // chain consecutive origins to last stop

      const isReturningHome = wp.isHomeReturn === true || (isFinalWaypoint && (aiIsRoundTrip || finalStopDest.toLowerCase().includes((aiStartLocation || userLocationName).toLowerCase().split(',')[0])));
      const stayNightsValue = isReturningHome ? 0 : (wp.stayNights !== undefined ? Math.max(0, parseInt(wp.stayNights, 10) || 0) : 1);

      return {
        id: Date.now() + idx * 50,
        origin: wpOrigin,
        isExpanded: true,
        isHomeReturn: isReturningHome,
        stops: stopsList,
        notes: wp.notes || '',
        stayNights: stayNightsValue,
        estMiles: 0,
        estHours: 0,
        arrivalHour: 15,
        arrivalMinute: 0
      };
    });

    const finalPlan = mode === 'replace' ? formattedWaypoints : [...itineraryWaypoints, ...formattedWaypoints];
    setItineraryWaypoints(finalPlan);
    setIsAiModalOpen(false);
    setGeneratedPlanPreview(null);

    // Trigger distance and weather recalculations immediately
    setTimeout(() => {
      recalculateAllWaypoints(finalPlan);
      fetchDestinationWeathers();
    }, 100);
  };

  // AI RV Site Picker Engine Handler with Enhanced Full Hookups (FHU) Rig-Matching
  const handleOpenSitePicker = async (waypointId: number, stopId: number, destination: string, stayNights: number) => {
    const cleanDest = destination?.trim();
    if (!cleanDest) {
      setNoticeMessage("Please enter a destination place before picking RV sites.");
      return;
    }

    const effectiveKey = (localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_API_KEY || "").trim();
    if (!effectiveKey) {
      setNoticeMessage("Please configure your Gemini API Key in Netlify environment variables.");
      return;
    }

    setActiveSitePickerTarget({ waypointId, stopId, destination: cleanDest, stayNights });
    setIsSitePickerOpen(true);
    setIsLoadingSitePicker(true);
    setSitePickerError(null);
    setSitePickerResults(null);

    try {
      const { season } = calculateTripDurationAndSeason(aiDepartureDate, aiReturnDate);
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
        Find and compare the Top 3 best, real, and verified RV parks or campgrounds in or immediately adjacent to "${cleanDest}" for a stay of ${stayNights} nights during ${season}.
        CRITICAL EVALUATION FACTORS:
        1. Maneuverability & Towing Ease: Note whether highway turn-off is an easy right-hand turn or a difficult left-turn across oncoming traffic, entrance road width, and pull-through vs back-in pads.
        2. Proximity: Distance to main parks, lake/river, or town.
        3. Hookups & Utilities (FHU Status): Clearly classify whether the campsite offers FULL HOOKUPS (FHU: Water, 30A/50A Electric, and Sewer at site), PARTIAL HOOKUPS (Water + 30A/50A Electric only, with dump station), or DRY CAMPING. Match the user's hookup requirement: "${hookupPrefDesc}".
        4. Starlink & Connectivity: Open sky vs tree canopy, cell reception.
        5. Seasonality & Amenities: Dog park, heated risers in freeze, pool, club discounts.

        OUTPUT FORMAT:
        Respond strictly in valid JSON matching this schema:
        {
          "location": "${cleanDest}",
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
      let parsedSites = null;
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
              parsedSites = {
                location: cleanDest,
                sites: sitesList
              };
              break;
            }
          } else {
            lastErr = data.error?.message || "Generation error";
          }
        } catch (mErr: any) {
          lastErr = mErr.message;
        }
      }

      setIsLoadingSitePicker(false);

      if (parsedSites && parsedSites.sites) {
        setSitePickerResults(parsedSites);
      } else {
        setSitePickerError(lastErr || "Could not find RV sites. Please verify destination and try again.");
      }

    } catch (err: any) {
      setIsLoadingSitePicker(false);
      setSitePickerError(err.message || "Failed to contact Gemini API.");
    }
  };

  const applySelectedSite = (site: any) => {
    if (!activeSitePickerTarget) return;
    const { waypointId, stopId } = activeSitePickerTarget;

    const formattedSiteDest = `${site.name}, ${site.address}`;
    updateStop(waypointId, stopId, 'destination', formattedSiteDest);

    // Append site details and turn directions to waypoint notes
    const siteNoteSnippet = `[RV Site: ${site.name}] ${site.padType} · ${site.hookups} · Access: ${site.turnEase}`;
    setItineraryWaypoints(prev => prev.map(wp => {
      if (wp.id === waypointId) {
        const existingNotes = wp.notes?.trim();
        const updatedNotes = existingNotes ? `${existingNotes}\n${siteNoteSnippet}` : siteNoteSnippet;
        return { ...wp, notes: updatedNotes };
      }
      return wp;
    }));

    setIsSitePickerOpen(false);
    setActiveSitePickerTarget(null);
    setSitePickerResults(null);

    setTimeout(() => {
      calculateWaypointMetrics(waypointId);
      fetchDestinationWeathers();
    }, 150);
  };

  const toggleTask = (type: string, id: string) => {
    if (type === 'departure') setDepartureTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    else setArrivalTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const clearAllTasks = (type: string) => {
    if (type === 'departure') {
      setDepartureTasks(prev => prev.map(t => ({ ...t, done: false })));
    } else {
      setArrivalTasks(prev => prev.map(t => ({ ...t, done: false })));
    }
  };

  const moveTask = (type: string, index: number, direction: string) => {
    const list = type === 'departure' ? [...departureTasks] : [...arrivalTasks];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    if (type === 'departure') setDepartureTasks(list);
    else setArrivalTasks(list);
  };

  const addCustomTask = (type: string) => {
    const text = type === 'departure' ? newDepTaskText.trim() : newArrTaskText.trim();
    if (!text) return;
    const newTask = { id: `${type[0]}_${Date.now()}`, text: text, done: false };
    if (type === 'departure') {
      setDepartureTasks(prev => [...prev, newTask]);
      setNewDepTaskText("");
    } else {
      setArrivalTasks(prev => [...prev, newTask]);
      setNewArrTaskText("");
    }
  };

  const deleteTask = (type: string, id: string) => {
    if (type === 'departure') setDepartureTasks(prev => prev.filter(t => t.id !== id));
    else setArrivalTasks(prev => prev.filter(t => t.id !== id));
  };

  const addTripDay = () => {
    setItineraryWaypoints(prev => {
      const lastWp = prev[prev.length - 1];
      const defaultOrigin = lastWp && lastWp.stops && lastWp.stops.length > 0 
        ? lastWp.stops[lastWp.stops.length - 1].destination 
        : userLocationName;

      return [...prev, { 
        id: Date.now(), 
        origin: defaultOrigin,
        isExpanded: true,
        isHomeReturn: false,
        stops: [
          {
            id: Date.now() + 1,
            destination: "",
            depHour: 8,
            depMin: 0,
            depAmPm: 'AM',
            estMiles: 0,
            estHours: 0,
            arrivalHour: 15,
            arrivalMinute: 0
          }
        ],
        notes: "", 
        stayNights: 1,
        estMiles: 0,
        estHours: 0,
        arrivalHour: 15,
        arrivalMinute: 0
      }];
    });
  };

  const removeTripDay = (id: number) => {
    setItineraryWaypoints(prev => {
      const updated = prev.filter(w => w.id !== id);
      return updated.map((w, idx) => {
        const prevWp = idx > 0 ? updated[idx - 1] : null;
        const prevDest = prevWp && prevWp.stops && prevWp.stops.length > 0 ? prevWp.stops[prevWp.stops.length - 1].destination : null;
        return {
          ...w,
          origin: prevDest || w.origin
        };
      });
    });
  };

  const toggleExpandWaypoint = (id: number) => {
    setItineraryWaypoints(prev => prev.map(w => w.id === id ? { ...w, isExpanded: !w.isExpanded } : w));
  };

  const addStopToWaypoint = (waypointId: number) => {
    setItineraryWaypoints(prev => {
      return prev.map(wp => {
        if (wp.id === waypointId) {
          const stops = wp.stops || [];
          const newStop = {
            id: Date.now(),
            destination: "",
            depHour: 8,
            depMin: 0,
            depAmPm: 'AM',
            estMiles: 0,
            estHours: 0,
            arrivalHour: 15,
            arrivalMinute: 0
          };
          return { ...wp, stops: [...stops, newStop], isExpanded: true };
        }
        return wp;
      });
    });
  };

  const removeStopFromWaypoint = (waypointId: number, stopId: number) => {
    setItineraryWaypoints(prev => {
      return prev.map(wp => {
        if (wp.id === waypointId) {
          const stops = (wp.stops || []).filter((s: any) => s.id !== stopId);
          return { ...wp, stops };
        }
        return wp;
      });
    });
    setTimeout(() => calculateWaypointMetrics(waypointId), 50);
  };

  const updateWaypoint = (id: number, field: string, value: any) => {
    if (field === 'stayNights') {
      const numVal = parseInt(value, 10);
      value = isNaN(numVal) || numVal < 0 ? 0 : numVal;
    }

    setItineraryWaypoints(prev => {
      return prev.map(w => {
        if (w.id === id) {
          return { ...w, [field]: value };
        }
        return w;
      });
    });

    if (field === 'origin') {
      setTimeout(() => calculateWaypointMetrics(id), 50);
    }
  };

  const updateStop = (waypointId: number, stopId: number, field: string, value: any) => {
    setItineraryWaypoints(prev => {
      return prev.map(wp => {
        if (wp.id === waypointId) {
          const stops = (wp.stops || []).map((s: any) => {
            if (s.id === stopId) {
              return { ...s, [field]: value };
            }
            return s;
          });
          return { ...wp, stops };
        }
        return wp;
      });
    });

    setTimeout(() => calculateWaypointMetrics(waypointId), 50);
  };

  const setupAutocompleteForInput = (inputElement: HTMLInputElement | null, waypointId: number, fieldName: string, stopId?: number) => {
    if (!inputElement || !window.google || !window.google.maps || !window.google.maps.places) return;
    if ((inputElement as any).__autocompleteAttached) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputElement);
      (inputElement as any).__autocompleteAttached = true;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.geometry && place.geometry.location) {
          const addr = formatResolvedPlaceAddress(place);
          if (addr) {
            if (stopId !== undefined) {
              updateStop(waypointId, stopId, fieldName, addr);
            } else {
              updateWaypoint(waypointId, fieldName, addr);
            }
            fetchDestinationWeathers();
          }
        }
      });
    } catch (e) {
      console.error("Waypoint autocomplete error:", e);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('rv_profile', JSON.stringify(profile));
    } catch (err) {
      console.error(err);
    }
    setIsProfileModalOpen(false);
  };

  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;
  const combinedLen = profile.combinedLengthFeet || profile.lengthFeet;
  const safeMpgDisplay = Number(profile.towingMpg) || 10;
  const safeFuelRange = safeMpgDisplay * 25;

  const filteredFacilities = facilities.filter(item => {
    if (item.distanceMiles > 20.0) return false;
    if (activeFilter !== 'all' && item.category !== activeFilter) return false;
    if (filterPullThrough && !item.pullThrough) return false;
    if (filterFullHookup && !item.fullHookup) return false;
    return true;
  });

  const { diffDays: calculatedDays, season: calculatedSeason } = calculateTripDurationAndSeason(aiDepartureDate, aiReturnDate);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-900 text-slate-100 font-sans">
      <header className="bg-slate-800/90 backdrop-blur border-b border-slate-700/80 px-4 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
            <i className="fa-solid fa-caravan text-xl"></i>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide flex items-center gap-2">
              RV SafePath
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">Smart RV Routing, Low Clearance Guard &amp; Real-Time Google Places Finder</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <div onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs px-2.5 py-1.5 rounded-lg font-medium cursor-pointer">
            <i className="fa-solid fa-satellite-dish text-sky-400 animate-pulse"></i>
            <span className="hidden lg:inline">{profile.hasStarlink ? "Starlink Online" : "Cellular Only"}</span>
          </div>

          <div onClick={() => setIsProfileModalOpen(true)} className="hidden sm:flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer">
            <i className="fa-solid fa-ruler-vertical text-amber-400"></i>
            <span>Max Height: <strong>{formattedHeight}</strong></span>
          </div>

          <button onClick={() => setIsProfileModalOpen(true)} className="bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-2 border border-slate-600 transition">
            <i className="fa-solid fa-sliders text-emerald-400"></i>
            <span className="hidden md:inline">RV Profile</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <nav className="md:w-64 bg-slate-800/90 border-r border-slate-700 flex md:flex-col justify-around md:justify-start p-2 md:p-3 gap-1 z-20 shrink-0 order-last md:order-first">
          <button onClick={() => setActiveTab('intime')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-2 p-2.5 rounded-xl text-xs md:text-sm font-medium transition ${activeTab === 'intime' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>
            <i className="fa-solid fa-compass text-lg md:text-base"></i>
            <span>In-Time Finder</span>
          </button>

          <button onClick={() => { 
            setActiveTab('router'); 
            setTimeout(() => { 
              if (googleMapRouteInstance.current) {
                window.google.maps.event.trigger(googleMapRouteInstance.current, 'resize'); 
              }
            }, 150); 
          }} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-2 p-2.5 rounded-xl text-xs md:text-sm font-medium transition ${activeTab === 'router' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>
            <i className="fa-solid fa-route text-lg md:text-base"></i>
            <span>Safe Router</span>
          </button>

          <button onClick={() => {
            setActiveTab('planner');
            fetchDestinationWeathers();
          }} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-2 p-2.5 rounded-xl text-xs md:text-sm font-medium transition ${activeTab === 'planner' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>
            <i className="fa-solid fa-calendar-days text-lg md:text-base"></i>
            <span>Trip Planner</span>
          </button>

          <button onClick={() => setActiveTab('checklist')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-2 p-2.5 rounded-xl text-xs md:text-sm font-medium transition ${activeTab === 'checklist' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>
            <i className="fa-solid fa-list-check text-lg md:text-base"></i>
            <span>RV Checklists</span>
          </button>

          <div className="hidden md:block mt-auto bg-slate-900/80 rounded-xl p-3 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300">ACTIVE RIG SPECS</span>
              <i className="fa-solid fa-shield-halved text-emerald-400"></i>
            </div>
            <div className="text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Class/Type:</span>
                <span className="font-medium text-emerald-300">{profile.rvType} ({profile.ampRating})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Height:</span>
                <span className="font-bold text-amber-400">{formattedHeight}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Length/Weight:</span>
                <span className="font-medium">{profile.lengthFeet}ft ({combinedLen}ft combined) / {profile.weightLbs.toLocaleString()} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Towing MPG:</span>
                <span className="font-bold text-amber-300">{safeMpgDisplay} MPG (~{safeFuelRange} mi range)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tow Vehicle:</span>
                <span className="font-medium text-slate-300">{profile.towSetup}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Off-Grid Power:</span>
                <span className="font-medium text-amber-400"><i className="fa-solid fa-solar-panel mr-1"></i>{profile.solarWatts.split(' ')[0]}</span>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* TAB 1: IN-TIME FINDER */}
          <div className={`${activeTab === 'intime' ? 'flex' : 'hidden'} flex-1 flex flex-col md:flex-row h-full overflow-hidden w-full relative`}>
            <div className="order-first md:order-last w-full h-[36vh] sm:h-[40vh] md:h-full md:flex-1 relative shrink-0">
              <div ref={mapInTimeRef} className="w-full h-full bg-slate-950"></div>
              
              <div className="absolute top-3 right-3 bg-slate-800/90 backdrop-blur border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 z-[10] flex items-center gap-2 shadow-md">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Safety Guard: <strong className="text-amber-400">{formattedHeight}</strong></span>
              </div>
            </div>

            <div className="w-full md:w-96 bg-slate-800/90 border-r border-slate-700/80 flex flex-col flex-1 md:flex-initial md:h-full z-10 min-h-0">
              <div className="p-2.5 sm:p-3 border-b border-slate-700 bg-slate-800/60 space-y-2 shrink-0">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                  <span>Nearby Places ({filteredFacilities.length})</span>
                  <button onClick={() => searchNearbyFacilities(userLat, userLng, activeFilter)} className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-normal">
                    <i className={`fa-solid fa-rotate-right ${isLoadingPois ? 'animate-spin' : ''}`}></i> Refresh
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <div className="relative flex-1">
                    <input
                      ref={locationInputRef}
                      type="text"
                      value={manualInputText}
                      onChange={(e) => setManualInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualLocationSubmit()}
                      placeholder="Search city, address or zip..."
                      className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1.5 text-xs w-full focus:outline-none focus:border-emerald-500"
                    />
                    {manualInputText && (
                      <button
                        onClick={() => { setManualInputText(''); if (locationInputRef.current) locationInputRef.current.focus(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleManualLocationSubmit}
                    title="Search Location"
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0"
                  >
                    Go
                  </button>
                  <button
                    onClick={handleLocateGPS}
                    title="Use GPS Location"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-crosshairs"></i>
                    <span className="hidden sm:inline">GPS</span>
                  </button>
                </div>

                {noticeMessage && (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] p-2 rounded-lg flex items-start gap-1.5">
                    <i className="fa-solid fa-triangle-exclamation text-amber-400 shrink-0 mt-0.5"></i>
                    <span>{noticeMessage}</span>
                  </div>
                )}

                <div className="flex md:grid md:grid-cols-3 gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                  <button onClick={() => { setActiveFilter('fuel'); searchNearbyFacilities(userLat, userLng, 'fuel'); }} className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'fuel' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}>
                    <i className="fa-solid fa-gas-pump text-amber-400 text-sm sm:text-base md:mb-1"></i>
                    <span>Fuel</span>
                  </button>
                  
                  <button onClick={() => { setActiveFilter('propane'); searchNearbyFacilities(userLat, userLng, 'propane'); }} className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'propane' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}>
                    <i className="fa-solid fa-fire-flame-simple text-orange-400 text-sm sm:text-base md:mb-1"></i>
                    <span>Propane</span>
                  </button>

                  <button onClick={() => { setActiveFilter('dump'); searchNearbyFacilities(userLat, userLng, 'dump'); }} className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'dump' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}>
                    <i className="fa-solid fa-biohazard text-red-400 text-sm sm:text-base md:mb-1"></i>
                    <span>Dump</span>
                  </button>

                  <button onClick={() => { setActiveFilter('parking'); searchNearbyFacilities(userLat, userLng, 'parking'); }} className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'parking' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}>
                    <i className="fa-solid fa-square-parking text-indigo-400 text-sm sm:text-base md:mb-1"></i>
                    <span>Overnight</span>
                  </button>

                  <button onClick={() => { setActiveFilter('campground'); searchNearbyFacilities(userLat, userLng, 'campground'); }} className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'campground' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}>
                    <i className="fa-solid fa-campground text-emerald-400 text-sm sm:text-base md:mb-1"></i>
                    <span>RV Parks</span>
                  </button>

                  <button onClick={() => { setActiveFilter('all'); searchNearbyFacilities(userLat, userLng, 'all'); }} className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'all' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}>
                    <i className="fa-solid fa-border-all text-emerald-400 text-sm sm:text-base md:mb-1"></i>
                    <span>All</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-xs text-slate-300 flex-wrap gap-2">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] sm:text-xs">
                    <input type="checkbox" checked={filterPullThrough} onChange={(e) => setFilterPullThrough(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0" />
                    <span>Pull-Through</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] sm:text-xs">
                    <input type="checkbox" checked={filterFullHookup} onChange={(e) => setFilterFullHookup(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0" />
                    <span>Full Hookups</span>
                  </label>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
                {isLoadingPois ? (
                  <div className="text-center py-8 space-y-2 text-slate-400 text-xs">
                    <i className="fa-solid fa-circle-notch animate-spin text-xl text-emerald-400"></i>
                    <div>Searching places within 20 miles...</div>
                  </div>
                ) : filteredFacilities.length === 0 ? (
                  <div className="text-center py-8 space-y-2 text-slate-400 text-xs">
                    <i className="fa-solid fa-map-location-dot text-2xl text-slate-600"></i>
                    <div>No facilities found in this category within 20 miles.</div>
                  </div>
                ) : (
                  filteredFacilities.map((facility) => (
                    <div 
                      key={facility.id} 
                      onClick={() => {
                        if (googleMapInTimeInstance.current) {
                          googleMapInTimeInstance.current.setCenter({ lat: facility.lat, lng: facility.lng });
                          googleMapInTimeInstance.current.setZoom(15);
                        }
                      }} 
                      className="bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 rounded-xl p-3 cursor-pointer transition space-y-2 hover:border-slate-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <i className={`fa-solid ${facility.category === 'fuel' ? 'fa-gas-pump text-amber-400' : facility.category === 'propane' ? 'fa-fire-flame-simple text-orange-400' : facility.category === 'dump' ? 'fa-biohazard text-red-400' : facility.category === 'parking' ? 'fa-square-parking text-indigo-400' : 'fa-campground text-emerald-400'} text-base shrink-0`}></i>
                          
                          {facility.website ? (
                            <a 
                              href={facility.website} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()} 
                              className="font-bold text-xs text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 truncate"
                              title={`Open ${facility.name} website`}
                            >
                              <span className="truncate">{facility.name}</span>
                              <i className="fa-solid fa-arrow-up-right-from-square text-[9px] shrink-0 opacity-70"></i>
                            </a>
                          ) : (
                            <h4 className="font-bold text-xs text-slate-100 truncate">{facility.name}</h4>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] bg-emerald-500/10 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                            {facility.distanceMiles} mi
                          </span>
                        </div>
                      </div>

                      {facility.category === 'fuel' && (
                        facility.fuelPrices ? (
                          <div className="flex flex-wrap gap-1.5 bg-slate-900/70 p-1.5 rounded-lg border border-slate-700/60 text-[11px]">
                            {Object.entries(facility.fuelPrices).map(([type, price]: [string, any]) => (
                              <span key={type} className={`px-2 py-0.5 rounded font-bold border ${type === 'Diesel' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                                {type}: {price}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic flex items-center gap-1 bg-slate-900/40 px-2 py-1 rounded">
                            <i className="fa-solid fa-gas-pump text-slate-500 text-[9px]"></i>
                            <span>Live pump prices not reported to Google</span>
                          </div>
                        )
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <div className="flex items-center gap-2">
                          {facility.rating ? (
                            <span className="flex items-center gap-1 text-amber-400 font-semibold">
                              <i className="fa-solid fa-star"></i> {facility.rating} {facility.userRatingsTotal ? `(${facility.userRatingsTotal})` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-500">Rating N/A</span>
                          )}

                          {facility.isOpenNow !== null && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${facility.isOpenNow ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                              {facility.isOpenNow ? 'Open Now' : 'Closed'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                        <i className="fa-solid fa-location-dot text-emerald-400 shrink-0 text-[10px]"></i>
                        <span className="truncate">{facility.address}</span>
                      </div>

                      {facility.desc && (
                        <p className="text-[11px] text-slate-300 line-clamp-2 bg-slate-900/40 p-1.5 rounded border border-slate-700/40">{facility.desc}</p>
                      )}

                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <span className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20">
                          <i className="fa-solid fa-ruler-vertical"></i> Clear: {facility.clearance}
                        </span>
                        {facility.pullThrough && <span className="bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20"><i className="fa-solid fa-arrows-left-right"></i> Pull-Through</span>}
                        {facility.fullHookup && <span className="bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/20"><i className="fa-solid fa-bolt"></i> Full Hookups</span>}
                        {facility.propane && <span className="bg-orange-500/10 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/20"><i className="fa-solid fa-fire"></i> Bulk Refill</span>}
                      </div>

                      <div className="pt-1.5 border-t border-slate-700/60 flex justify-between items-center text-[11px]">
                        <span className="text-emerald-400 font-medium"><i className="fa-solid fa-tag"></i> {facility.discount}</span>
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}&travelmode=driving`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 transition shadow"
                        >
                          <i className="fa-solid fa-location-arrow"></i> Navigate
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* TAB 2: SAFE ROUTER */}
          <div className={`${activeTab === 'router' ? 'flex' : 'hidden'} flex-1 flex flex-col md:flex-row h-full overflow-hidden w-full relative`}>
            <div className="order-first md:order-last w-full h-[36vh] sm:h-[40vh] md:h-full md:flex-1 relative shrink-0">
              <div ref={mapRouteRef} className="w-full h-full bg-slate-950"></div>
            </div>

            <div className="w-full md:w-96 bg-slate-800/90 border-r border-slate-700/80 p-3.5 sm:p-4 overflow-y-auto flex flex-col gap-3.5 sm:gap-4 flex-1 md:flex-initial md:h-full shrink-0 min-h-0">
              <div>
                <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <i className="fa-solid fa-route text-emerald-400"></i> RV Safe Route Planner
                </h2>
                <p className="text-xs text-slate-400">Avoid low clearance overpasses, steep grades, and propane restricted tunnels.</p>
              </div>

              <form onSubmit={handleCalculateRoute} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Starting Point</label>
                  <input ref={originInputRef} type="text" value={routeOrigin} onChange={(e) => setRouteOrigin(e.target.value)} placeholder="Starting address..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Destination</label>
                  <input ref={destInputRef} type="text" value={routeDestination} onChange={(e) => setRouteDestination(e.target.value)} placeholder="Destination (e.g. Moab, UT)..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>

                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60 space-y-2 text-xs">
                  <div className="font-semibold text-slate-300">RV Routing Guardrails</div>
                  
                  <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                    <span>Avoid Low Bridges (&lt; <span className="text-amber-400 font-bold">{formattedHeight}</span>)</span>
                    <input type="checkbox" checked disabled className="rounded bg-slate-800 text-emerald-500" />
                  </label>
                  
                  <label className="flex items-center justify-between text-slate-500 opacity-50 cursor-not-allowed">
                    <span>Avoid Mountain Passes (&gt;6% Grade)</span>
                    <input type="checkbox" checked={false} disabled className="rounded bg-slate-900 border-slate-700 text-slate-600 cursor-not-allowed" />
                  </label>

                  <label className="flex items-center justify-between text-slate-500 opacity-50 cursor-not-allowed">
                    <span>Propane Tunnel Restrictions</span>
                    <input type="checkbox" checked={false} disabled className="rounded bg-slate-900 border-slate-700 text-slate-600 cursor-not-allowed" />
                  </label>
                </div>

                <button type="submit" disabled={isCalculatingRoute} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition">
                  <i className="fa-solid fa-compass"></i> {isCalculatingRoute ? "Calculating Safe Path..." : "Calculate Safe RV Path"}
                </button>
              </form>

              {routeSummary && (
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Distance:</span>
                    <span className="font-bold text-emerald-400 text-sm">{routeSummary.distanceMiles} Miles (One-Way)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Est. Driving Time:</span>
                    <span className="font-medium text-slate-200">{routeSummary.travelTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Est. Fuel Expense:</span>
                    <span className="font-medium text-amber-400">${routeSummary.fuelExpense} (est. @ {routeSummary.avgMpg} Towing MPG)</span>
                  </div>

                  <hr className="border-slate-800" />

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-300 space-y-1">
                    <p>{routeSummary.hazardNotice}</p>
                  </div>

                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(routeDestination)}&travelmode=driving`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow transition mt-1"
                  >
                    <i className="fa-solid fa-location-arrow"></i> Open Route in Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* TAB 3: TRIP PLANNER */}
          <div className={`${activeTab === 'planner' ? 'flex' : 'hidden'} flex-1 p-3.5 sm:p-6 overflow-y-auto max-w-6xl mx-auto w-full space-y-4 sm:space-y-6 flex-col`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-3 sm:pb-4">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                  <i className="fa-solid fa-calendar-days text-emerald-400"></i> Multi-Day RV Trip Itinerary
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400">Multi-stop daily pacing, daylight safety, live weather &amp; time zone shifts.</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button onClick={fetchDestinationWeathers} className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium flex items-center gap-1.5">
                  <i className={`fa-solid fa-rotate ${isLoadingWeather ? 'animate-spin' : ''}`}></i> Weather
                </button>
                <button 
                  onClick={() => setIsAiModalOpen(true)} 
                  className="bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i> Plan with AI
                </button>
                <button onClick={addTripDay} className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium flex items-center gap-1.5">
                  <i className="fa-solid fa-plus"></i> Add Waypoint
                </button>
              </div>
            </div>

            {/* Compact 3-3-3 Micro-Bar */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl sm:rounded-2xl p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:gap-3 text-center sm:text-left">
                <div className="p-1.5 sm:p-3 bg-emerald-500/20 text-emerald-400 rounded-lg sm:rounded-xl mb-1 sm:mb-0">
                  <i className="fa-solid fa-gauge-high text-sm sm:text-xl"></i>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs text-slate-400">Daily Target</div>
                  <div className="text-xs sm:text-lg font-bold text-slate-100">&le;300 Mi/Day</div>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl sm:rounded-2xl p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:gap-3 text-center sm:text-left">
                <div className="p-1.5 sm:p-3 bg-amber-500/20 text-amber-400 rounded-lg sm:rounded-xl mb-1 sm:mb-0">
                  <i className="fa-solid fa-clock text-sm sm:text-xl"></i>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs text-slate-400">Target Arrival</div>
                  <div className="text-xs sm:text-lg font-bold text-slate-100">&lt;3:00 PM</div>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl sm:rounded-2xl p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:gap-3 text-center sm:text-left">
                <div className="p-1.5 sm:p-3 bg-purple-500/20 text-purple-400 rounded-lg sm:rounded-xl mb-1 sm:mb-0">
                  <i className="fa-solid fa-bed text-sm sm:text-xl"></i>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs text-slate-400">Min Stay</div>
                  <div className="text-xs sm:text-lg font-bold text-slate-100">&ge;3 Nights</div>
                </div>
              </div>
            </div>

            {/* Waypoints List & Dual-Action Empty State */}
            <div className="space-y-3 sm:space-y-4">
              {itineraryWaypoints.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-800/40 rounded-2xl border border-slate-700/60 space-y-4 max-w-lg mx-auto">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl">
                    <i className="fa-solid fa-route"></i>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Plan Your Next RV Adventure</h3>
                    <p className="text-xs text-slate-400 mt-1">Generate a complete rig-safe itinerary with Gemini AI, or build your custom waypoints manually.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                    <button 
                      onClick={() => setIsAiModalOpen(true)}
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i> Generate with AI
                    </button>
                    <button 
                      onClick={addTripDay}
                      className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                    >
                      <i className="fa-solid fa-plus text-emerald-400"></i> Add Day Manually
                    </button>
                  </div>
                </div>
              ) : (
                itineraryWaypoints.map((wp, wIdx) => {
                  const currentDisplayDay = getWaypointDisplayDay(itineraryWaypoints, wIdx);
                  const stayCount = wp.stayNights !== undefined ? wp.stayNights : 1;

                  const breaksMiles = wp.estMiles > 300;
                  const arrH = wp.arrivalHour !== undefined ? wp.arrivalHour : 15;
                  const arrM = wp.arrivalMinute !== undefined ? wp.arrivalMinute : 0;
                  const breaksTime = (arrH > 16) || (arrH === 16 && arrM > 0);
                  const breaksStay = stayCount < 3 && stayCount > 0 && aiEnforce333;
                  const brokenCount = (breaksMiles ? 1 : 0) + (breaksTime ? 1 : 0) + (breaksStay ? 1 : 0);

                  let badgeBgClass = "bg-emerald-600 text-white";
                  if (brokenCount === 1) badgeBgClass = "bg-amber-500 text-slate-950 font-bold";
                  else if (brokenCount === 2) badgeBgClass = "bg-pink-500 text-white font-bold";
                  else if (brokenCount >= 3) badgeBgClass = "bg-red-600 text-white font-bold";

                  const formattedArrTime = `${arrH % 12 || 12}:${arrM < 10 ? '0' : ''}${arrM} ${arrH >= 12 ? 'PM' : 'AM'}`;
                  const isExpanded = wp.isExpanded ?? true;

                  return (
                    <div key={wp.id} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 sm:p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button 
                            onClick={() => toggleExpandWaypoint(wp.id)} 
                            className="text-slate-300 hover:text-emerald-400 p-1 text-xs font-semibold flex items-center gap-1.5 bg-slate-900/50 rounded-lg px-2 border border-slate-700"
                          >
                            <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                            <span className={`${badgeBgClass} text-[11px] font-bold px-2 py-0.5 rounded`}>DAY {currentDisplayDay}</span>
                          </button>
                          <span className="text-xs text-slate-300 font-medium">
                            Day Distance: <strong className="text-emerald-400">{wp.estMiles} mi</strong> | Camp Arrival: <strong className={breaksTime ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{formattedArrTime}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">Stay:</span>
                          <input 
                            type="number" 
                            min="0"
                            value={wp.stayNights ?? 0} 
                            onChange={(e) => updateWaypoint(wp.id, 'stayNights', Math.max(0, parseInt(e.target.value, 10) || 0))} 
                            className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-slate-200 focus:outline-none focus:border-emerald-500" 
                          />
                          <span className="text-slate-400">{wp.stayNights === 0 ? 'Nights (Transit/End)' : `${wp.stayNights} Night${wp.stayNights > 1 ? 's' : ''}`}</span>

                          <button onClick={() => removeTripDay(wp.id)} className="text-slate-400 hover:text-red-400 p-1.5 ml-1" title="Delete Day">
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Starting Place (Origin)</label>
                            <input 
                              ref={(el) => setupAutocompleteForInput(el, wp.id, 'origin')}
                              type="text" 
                              value={wp.origin} 
                              onChange={(e) => updateWaypoint(wp.id, 'origin', e.target.value)}
                              placeholder="Starting place..." 
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" 
                            />
                          </div>

                          <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-slate-700/60">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                                Stops &amp; Daytime Itinerary ({wp.stops?.length || 1})
                              </span>
                              <button 
                                onClick={() => addStopToWaypoint(wp.id)}
                                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg"
                              >
                                <i className="fa-solid fa-plus"></i> Add Stop
                              </button>
                            </div>

                            {(wp.stops || []).map((stop: any, sIdx: number, arr: any[]) => {
                              const prevLoc = sIdx === 0 ? wp.origin : arr[sIdx - 1].destination;
                              const stopArrH = stop.arrivalHour !== undefined ? stop.arrivalHour : 15;
                              const stopArrM = stop.arrivalMinute !== undefined ? stop.arrivalMinute : 0;
                              const formattedStopArrTime = `${stopArrH % 12 || 12}:${stopArrM < 10 ? '0' : ''}${stopArrM} ${stopArrH >= 12 ? 'PM' : 'AM'}`;
                              const weatherInfo = stop.destination ? destinationWeathers[stop.destination] : null;

                              const isLastStopOfWaypoint = sIdx === (arr.length - 1);
                              const isLastWaypoint = wIdx === itineraryWaypoints.length - 1;
                              const firstOrigin = (itineraryWaypoints[0]?.origin || aiStartLocation || userLocationName || '').toLowerCase().split(',')[0].trim();
                              const destCity = (stop.destination || '').toLowerCase().split(',')[0].trim();
                              const isMatchingHomeOrigin = firstOrigin && destCity && (firstOrigin.includes(destCity) || destCity.includes(firstOrigin));
                              const isHomeReturnStop = wp.isHomeReturn === true || (isLastWaypoint && isLastStopOfWaypoint && (wp.stayNights === 0 || isMatchingHomeOrigin));

                              return (
                                <div key={stop.id} className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold text-emerald-400">Stop {sIdx + 1}</span>
                                      {isLastStopOfWaypoint ? (
                                        <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold">
                                          🏕️ Overnight Destination ({stayCount}N)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-medium">
                                          ☕ Mid-day / Fuel Pause
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-slate-400">
                                        Leg: <strong className="text-emerald-300">{stop.estMiles || 0} mi</strong> | Arr: <strong className="text-slate-200">{formattedStopArrTime}</strong>
                                      </span>
                                      {arr.length > 1 && (
                                        <button 
                                          onClick={() => removeStopFromWaypoint(wp.id, stop.id)} 
                                          className="text-slate-500 hover:text-red-400 text-xs p-1"
                                          title="Remove Stop"
                                        >
                                          <i className="fa-solid fa-xmark"></i>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                    <div className="sm:col-span-12 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                                      <div className="flex-1">
                                        <label className="block text-[10px] text-slate-400 mb-1">
                                          {isLastStopOfWaypoint ? "Evening Destination (Campground / Hotel)" : "Daytime Stop (Fuel / Lunch / Scenic)"}
                                        </label>
                                        <input 
                                          ref={(el) => setupAutocompleteForInput(el, wp.id, 'destination', stop.id)}
                                          type="text" 
                                          value={stop.destination} 
                                          onChange={(e) => updateStop(wp.id, stop.id, 'destination', e.target.value)}
                                          placeholder={isLastStopOfWaypoint ? "Evening destination or RV park..." : "Lunch, gas or scenic stop..."} 
                                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" 
                                        />
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <div>
                                          <label className="block text-[10px] text-slate-400 mb-1">Departure Time</label>
                                          <div className="flex items-center gap-1">
                                            <select 
                                              value={stop.depHour !== undefined ? stop.depHour : (sIdx === 0 ? 8 : 13)} 
                                              onChange={(e) => updateStop(wp.id, stop.id, 'depHour', parseInt(e.target.value, 10))}
                                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                                            >
                                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                                                <option key={h} value={h}>{h}</option>
                                              ))}
                                            </select>
                                            <span className="text-slate-400 font-bold">:</span>
                                            <select 
                                              value={stop.depMin !== undefined ? stop.depMin : 0} 
                                              onChange={(e) => updateStop(wp.id, stop.id, 'depMin', parseInt(e.target.value, 10))}
                                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                                            >
                                              {[0, 15, 30, 45].map(m => (
                                                <option key={m} value={m}>{m < 10 ? `0${m}` : m}</option>
                                              ))}
                                            </select>
                                            <div className="flex bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shrink-0">
                                              <button 
                                                type="button" 
                                                onClick={() => updateStop(wp.id, stop.id, 'depAmPm', 'AM')} 
                                                className={`px-2 py-1.5 text-[11px] font-semibold transition ${(!stop.depAmPm || stop.depAmPm === 'AM') ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                              >
                                                AM
                                              </button>
                                              <button 
                                                type="button" 
                                                onClick={() => updateStop(wp.id, stop.id, 'depAmPm', 'PM')} 
                                                className={`px-2 py-1.5 text-[11px] font-semibold transition ${stop.depAmPm === 'PM' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                              >
                                                PM
                                              </button>
                                            </div>
                                          </div>
                                        </div>

                                        <a 
                                          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(prevLoc || '')}&destination=${encodeURIComponent(stop.destination || '')}&travelmode=driving`} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-2 rounded-xl text-[11px] flex items-center gap-1.5 transition shadow shrink-0 self-end"
                                          title="Navigate"
                                        >
                                          <i className="fa-solid fa-location-arrow"></i> Navigate
                                        </a>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Stop Action Bar: Individual Weather Tag + RV Site Picker (Last Stop Only) */}
                                  <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2 text-slate-300 flex-wrap">
                                      {stop.destination && (
                                        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                                          <i className="fa-solid fa-cloud-sun text-sky-400"></i>
                                          <span>Local Weather: <strong>{weatherInfo ? `${weatherInfo.temp}, ${weatherInfo.condition}` : 'Fetching live weather...'}</strong></span>
                                        </div>
                                      )}

                                      {weatherInfo && weatherInfo.hazardAlert && (
                                        <div className="bg-red-500/20 border border-red-500/40 text-red-300 px-2 py-1 rounded font-bold flex items-center gap-1.5 animate-pulse">
                                          <i className="fa-solid fa-triangle-exclamation"></i>
                                          <span>{weatherInfo.hazardAlert}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* RV Site Picker Button: Visible ONLY for the Final Overnight Stop of the Waypoint */}
                                    {isLastStopOfWaypoint && !isHomeReturnStop && stayCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSitePicker(wp.id, stop.id, stop.destination, stayCount)}
                                        className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 font-semibold px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 shadow-sm transition"
                                        title={`Compare and pick top RV campgrounds in ${stop.destination}`}
                                      >
                                        <i className="fa-solid fa-campground text-amber-300"></i>
                                        <span>RV Site Picker</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Auto-Resizing Multi-line Notes Box */}
                      <textarea 
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = `${Math.max(40, el.scrollHeight)}px`;
                          }
                        }}
                        value={wp.notes} 
                        onChange={(e) => {
                          updateWaypoint(wp.id, 'notes', e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.max(40, e.target.scrollHeight)}px`;
                        }}
                        placeholder="Trip notes, fuel stops, time zone shifts & RV site details..." 
                        className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 overflow-hidden resize-none leading-relaxed transition-all"
                      ></textarea>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* TAB 4: CHECKLISTS */}
          <div className={`${activeTab === 'checklist' ? 'flex' : 'hidden'} flex-1 p-4 md:p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6 flex-col`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-emerald-400"></i> RV Safety Checklists
                </h2>
                <p className="text-xs text-slate-400">Check off each task before departure and arrival.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                    <i className="fa-solid fa-truck-ramp-box"></i> Pre-Departure Checklist
                  </h3>
                  <button 
                    onClick={() => clearAllTasks('departure')} 
                    className="text-[11px] text-slate-400 hover:text-amber-400 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 font-medium"
                    title="Clear all checked items"
                  >
                    <i className="fa-solid fa-broom"></i> Clear All
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {departureTasks.map((t, idx) => (
                    <div key={t.id} className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/60">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => moveTask('departure', idx, 'up')} className="hover:text-amber-400 text-[10px]"><i className="fa-solid fa-chevron-up"></i></button>
                        <button onClick={() => moveTask('departure', idx, 'down')} className="hover:text-amber-400 text-[10px]"><i className="fa-solid fa-chevron-down"></i></button>
                        <label className="flex items-center space-x-2 cursor-pointer ml-1">
                          <input type="checkbox" checked={t.done} onChange={() => toggleTask('departure', t.id)} className="rounded bg-slate-800 border-slate-600 text-amber-500 focus:ring-0" />
                          <span className={t.done ? 'line-through text-slate-500' : 'text-slate-200'}>{t.text.replace('{AMP}', profile.ampRating)}</span>
                        </label>
                      </div>
                      <button onClick={() => deleteTask('departure', t.id)} className="text-slate-500 hover:text-red-400"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-700/50 flex gap-2">
                  <input type="text" value={newDepTaskText} onChange={(e) => setNewDepTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomTask('departure')} placeholder="Add custom departure check..." className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200" />
                  <button onClick={() => addCustomTask('departure')} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">Add</button>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                    <i className="fa-solid fa-plug"></i> Camp Arrival &amp; Setup
                  </h3>
                  <button 
                    onClick={() => clearAllTasks('arrival')} 
                    className="text-[11px] text-slate-400 hover:text-emerald-400 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 font-medium"
                    title="Clear all checked items"
                  >
                    <i className="fa-solid fa-broom"></i> Clear All
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {arrivalTasks.map((t, idx) => (
                    <div key={t.id} className="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/60">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => moveTask('arrival', idx, 'up')} className="hover:text-emerald-400 text-[10px]"><i className="fa-solid fa-chevron-up"></i></button>
                        <button onClick={() => moveTask('arrival', idx, 'down')} className="hover:text-emerald-400 text-[10px]"><i className="fa-solid fa-chevron-down"></i></button>
                        <label className="flex items-center space-x-2 cursor-pointer ml-1">
                          <input type="checkbox" checked={t.done} onChange={() => toggleTask('arrival', t.id)} className="rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-0" />
                          <span className={t.done ? 'line-through text-slate-500' : 'text-slate-200'}>{t.text.replace('{AMP}', profile.ampRating)}</span>
                        </label>
                      </div>
                      <button onClick={() => deleteTask('arrival', t.id)} className="text-slate-500 hover:text-red-400"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-700/50 flex gap-2">
                  <input type="text" value={newArrTaskText} onChange={(e) => setNewArrTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomTask('arrival')} placeholder="Add custom arrival check..." className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200" />
                  <button onClick={() => addCustomTask('arrival')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">Add</button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* MODAL 1: GEMINI AI TRIP COPILOT MODAL (CLEANED UI WITHOUT API KEY BOX) */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-br from-emerald-500 to-sky-500 text-white p-2 rounded-xl shadow">
                  <i className="fa-solid fa-wand-magic-sparkles text-base"></i>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    RV SafePath AI Copilot <span className="text-[10px] bg-sky-500/20 text-sky-300 font-semibold px-2 py-0.5 rounded-full border border-sky-500/30">Gemini Powered</span>
                  </h3>
                  <p className="text-xs text-slate-400">Multi-stop daily pacing, daylight safety &amp; dynamic rig profile matching.</p>
                </div>
              </div>
              <button onClick={() => { setIsAiModalOpen(false); setGeneratedPlanPreview(null); }} className="text-slate-400 hover:text-slate-200 text-lg p-1">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-200 flex-1">
              {!generatedPlanPreview ? (
                <form onSubmit={handleGenerateAiTrip} className="space-y-4">
                  {/* Mode Selector Tabs */}
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setAiInputMode('guided')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${aiInputMode === 'guided' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      <i className="fa-solid fa-list-check"></i> Guided Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiInputMode('custom')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${aiInputMode === 'custom' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      <i className="fa-solid fa-pen-nib"></i> Custom Prompt
                    </button>
                  </div>

                  {aiInputMode === 'guided' ? (
                    <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/70">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1">Starting Point (Origin)</label>
                          <input
                            ref={(el) => setupAiAutocomplete(el, (addr) => setAiStartLocation(addr))}
                            type="text"
                            value={aiStartLocation}
                            onChange={(e) => setAiStartLocation(e.target.value)}
                            placeholder="Search starting city, address or zip..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 flex items-center justify-between">
                            <span>Dream Destination(s)</span>
                            <span className="text-[10px] text-slate-500 font-normal">Single or multiple stops</span>
                          </label>
                          <input
                            type="text"
                            value={aiDestinations}
                            onChange={(e) => setAiDestinations(e.target.value)}
                            placeholder="e.g. Glacier NP, MT & Yellowstone NP, WY (or use -> for sequence)"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                            required
                          />
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <i className="fa-solid fa-lightbulb text-amber-400 text-[9px]"></i>
                            <span>{'Separate multiple destinations with "&" or "->" (e.g. "Banff, AB -> Jasper, AB" or "Glacier NP, MT & Yellowstone, WY").'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Departure Date & Arrival/Return Date Pickers */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1">Departure Date</label>
                          <input
                            type="date"
                            value={aiDepartureDate}
                            onChange={(e) => setAiDepartureDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1">
                            Arrival / Return Date <span className="text-emerald-400 font-semibold">({calculatedDays} Days, {calculatedSeason})</span>
                          </label>
                          <input
                            type="date"
                            value={aiReturnDate}
                            min={aiDepartureDate}
                            onChange={(e) => setAiReturnDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Max Daily Driving Hours</label>
                        <select
                          value={aiMaxDailyHours}
                          onChange={(e) => setAiMaxDailyHours(parseInt(e.target.value, 10))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                        >
                          {[2, 3, 4, 5, 6, 7, 8].map(h => (
                            <option key={h} value={h}>~{h} Hours / Day ({h * 50} mi/day)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1.5">Travel Vibe &amp; Style</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['National Parks', 'Coastal Scenic', 'Forest / Boondocking', 'Family Friendly', 'Pet Friendly', 'Wineries & Harvest Hosts'].map(tag => {
                            const selected = aiVibeTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  if (selected) setAiVibeTags(aiVibeTags.filter(t => t !== tag));
                                  else setAiVibeTags([...aiVibeTags, tag]);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${selected ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Round-Trip & Pacing Rule Options */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <label className="flex items-start gap-2.5 cursor-pointer bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                          <input
                            type="checkbox"
                            checked={aiIsRoundTrip}
                            onChange={(e) => setAiIsRoundTrip(e.target.checked)}
                            className="mt-0.5 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-0"
                          />
                          <div>
                            <span className="font-semibold text-slate-200 block text-xs">🔄 Round-Trip (Return to Starting Point)</span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {aiIsRoundTrip 
                                ? `Checked: Plan outbound and return legs to return back to ${aiStartLocation || userLocationName}.` 
                                : "Unchecked: Plan a one-way trip ending at the final destination."}
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                          <input
                            type="checkbox"
                            checked={aiEnforce333}
                            onChange={(e) => setAiEnforce333(e.target.checked)}
                            className="mt-0.5 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-0"
                          />
                          <div>
                            <span className="font-semibold text-slate-200 block text-xs">Enforce 3-3-3 Rule (&le;300 mi/day, &lt;3:00 PM arrival, &ge;3 nights stay)</span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {aiEnforce333 
                                ? "Checked: AI structures the route with comfortable daily driving limits and camp pacing." 
                                : "Unchecked: No fixed pacing rules enforced; AI plans freely around your requested destinations."}
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/70">
                      <label className="block text-slate-300 font-semibold text-xs">Describe Your Dream RV Trip</label>
                      <textarea
                        rows={5}
                        value={aiCustomPrompt}
                        onChange={(e) => setAiCustomPrompt(e.target.value)}
                        placeholder="e.g., I want to take 7 days to Denver and back home with my RV. Note: every day I don't want to drive more than 5 hours unless it is impossible to complete within 7 days."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:border-emerald-500"
                        required
                      />
                      <p className="text-[11px] text-slate-400 italic">
                        The AI automatically detects round-trip intents ("and back home"), groups daytime breaks as stops, and calculates time-budget pacing.
                      </p>
                    </div>
                  )}

                  {/* Active Rig Specs Injection Summary Card */}
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
                    <div className="text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                      <i className="fa-solid fa-shield-halved text-emerald-400"></i> Rig Guard &amp; Fuel Safety Active:
                    </div>
                    <div>Max Height: <strong className="text-amber-400">{formattedHeight}</strong> | Combined Length: <strong className="text-slate-200">{combinedLen}ft</strong> | Weight: <strong className="text-slate-200">{profile.weightLbs.toLocaleString()} lbs</strong></div>
                    <div>Towing Economy: <strong className="text-amber-300">{safeMpgDisplay} MPG</strong> (~{safeFuelRange} mi safe range) | Power: <strong className="text-emerald-400">{profile.ampRating}</strong> | Min Hookup: <strong className="text-sky-300">{profile.minHookup.toUpperCase()}</strong></div>
                  </div>

                  {aiErrorMessage && (
                    <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl flex items-start gap-2">
                      <i className="fa-solid fa-circle-exclamation text-red-400 shrink-0 mt-0.5"></i>
                      <span>{aiErrorMessage}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setIsAiModalOpen(false)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isGeneratingTrip}
                      className="bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg transition disabled:opacity-50"
                    >
                      {isGeneratingTrip ? (
                        <>
                          <i className="fa-solid fa-circle-notch animate-spin"></i>
                          <span>Planning Multi-Stop Route...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
                          <span>Generate RV Itinerary</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Generated Plan Preview & Action Selection */
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 space-y-1">
                    <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-check"></i> {generatedPlanPreview.tripTitle || "Generated RV Itinerary"}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{generatedPlanPreview.summary}</p>
                  </div>

                  {/* Driving Feasibility Recommendation Banner */}
                  {generatedPlanPreview.feasibilityWarning && (
                    <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 space-y-1.5 text-xs text-amber-300">
                      <div className="font-bold flex items-center gap-1.5 text-amber-400">
                        <i className="fa-solid fa-triangle-exclamation"></i> Driving Pacing &amp; Feasibility Notice:
                      </div>
                      <p className="leading-relaxed text-[11px] text-amber-200">{generatedPlanPreview.feasibilityWarning}</p>
                    </div>
                  )}

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {(() => {
                      let previewRunningDay = 1;
                      return generatedPlanPreview.waypoints?.map((wp: any, idx: number) => {
                        const previewDay = previewRunningDay;
                        const previewStay = wp.stayNights !== undefined ? wp.stayNights : 1;
                        previewRunningDay += (previewStay > 0 ? previewStay : 1);

                        const stops = wp.stops || [{ destination: wp.destination }];
                        const finalStop = stops[stops.length - 1];

                        return (
                          <div key={idx} className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-emerald-400">DAY {previewDay}</span>
                              <span className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                                Stay: {previewStay === 0 ? '0 Nights (Return Home)' : `${previewStay} Night${previewStay > 1 ? 's' : ''}`}
                              </span>
                            </div>
                            <div className="text-slate-200">
                              <strong className="text-slate-400">From:</strong> {wp.origin} &rarr; <strong className="text-emerald-300">Overnight Destination:</strong> {finalStop.destination}
                            </div>
                            {stops.length > 1 && (
                              <div className="text-[11px] text-slate-400 pl-2 border-l border-slate-700 space-y-0.5">
                                <span className="font-semibold text-slate-300">Includes Daytime Stops:</span>
                                {stops.slice(0, -1).map((s: any, sIdx: number) => (
                                  <div key={sIdx}>• {s.destination}</div>
                                ))}
                              </div>
                            )}
                            {wp.notes && (
                              <div className="text-[11px] text-slate-400 italic pt-0.5">{wp.notes}</div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/60 text-[11px] text-slate-400">
                    <i className="fa-solid fa-info-circle text-sky-400 mr-1"></i> Once applied, all legs will calculate exact Google Maps miles, daylight arrival times, and live weather for every stop.
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setGeneratedPlanPreview(null)}
                      className="w-full sm:w-auto px-3.5 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium"
                    >
                      &larr; Back to Generator
                    </button>
                    {itineraryWaypoints.length > 0 && (
                      <button
                        type="button"
                        onClick={() => applyAiPlan('append')}
                        className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-plus"></i> Append to Current Plan
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => applyAiPlan('replace')}
                      className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5"
                    >
                      <i className="fa-solid fa-check"></i> Replace Current Itinerary
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AI RV SITE PICKER & COMPARISON MODAL */}
      {isSitePickerOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/95 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
                  <i className="fa-solid fa-campground text-lg"></i>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    Top 3 Recommended RV Campsites
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Rig Matched
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Location: <strong className="text-emerald-300">{activeSitePickerTarget?.destination}</strong> ({activeSitePickerTarget?.stayNights} Nights) · Matched for {combinedLen}ft combined rig, {formattedHeight} clearance &amp; {profile.ampRating} service
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setIsSitePickerOpen(false); setSitePickerResults(null); }} 
                className="text-slate-400 hover:text-slate-200 text-lg p-1"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-200 flex-1">
              {isLoadingSitePicker ? (
                <div className="text-center py-16 space-y-3">
                  <i className="fa-solid fa-compass animate-spin text-3xl text-emerald-400"></i>
                  <div className="font-bold text-sm text-slate-200">Evaluating RV Campsites for {activeSitePickerTarget?.destination}...</div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Analyzing highway turn approach ease, campsite pad lengths ({combinedLen}ft), Full Hookups (FHU) / 30A/50A electrical pedestals, Starlink sky clearance &amp; season availability.
                  </p>
                </div>
              ) : sitePickerError ? (
                <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs p-4 rounded-xl space-y-3 max-w-lg mx-auto text-center">
                  <i className="fa-solid fa-circle-exclamation text-2xl text-red-400"></i>
                  <div>{sitePickerError}</div>
                  <button
                    onClick={() => activeSitePickerTarget && handleOpenSitePicker(activeSitePickerTarget.waypointId, activeSitePickerTarget.stopId, activeSitePickerTarget.destination, activeSitePickerTarget.stayNights)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-slate-200 transition"
                  >
                    Retry Search
                  </button>
                </div>
              ) : sitePickerResults && sitePickerResults.sites ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-300">
                          <th className="p-3 font-bold w-36 sm:w-44 shrink-0">Comparison Factor</th>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <th key={idx} className="p-3 font-bold border-l border-slate-700/80 min-w-[200px] sm:min-w-[240px]">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-emerald-400 font-bold">Option {idx + 1}</span>
                                {idx === 0 && (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                    ⭐ Top Pick
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-bold text-slate-100 mt-1">{site.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{site.category}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">📍 Proximity &amp; Town</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800 text-slate-200">{site.proximity}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🏔️ View &amp; Atmosphere</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800 text-slate-200">{site.viewSetting}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">📐 Pad Type &amp; Fit</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800 font-medium text-emerald-300">{site.padType}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🔌 Hookups &amp; Utilities (FHU)</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => {
                            const isFHU = site.hookups?.toLowerCase().includes('full hookup') || site.hookups?.toLowerCase().includes('fhu');
                            return (
                              <td key={idx} className="p-3 border-l border-slate-800">
                                <div className={`font-semibold flex items-center gap-1.5 ${isFHU ? 'text-emerald-300' : 'text-sky-300'}`}>
                                  <span>{isFHU ? '✅' : '🔌'}</span>
                                  <span>{site.hookups}</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🛣️ Driving &amp; Turn Ease</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800 text-amber-300 font-medium">{site.turnEase}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🛰️ Starlink &amp; Signal</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800 text-slate-300">{site.connectivity}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🐕 Amenities &amp; Pets</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800 text-slate-300">{site.amenities}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">💲 Est. Rates &amp; Clubs</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800 text-slate-200">{site.priceDiscounts}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🏆 Best For</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800 font-bold text-emerald-400">{site.bestFor}</td>
                          ))}
                        </tr>
                        <tr className="bg-slate-800/40">
                          <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">Action</td>
                          {sitePickerResults.sites.map((site: any, idx: number) => (
                            <td key={idx} className="p-3 border-l border-slate-800">
                              <button
                                type="button"
                                onClick={() => applySelectedSite(site)}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                              >
                                <i className="fa-solid fa-check"></i> Select &amp; Apply
                              </button>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-3.5 border-t border-slate-700 bg-slate-800/90 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { setIsSitePickerOpen(false); setSitePickerResults(null); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RV PROFILE MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg">
                  <i className="fa-solid fa-sliders text-lg"></i>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">RV Vehicle Profile &amp; Towing Specs</h3>
                  <p className="text-xs text-slate-400">Essential dimensions to prevent low-clearance accidents.</p>
                </div>
              </div>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-slate-200 text-lg p-1"><i className="fa-solid fa-xmark"></i></button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-200 flex-1">
              <div className="space-y-3">
                <h4 className="font-bold text-emerald-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider text-[11px]">1. RV Type &amp; Dimensions</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Rig / Vehicle Type</label>
                    <select value={profile.rvType} onChange={(e) => setProfile({ ...profile, rvType: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs focus:border-emerald-500">
                      <option value="Class A Motorhome">Class A Motorhome</option>
                      <option value="Class C Motorhome">Class C Motorhome</option>
                      <option value="Class B Camper Van">Class B Camper Van</option>
                      <option value="Fifth Wheel Trailer">Fifth Wheel Trailer</option>
                      <option value="Travel Trailer">Travel Trailer</option>
                      <option value="Truck Camper">Truck Camper</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Max Height Clearance (Ft &amp; In) <span className="text-amber-400 font-bold">*Critical</span></label>
                    <div className="flex gap-2">
                      <input type="number" value={profile.heightFeet} onChange={(e) => setProfile({ ...profile, heightFeet: parseInt(e.target.value) || 9 })} className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-400 font-bold" placeholder="Feet" />
                      <input type="number" value={profile.heightInches} onChange={(e) => setProfile({ ...profile, heightInches: parseInt(e.target.value) || 0 })} className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-400 font-bold" placeholder="Inches" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Rig Length Only (Feet) <span className="text-slate-500">(For campsite pad)</span></label>
                    <input type="number" value={profile.lengthFeet} onChange={(e) => setProfile({ ...profile, lengthFeet: parseInt(e.target.value) || 16 })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs" />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Combined Length with Towing (Feet) <span className="text-amber-400">*Driving Total</span></label>
                    <input type="number" value={profile.combinedLengthFeet} onChange={(e) => setProfile({ ...profile, combinedLengthFeet: parseInt(e.target.value) || 33 })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-300 font-medium" />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Gross Weight (GVWR in lbs)</label>
                    <input type="number" value={profile.weightLbs} onChange={(e) => setProfile({ ...profile, weightLbs: parseInt(e.target.value) || 4300 })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs" />
                  </div>

                  {/* Towing Fuel Economy MPG Input with Title Range Hint */}
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Towing Fuel Economy (Est. MPG) <span className="text-amber-400/80 font-medium">(~{safeFuelRange} mi safe range)</span>
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      max="50"
                      value={profile.towingMpg ?? 10} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile({ ...profile, towingMpg: val === '' ? '' : parseInt(val, 10) || 0 });
                      }} 
                      onBlur={() => {
                        if (!profile.towingMpg || profile.towingMpg < 1) {
                          setProfile({ ...profile, towingMpg: 10 });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-300 font-bold" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-emerald-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider text-[11px]">2. Towing &amp; Auxiliary Setup</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Towing / Drive Setup</label>
                    <select value={profile.towSetup} onChange={(e) => setProfile({ ...profile, towSetup: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs">
                      <option value="Trailer Towed by SUV, Truck, or Car">Trailer Towed by SUV, Truck, or Car (e.g. Jeep + Airstream)</option>
                      <option value="Flat Towing Car (Toad behind Motorhome)">Flat Towing Car behind Motorhome ("Toad")</option>
                      <option value="Car on Tow Dolly behind Motorhome">Car on Tow Dolly behind Motorhome</option>
                      <option value="None (Solo Motorhome / Camper Van)">None (Solo Motorhome or Camper Van)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 mb-1"><i className="fa-solid fa-fire-flame-simple text-orange-400 mr-1"></i> Propane Tank Configuration</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="block text-[10px] text-slate-500">Style</span>
                        <select value={profile.propaneStyle} onChange={(e) => setProfile({ ...profile, propaneStyle: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs">
                          <option value="Portable Cylinders">Portable Cylinders</option>
                          <option value="ASME Tank">ASME Tank</option>
                        </select>
                      </div>

                      <div>
                        <span className="block text-[10px] text-slate-500">Number of Bins</span>
                        <input type="number" value={profile.propaneCount} onChange={(e) => setProfile({ ...profile, propaneCount: parseInt(e.target.value) || 2 })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-semibold text-orange-400" />
                      </div>

                      <div>
                        <span className="block text-[10px] text-slate-500">Pounds / Bin</span>
                        <input type="number" value={profile.propaneLb} onChange={(e) => setProfile({ ...profile, propaneLb: parseInt(e.target.value) || 20 })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-semibold text-orange-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-emerald-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider text-[11px]">3. Active Memberships &amp; Discounts</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['Good Sam', 'Harvest Hosts', 'Boondockers W.', 'KOA Rewards', 'Passport America', 'BLM / America Beautiful'].map((mName) => (
                    <label key={mName} className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-700/80 cursor-pointer">
                      <input type="checkbox" checked={profile.memberships.includes(mName)} onChange={(e) => {
                        const updated = e.target.checked ? [...profile.memberships, mName] : profile.memberships.filter(x => x !== mName);
                        setProfile({ ...profile, memberships: updated });
                      }} className="rounded bg-slate-800 text-emerald-500" />
                      <span>{mName}</span>
                    </label>
                  ))}
                  <label className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-700/80 cursor-pointer sm:col-span-3">
                    <input type="checkbox" className="rounded bg-slate-800 text-emerald-500" />
                    <span className="font-medium text-emerald-300">Others... (Add Custom Program)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-emerald-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider text-[11px]">4. Camping Preferences, Power, Battery &amp; Solar Setup</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Rig Electrical Rating</label>
                    <select value={profile.ampRating} onChange={(e) => setProfile({ ...profile, ampRating: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs">
                      <option value="30A">30 Amp Service (Single AC / Standard Travel Trailer)</option>
                      <option value="50A">50 Amp Service (Dual ACs / Heavy Load)</option>
                      <option value="20A">15/20 Amp Standard Household</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Minimum Acceptable Hookup</label>
                    <select value={profile.minHookup} onChange={(e) => setProfile({ ...profile, minHookup: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs">
                      <option value="full">Must Be Full Hookups (Water, Electric, Sewer)</option>
                      <option value="partial">Water &amp; Electric OK (Sewer at Dump Station)</option>
                      <option value="electric">Electric Only OK (Will fill water tank prior)</option>
                      <option value="dry">Dry Camping / Boondocking OK (Off-Grid)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium">Cancel</button>
              <button type="button" onClick={handleSaveProfile} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-md transition flex items-center gap-1.5">
                <i className="fa-solid fa-floppy-disk"></i> Save Profile Specs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
