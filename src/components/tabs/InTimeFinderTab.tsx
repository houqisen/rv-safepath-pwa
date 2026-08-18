import React, { useState, useEffect, useRef } from 'react';
import { RvProfile } from '../../types/rv';
import { FacilityItem, PlaceCategory } from '../../types/places';
import { DARK_MAP_STYLE } from '../../constants/mapStyles';
import { searchNearbyPlaces } from '../../services/placesService';

interface InTimeFinderTabProps {
  profile: RvProfile;
  userCoords: { lat: number; lng: number };
  userLocationName: string;
  isGoogleLoaded: boolean;
  mapInstance: google.maps.Map | null;
  setMapInstance: (map: google.maps.Map | null) => void;
  setUserCoords: (coords: { lat: number; lng: number }) => void;
  setUserLocationName: (name: string) => void;
}

export const InTimeFinderTab: React.FC<InTimeFinderTabProps> = ({
  profile,
  userCoords,
  userLocationName,
  isGoogleLoaded,
  mapInstance,
  setMapInstance,
  setUserCoords,
  setUserLocationName
}) => {
  const [activeFilter, setActiveFilter] = useState<PlaceCategory>('fuel');
  const [pullThroughOnly, setPullThroughOnly] = useState(false);
  const [fullHookupOnly, setFullHookupOnly] = useState(false);
  const [manualInputText, setManualInputText] = useState(userLocationName);
  const [placesList, setPlacesList] = useState<FacilityItem[]>([]);
  const [isLoadingPois, setIsLoadingPois] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;

  // Initialize Map
  useEffect(() => {
    if (!isGoogleLoaded || !window.google || !window.google.maps || !mapContainerRef.current) return;

    if (!mapInstance) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: userCoords,
        zoom: 13,
        styles: DARK_MAP_STYLE,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      setMapInstance(map);
    } else {
      mapInstance.setCenter(userCoords);
    }
  }, [isGoogleLoaded, userCoords]);

  // Setup Autocomplete
  useEffect(() => {
    if (!isGoogleLoaded || !window.google || !window.google.maps || !window.google.maps.places || !locationInputRef.current) return;
    if ((locationInputRef.current as any).__autocompleteAttached) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(locationInputRef.current);
      (locationInputRef.current as any).__autocompleteAttached = true;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.geometry && place.geometry.location) {
          const newLat = place.geometry.location.lat();
          const newLng = place.geometry.location.lng();
          const addr = place.formatted_address || place.name || '';
          setUserCoords({ lat: newLat, lng: newLng });
          setUserLocationName(addr);
          setManualInputText(addr);
          if (mapInstance) {
            mapInstance.panTo({ lat: newLat, lng: newLng });
            mapInstance.setZoom(13);
          }
        }
      });
    } catch (e) {
      console.error("Autocomplete setup error:", e);
    }
  }, [isGoogleLoaded, mapInstance]);

  // Search Places
  const fetchPlaces = async (lat: number, lng: number, filterToUse: PlaceCategory) => {
    setIsLoadingPois(true);
    setNoticeMessage(null);
    try {
      const results = await searchNearbyPlaces(lat, lng, filterToUse, profile);
      setPlacesList(results);
    } catch (err) {
      console.error("Places search error:", err);
    } finally {
      setIsLoadingPois(false);
    }
  };

  useEffect(() => {
    if (isGoogleLoaded) {
      fetchPlaces(userCoords.lat, userCoords.lng, activeFilter);
    }
  }, [isGoogleLoaded, userCoords, activeFilter, profile]);

  // Update Markers
  useEffect(() => {
    if (!mapInstance || !window.google) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // User Location Marker
    if (!userMarkerRef.current) {
      userMarkerRef.current = new window.google.maps.Marker({
        position: userCoords,
        map: mapInstance,
        title: "Your Location",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#38bdf8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2
        }
      });
    } else {
      userMarkerRef.current.setPosition(userCoords);
      userMarkerRef.current.setMap(mapInstance);
    }

    // Facilities Markers
    placesList.forEach(item => {
      const markerColor = item.category === 'fuel' ? '#f59e0b' : item.category === 'propane' ? '#ea580c' : item.category === 'campground' ? '#10b981' : item.category === 'dump' ? '#ef4444' : '#6366f1';
      const marker = new window.google.maps.Marker({
        position: { lat: item.lat, lng: item.lng },
        map: mapInstance,
        title: item.name,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: 1.2,
          anchor: new window.google.maps.Point(12, 22)
        }
      });

      marker.addListener('click', () => {
        mapInstance.panTo({ lat: item.lat, lng: item.lng });
        mapInstance.setZoom(15);
      });

      markersRef.current.push(marker);
    });
  }, [placesList, userCoords, mapInstance]);

  const handleManualLocationSubmit = () => {
    if (!manualInputText.trim()) return;
    if (!window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: manualInputText }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        const newLat = loc.lat();
        const newLng = loc.lng();
        const addr = results[0].formatted_address || manualInputText;
        setUserCoords({ lat: newLat, lng: newLng });
        setUserLocationName(addr);
        setManualInputText(addr);
        if (mapInstance) {
          mapInstance.panTo({ lat: newLat, lng: newLng });
          mapInstance.setZoom(13);
        }
      } else {
        setNoticeMessage("Location not found. Please try entering a valid City, State or Zip Code.");
      }
    });
  };

  const handleLocateGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          setUserCoords({ lat: newLat, lng: newLng });
          if (mapInstance) {
            mapInstance.panTo({ lat: newLat, lng: newLng });
            mapInstance.setZoom(13);
          }
          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (res, stat) => {
              if (stat === 'OK' && res && res[0]) {
                const addr = res[0].formatted_address;
                setUserLocationName(addr);
                setManualInputText(addr);
              }
            });
          }
        },
        () => {
          setNoticeMessage("Could not retrieve GPS location. Please check browser permissions.");
        }
      );
    }
  };

  const filteredPlaces = placesList.filter(item => {
    if (pullThroughOnly && !item.pullThrough) return false;
    if (fullHookupOnly && item.category === 'campground' && !item.fullHookup) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden w-full relative">
      {/* Right Map Container */}
      <div className="order-first md:order-last w-full h-[36vh] sm:h-[40vh] md:h-full md:flex-1 relative shrink-0">
        <div ref={mapContainerRef} className="w-full h-full bg-slate-950"></div>
        
        <div className="absolute top-3 right-3 bg-slate-800/90 backdrop-blur border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 z-[10] flex items-center gap-2 shadow-md">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Safety Guard: <strong className="text-amber-400">{formattedHeight}</strong></span>
        </div>
      </div>

      {/* Left Sidebar Pane */}
      <div className="w-full md:w-96 bg-slate-800/90 border-r border-slate-700/80 flex flex-col flex-1 md:flex-initial md:h-full z-10 min-h-0">
        <div className="p-2.5 sm:p-3 border-b border-slate-700 bg-slate-800/60 space-y-2 shrink-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>Nearby Places ({filteredPlaces.length})</span>
            <button 
              onClick={() => fetchPlaces(userCoords.lat, userCoords.lng, activeFilter)} 
              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-normal"
            >
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

          {/* 6 Category Grid */}
          <div className="flex md:grid md:grid-cols-3 gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            <button 
              onClick={() => { setActiveFilter('fuel'); fetchPlaces(userCoords.lat, userCoords.lng, 'fuel'); }} 
              className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'fuel' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}
            >
              <i className="fa-solid fa-gas-pump text-amber-400 text-sm sm:text-base md:mb-1"></i>
              <span>Fuel</span>
            </button>
            
            <button 
              onClick={() => { setActiveFilter('propane'); fetchPlaces(userCoords.lat, userCoords.lng, 'propane'); }} 
              className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'propane' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}
            >
              <i className="fa-solid fa-fire-flame-simple text-orange-400 text-sm sm:text-base md:mb-1"></i>
              <span>Propane</span>
            </button>

            <button 
              onClick={() => { setActiveFilter('dump'); fetchPlaces(userCoords.lat, userCoords.lng, 'dump'); }} 
              className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'dump' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}
            >
              <i className="fa-solid fa-biohazard text-red-400 text-sm sm:text-base md:mb-1"></i>
              <span>Dump</span>
            </button>

            <button 
              onClick={() => { setActiveFilter('parking'); fetchPlaces(userCoords.lat, userCoords.lng, 'parking'); }} 
              className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'parking' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}
            >
              <i className="fa-solid fa-square-parking text-indigo-400 text-sm sm:text-base md:mb-1"></i>
              <span>Overnight</span>
            </button>

            <button 
              onClick={() => { setActiveFilter('campground'); fetchPlaces(userCoords.lat, userCoords.lng, 'campground'); }} 
              className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'campground' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}
            >
              <i className="fa-solid fa-campground text-emerald-400 text-sm sm:text-base md:mb-1"></i>
              <span>RV Parks</span>
            </button>

            <button 
              onClick={() => { setActiveFilter('all'); fetchPlaces(userCoords.lat, userCoords.lng, 'all'); }} 
              className={`flex md:flex-col items-center gap-1.5 md:gap-0 p-1.5 sm:p-2 rounded-xl transition text-xs font-medium whitespace-nowrap shrink-0 ${activeFilter === 'all' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-slate-700/70 border border-slate-600 text-slate-200'}`}
            >
              <i className="fa-solid fa-border-all text-sky-400 text-sm sm:text-base md:mb-1"></i>
              <span>All</span>
            </button>
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
              <span>Pull-Through</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={fullHookupOnly}
                onChange={(e) => setFullHookupOnly(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-emerald-500"
              />
              <span>Full Hookups</span>
            </label>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
          {isLoadingPois ? (
            <div className="text-center py-12 space-y-2">
              <i className="fa-solid fa-circle-notch animate-spin text-2xl text-emerald-400"></i>
              <div className="text-xs text-slate-400">Finding nearby facilities within 20 miles...</div>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-slate-500">
              <i className="fa-solid fa-map-pin text-2xl"></i>
              <div className="text-xs">No facilities found for this filter in the current area.</div>
            </div>
          ) : (
            filteredPlaces.map((facility) => (
              <div
                key={facility.id}
                onClick={() => {
                  if (mapInstance) {
                    mapInstance.panTo({ lat: facility.lat, lng: facility.lng });
                    mapInstance.setZoom(15);
                  }
                }}
                className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/80 transition space-y-2 cursor-pointer shadow"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">
                      {facility.category === 'fuel' ? '⛽' : facility.category === 'propane' ? '🔥' : facility.category === 'dump' ? '🚾' : facility.category === 'parking' ? '🅿️' : '🏕️'}
                    </span>
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
  );
};
