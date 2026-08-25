import React, { useState, useEffect, useRef } from 'react';
import { RvProfile } from '../../types/rv';
import { RouteSummary } from '../../types/places';
import { DARK_MAP_STYLE } from '../../constants/mapStyles';
import { formatResolvedPlaceAddress } from '../../utils/addressUtils';

interface SafeRouterTabProps {
  profile: RvProfile;
  userCoords: { lat: number; lng: number };
  userLocationName: string;
  isGoogleLoaded: boolean;
}

export const SafeRouterTab: React.FC<SafeRouterTabProps> = ({
  profile,
  userCoords,
  userLocationName,
  isGoogleLoaded
}) => {
  const [routeOrigin, setRouteOrigin] = useState(userLocationName || "Bellevue, WA");
  const [routeDestination, setRouteDestination] = useState("");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routerError, setRouterError] = useState<string | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRouteInstance = useRef<google.maps.Map | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;

  // Initialize Map
  useEffect(() => {
    if (!isGoogleLoaded || !window.google || !window.google.maps || !mapContainerRef.current) return;

    if (!googleMapRouteInstance.current) {
      googleMapRouteInstance.current = new window.google.maps.Map(mapContainerRef.current, {
        center: userCoords,
        zoom: 7,
        styles: DARK_MAP_STYLE,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
    } else {
      googleMapRouteInstance.current.setCenter(userCoords);
    }
  }, [isGoogleLoaded, userCoords]);

  // Autocomplete setup
  useEffect(() => {
    if (!isGoogleLoaded || !window.google || !window.google.maps || !window.google.maps.places) return;

    if (originInputRef.current && !(originInputRef.current as any).__autocompleteAttached) {
      const originAuto = new window.google.maps.places.Autocomplete(originInputRef.current);
      (originInputRef.current as any).__autocompleteAttached = true;
      originAuto.addListener('place_changed', () => {
        const place = originAuto.getPlace();
        const addr = formatResolvedPlaceAddress(place);
        if (addr) {
          setRouteOrigin(addr);
        }
      });
    }

    if (destInputRef.current && !(destInputRef.current as any).__autocompleteAttached) {
      const destAuto = new window.google.maps.places.Autocomplete(destInputRef.current);
      (destInputRef.current as any).__autocompleteAttached = true;
      destAuto.addListener('place_changed', () => {
        const place = destAuto.getPlace();
        const addr = formatResolvedPlaceAddress(place);
        if (addr) {
          setRouteDestination(addr);
        }
      });
    }
  }, [isGoogleLoaded]);

  const handleLocateGPS = () => {
    if (!navigator.geolocation) {
      setRouterError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocatingGPS(true);
    setRouterError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;

        if (googleMapRouteInstance.current) {
          googleMapRouteInstance.current.panTo({ lat: newLat, lng: newLng });
          googleMapRouteInstance.current.setZoom(13);
        }

        if (window.google && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
            setIsLocatingGPS(false);
            if (status === 'OK' && results && results[0]) {
              const addr = results[0].formatted_address;
              setRouteOrigin(addr);
            } else {
              setRouteOrigin(`${newLat.toFixed(5)}, ${newLng.toFixed(5)}`);
            }
          });
        } else {
          setIsLocatingGPS(false);
          setRouteOrigin(`${newLat.toFixed(5)}, ${newLng.toFixed(5)}`);
        }
      },
      (err) => {
        setIsLocatingGPS(false);
        console.error("GPS error:", err);
        setRouterError("Could not retrieve GPS location. Please check browser location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCalculateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    const dest = routeDestination.trim();
    const orig = routeOrigin.trim();
    if (!dest || !window.google || !window.google.maps) return;

    setIsCalculatingRoute(true);
    setRouterError(null);

    const directionsService = new window.google.maps.DirectionsService();

    const request: google.maps.DirectionsRequest = {
      origin: orig || userLocationName,
      destination: dest,
      travelMode: window.google.maps.TravelMode.DRIVING,
      avoidHighways: false,
      avoidTolls: false
    };

    directionsService.route(request, (result, status) => {
      setIsCalculatingRoute(false);
      if (status === window.google.maps.DirectionsStatus.OK && result && result.routes[0]) {
        // Clear previous polyline if any
        if (routePolylineRef.current) {
          routePolylineRef.current.setMap(null);
        }

        // Draw new polyline directly on the map
        if (googleMapRouteInstance.current) {
          const routePath = result.routes[0].overview_path;
          routePolylineRef.current = new window.google.maps.Polyline({
            path: routePath,
            strokeColor: '#22c55e',
            strokeWeight: 6,
            strokeOpacity: 0.85,
            map: googleMapRouteInstance.current
          });

          const bounds = new window.google.maps.LatLngBounds();
          result.routes[0].overview_path.forEach((point) => bounds.extend(point));
          googleMapRouteInstance.current.fitBounds(bounds, { padding: 40 });
        }

        const route = result.routes[0].legs[0];
        const distanceMeters = route.distance?.value || 0;
        const miles = Math.round((distanceMeters / 1609.34) * 10) / 10;
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
        setRouterError("No driving route found between these locations. Please select valid connected driving locations.");
        if (routePolylineRef.current) {
          routePolylineRef.current.setMap(null);
          routePolylineRef.current = null;
        }
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden w-full relative">
      {/* Right Map Container */}
      <div className="order-first md:order-last w-full h-[36vh] sm:h-[40vh] md:h-full md:flex-1 relative shrink-0">
        <div ref={mapContainerRef} className="w-full h-full bg-slate-950"></div>
      </div>

      {/* Left Form Pane */}
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
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input 
                  ref={originInputRef} 
                  type="text" 
                  value={routeOrigin} 
                  onChange={(e) => setRouteOrigin(e.target.value)} 
                  placeholder="Starting address..." 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-7 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" 
                />
                {routeOrigin && (
                  <button
                    type="button"
                    onClick={() => { setRouteOrigin(''); if (originInputRef.current) originInputRef.current.focus(); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleLocateGPS}
                disabled={isLocatingGPS}
                title="Use Current GPS Location"
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-2.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 shadow-sm"
              >
                <i className={`fa-solid fa-crosshairs ${isLocatingGPS ? 'animate-spin' : ''}`}></i>
                <span className="hidden sm:inline">GPS</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Destination</label>
            <input 
              ref={destInputRef} 
              type="text" 
              value={routeDestination} 
              onChange={(e) => setRouteDestination(e.target.value)} 
              placeholder="Destination (e.g. Moab, UT)..." 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" 
            />
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

          <button 
            type="submit" 
            disabled={isCalculatingRoute} 
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
          >
            <i className="fa-solid fa-compass"></i> {isCalculatingRoute ? "Calculating Safe Path..." : "Calculate Safe RV Path"}
          </button>
        </form>

        {routerError && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl flex items-start gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-400 shrink-0 mt-0.5"></i>
            <span>{routerError}</span>
          </div>
        )}

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
  );
};
