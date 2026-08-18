import React, { useState, useEffect, useRef } from 'react';
import { RvProfile } from '../../types/rv';
import { RouteSummary } from '../../types/places';
import { DARK_MAP_STYLE } from '../../constants/mapStyles';
import { calculateSafeRouteService } from '../../services/directionsService';

interface SafeRouterTabProps {
  profile: RvProfile;
  userCoords: { lat: number; lng: number };
  userLocationName: string;
}

export const SafeRouterTab: React.FC<SafeRouterTabProps> = ({
  profile,
  userCoords,
  userLocationName
}) => {
  const [origin, setOrigin] = useState(userLocationName || "Bellevue, WA");
  const [destination, setDestination] = useState("");
  const [avoidLowClearance, setAvoidLowClearance] = useState(true);
  const [avoidSteepGrades, setAvoidSteepGrades] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routerError, setRouterError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!window.google || !window.google.maps || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: userCoords,
        zoom: 10,
        styles: DARK_MAP_STYLE,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      });
      mapInstanceRef.current = map;

      const renderer = new window.google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#10b981',
          strokeWeight: 5,
          strokeOpacity: 0.85
        }
      });
      directionsRendererRef.current = renderer;

      // Autocomplete setup
      if (originInputRef.current && window.google.maps.places) {
        const originAuto = new window.google.maps.places.Autocomplete(originInputRef.current);
        originAuto.addListener('place_changed', () => {
          const place = originAuto.getPlace();
          if (place && place.formatted_address) {
            setOrigin(place.formatted_address);
          }
        });
      }

      if (destInputRef.current && window.google.maps.places) {
        const destAuto = new window.google.maps.places.Autocomplete(destInputRef.current);
        destAuto.addListener('place_changed', () => {
          const place = destAuto.getPlace();
          if (place && place.formatted_address) {
            setDestination(place.formatted_address);
          }
        });
      }
    }
  }, [userCoords]);

  const handleCalculateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;

    setIsCalculating(true);
    setRouterError(null);

    calculateSafeRouteService(
      origin,
      destination,
      profile,
      (summary, overviewPath) => {
        setIsCalculating(false);
        setRouteSummary(summary);
        if (mapInstanceRef.current && overviewPath && overviewPath.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();
          overviewPath.forEach(pt => bounds.extend(pt));
          mapInstanceRef.current.fitBounds(bounds);
        }
      },
      (errorMsg) => {
        setIsCalculating(false);
        setRouterError(errorMsg);
      }
    );
  };

  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
      {/* Left Form & Summary Pane */}
      <div className="w-full lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 shadow-lg">
        <form onSubmit={handleCalculateRoute} className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/90">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <i className="fa-solid fa-shield-halved"></i>
            <span>RV Safe Navigation Engine</span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Departure Origin</label>
              <input
                ref={originInputRef}
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Origin location..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Destination Address / Campground</label>
              <input
                ref={destInputRef}
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Enter destination..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1 text-[11px] text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={avoidLowClearance}
                onChange={(e) => setAvoidLowClearance(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-emerald-500"
              />
              <span>Avoid bridges below {formattedHeight} clearance</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={avoidSteepGrades}
                onChange={(e) => setAvoidSteepGrades(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-emerald-500"
              />
              <span>Avoid steep mountain passes (&gt;6% grade)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isCalculating}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
          >
            {isCalculating ? (
              <>
                <i className="fa-solid fa-circle-notch animate-spin"></i>
                <span>Calculating Safe Clearance...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-route"></i>
                <span>Calculate Safe RV Path</span>
              </>
            )}
          </button>
        </form>

        {/* Route Summary Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {routerError && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation text-red-400 shrink-0 mt-0.5"></i>
              <span>{routerError}</span>
            </div>
          )}

          {routeSummary ? (
            <div className="space-y-3">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5 space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <span className="font-bold text-slate-100 text-xs">Route Safe Path</span>
                  <span className="text-emerald-400 font-bold text-sm">{routeSummary.distanceMiles} Miles</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Est. Drive Time</span>
                    <span className="font-semibold text-slate-200">{routeSummary.travelTime}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Est. Towing Fuel Cost</span>
                    <span className="font-semibold text-amber-300">${routeSummary.fuelExpense} ({routeSummary.avgMpg} MPG)</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl flex items-start gap-2">
                <i className="fa-solid fa-circle-check text-emerald-400 shrink-0 mt-0.5"></i>
                <span>{routeSummary.hazardNotice}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <i className="fa-solid fa-map-location text-3xl"></i>
              <p className="text-xs">Enter your destination above to verify low bridges, weight limits, and grades.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Map Pane */}
      <div className="flex-1 relative h-64 lg:h-full bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
