import React, { useState, useEffect, useRef } from 'react';
import { RvProfile } from '../../types/rv';
import { FacilityItem, PlaceCategory } from '../../types/places';
import { DARK_MAP_STYLE } from '../../constants/mapStyles';
import { searchNearbyPlaces } from '../../services/placesService';

interface InTimeFinderTabProps {
  profile: RvProfile;
  userCoords: { lat: number; lng: number };
  userLocationName: string;
  setUserCoords: (coords: { lat: number; lng: number }) => void;
  setUserLocationName: (name: string) => void;
}

export const InTimeFinderTab: React.FC<InTimeFinderTabProps> = ({
  profile,
  userCoords,
  userLocationName,
  setUserCoords,
  setUserLocationName
}) => {
  const [filter, setFilter] = useState<PlaceCategory>('all');
  const [pullThroughOnly, setPullThroughOnly] = useState(false);
  const [fullHookupOnly, setFullHookupOnly] = useState(false);
  const [placesList, setPlacesList] = useState<FacilityItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<FacilityItem | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize Map
  useEffect(() => {
    if (!window.google || !window.google.maps || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: userCoords,
        zoom: 12,
        styles: DARK_MAP_STYLE,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      });
      mapInstanceRef.current = map;

      // Autocomplete on search input
      if (searchInputRef.current && window.google.maps.places) {
        const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current);
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry && place.geometry.location) {
            const newLat = place.geometry.location.lat();
            const newLng = place.geometry.location.lng();
            setUserCoords({ lat: newLat, lng: newLng });
            setUserLocationName(place.formatted_address || place.name || 'Custom Location');
            map.setCenter({ lat: newLat, lng: newLng });
            map.setZoom(13);
          }
        });
      }
    } else {
      mapInstanceRef.current.setCenter(userCoords);
    }
  }, [userCoords]);

  // Search Places
  useEffect(() => {
    let isCancelled = false;
    const fetchPlaces = async () => {
      setIsSearching(true);
      const results = await searchNearbyPlaces(userCoords.lat, userCoords.lng, filter, profile);
      if (!isCancelled) {
        setPlacesList(results);
        setIsSearching(false);
      }
    };
    fetchPlaces();
    return () => { isCancelled = true; };
  }, [userCoords, filter, profile]);

  // Update Map Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // User Location Marker
    const userMarker = new window.google.maps.Marker({
      position: userCoords,
      map: mapInstanceRef.current,
      title: "Current Location",
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#38bdf8",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2
      }
    });
    markersRef.current.push(userMarker);

    // Place Markers
    placesList.forEach(item => {
      const markerColor = item.category === 'fuel' ? '#f59e0b' : item.category === 'propane' ? '#ea580c' : item.category === 'campground' ? '#10b981' : '#38bdf8';
      const marker = new window.google.maps.Marker({
        position: { lat: item.lat, lng: item.lng },
        map: mapInstanceRef.current,
        title: item.name,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: 1.3,
          anchor: new window.google.maps.Point(12, 22)
        }
      });

      marker.addListener('click', () => {
        setSelectedFacility(item);
      });

      markersRef.current.push(marker);
    });
  }, [placesList, userCoords]);

  const filteredPlaces = placesList.filter(item => {
    if (pullThroughOnly && !item.pullThrough) return false;
    if (fullHookupOnly && item.category === 'campground' && !item.fullHookup) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
      {/* Left List Pane */}
      <div className="w-full lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 shadow-lg">
        {/* Search & Location Bar */}
        <div className="p-3.5 border-b border-slate-800 space-y-2.5 bg-slate-900/90">
          <div className="relative">
            <i className="fa-solid fa-location-dot absolute left-3 top-2.5 text-slate-400 text-xs"></i>
            <input
              ref={searchInputRef}
              type="text"
              defaultValue={userLocationName}
              placeholder="Search city, highway exit, or address..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All', icon: 'fa-layer-group' },
              { id: 'fuel', label: 'Fuel', icon: 'fa-gas-pump' },
              { id: 'propane', label: 'Bulk Propane', icon: 'fa-fire-flame-simple' },
              { id: 'dump', label: 'Dump Stations', icon: 'fa-faucet-drip' },
              { id: 'campground', label: 'RV Parks', icon: 'fa-campground' },
              { id: 'parking', label: 'Overnight Lots', icon: 'fa-square-parking' }
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id as PlaceCategory)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  filter === c.id
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className={`fa-solid ${c.icon}`}></i>
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          {/* Filter Toggles */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={pullThroughOnly}
                onChange={(e) => setPullThroughOnly(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-emerald-500"
              />
              <span>Pull-Through Only</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={fullHookupOnly}
                onChange={(e) => setFullHookupOnly(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-emerald-500"
              />
              <span>Full Hookup (FHU)</span>
            </label>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {isSearching ? (
            <div className="text-center py-12 space-y-2">
              <i className="fa-solid fa-circle-notch animate-spin text-2xl text-emerald-400"></i>
              <div className="text-xs text-slate-400">Finding RV-safe stops within 20 miles...</div>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-slate-500">
              <i className="fa-solid fa-map-pin text-2xl"></i>
              <div className="text-xs">No facilities found for this filter in the current area.</div>
            </div>
          ) : (
            filteredPlaces.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedFacility(item);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.panTo({ lat: item.lat, lng: item.lng });
                    mapInstanceRef.current.setZoom(15);
                  }
                }}
                className={`p-3 rounded-xl border transition cursor-pointer space-y-1.5 text-xs ${
                  selectedFacility?.id === item.id
                    ? 'bg-slate-800 border-emerald-500 shadow-md'
                    : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-100 line-clamp-1">{item.name}</span>
                  <span className="text-emerald-400 font-semibold shrink-0 ml-1">{item.distanceMiles} mi</span>
                </div>
                <div className="text-slate-400 text-[11px] line-clamp-1">{item.address}</div>

                {item.fuelPrices && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(item.fuelPrices).map(([type, price]) => (
                      <span key={type} className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-amber-500/30">
                        {type}: {price}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1 pt-0.5 text-[10px]">
                  {item.propane && <span className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-medium">🔥 Bulk LP</span>}
                  {item.fullHookup && <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">🔌 FHU</span>}
                  {item.pullThrough && <span className="bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-medium">🚚 Pull-Thru</span>}
                  {item.overnight && <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-medium">🌙 Overnight</span>}
                </div>
              </div>
            ))
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
