import React, { useRef } from 'react';
import { RvProfile } from '../../types/rv';
import { Waypoint, DestinationWeather } from '../../types/itinerary';
import { getWaypointDisplayDay, getWaypointDate, formatWaypointDateDisplay } from '../../utils/dateUtils';
import { formatResolvedPlaceAddress } from '../../utils/addressUtils';

interface TripPlannerTabProps {
  waypoints: Waypoint[];
  tripStartDate?: string;
  onUpdateTripStartDate?: (dateStr: string) => void;
  destinationWeathers: Record<string, DestinationWeather>;
  profile: RvProfile;
  isLoadingWeather?: boolean;
  onFetchWeather?: () => void;
  onOpenAiCopilot: () => void;
  onOpenSitePicker: (destination: string, stayNights: number, wpId: number, stopIdx: number) => void;
  onAddWaypoint: () => void;
  onClearAll: () => void;
  onUpdateWaypoint: (wpId: number, updater: (wp: Waypoint) => Waypoint) => void;
  onRemoveWaypoint: (wpId: number) => void;
}

function convertToTotalMinutes(hour: number, minute: number, ampm: string): number {
  let h = hour % 12;
  if (ampm === 'PM') h += 12;
  return h * 60 + minute;
}

function convertFromTotalMinutes(totalMinutes: number): { hour: number; minute: number; ampm: 'AM' | 'PM' } {
  const normMins = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const h24 = Math.floor(normMins / 60) % 24;
  const minute = normMins % 60;
  const hour = h24 % 12 || 12;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return { hour, minute, ampm };
}

export const TripPlannerTab: React.FC<TripPlannerTabProps> = ({
  waypoints,
  tripStartDate,
  onUpdateTripStartDate,
  destinationWeathers,
  profile,
  isLoadingWeather = false,
  onFetchWeather,
  onOpenAiCopilot,
  onOpenSitePicker,
  onAddWaypoint,
  onClearAll,
  onUpdateWaypoint,
  onRemoveWaypoint
}) => {
  const attachedInputsRef = useRef<Set<HTMLInputElement>>(new Set());

  const attachAutocomplete = (inputEl: HTMLInputElement | null, onSelected: (addr: string) => void) => {
    if (!inputEl || !window.google || !window.google.maps || !window.google.maps.places) return;
    if (attachedInputsRef.current.has(inputEl)) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputEl);
      attachedInputsRef.current.add(inputEl);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const formatted = formatResolvedPlaceAddress(place);
        if (formatted) {
          onSelected(formatted);
        }
      });
    } catch (e) {
      console.error("Autocomplete binding error:", e);
    }
  };

  const handleStartDateChange = (val: string) => {
    if (!val) {
      onUpdateTripStartDate && onUpdateTripStartDate('');
      return;
    }
    // Only propagate valid dates with a 4-digit year >= 2026
    const parts = val.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      if (parts[0].length === 4 && year >= 2026) {
        onUpdateTripStartDate && onUpdateTripStartDate(val);
      }
    }
  };

  const handleAddStop = (wpId: number) => {
    onUpdateWaypoint(wpId, (wp) => {
      const stops = wp.stops || [];
      const lastStop = stops[stops.length - 1];

      let defHour = 12;
      let defMin = 0;
      let defAmPm: 'AM' | 'PM' = 'PM';

      if (lastStop && lastStop.arrivalHour !== undefined) {
        // Default new stop's departure time to preceding stop's arrival time (+15 mins break, rounded to 15 min increments)
        const arrMins = (lastStop.arrivalHour * 60) + (lastStop.arrivalMinute || 0);
        const nextDepMins = Math.min(23 * 60 + 45, Math.ceil((arrMins + 15) / 15) * 15);
        const parsed = convertFromTotalMinutes(nextDepMins);
        defHour = parsed.hour;
        defMin = parsed.minute;
        defAmPm = parsed.ampm;
      }

      return {
        ...wp,
        stops: [
          ...stops,
          {
            id: Date.now(),
            destination: '',
            depHour: defHour,
            depMin: defMin,
            depAmPm: defAmPm,
            estMiles: 0,
            estHours: 0,
            arrivalHour: (defAmPm === 'PM' ? (defHour % 12 + 12) : (defHour % 12)) + 2,
            arrivalMinute: defMin
          }
        ]
      };
    });
  };

  const handleRemoveStop = (wpId: number, stopId: number) => {
    onUpdateWaypoint(wpId, (wp) => ({
      ...wp,
      stops: wp.stops.filter(s => s.id !== stopId)
    }));
  };

  const handleUpdateStopDepartureTime = (
    wpId: number,
    stopId: number,
    sIdx: number,
    newHour: number,
    newMin: number,
    newAmPm: 'AM' | 'PM',
    prevStopArrivalMins?: number
  ) => {
    let reqMins = convertToTotalMinutes(newHour, newMin, newAmPm);

    // Enforce that stop i (i > 0) departure CANNOT be earlier than previous stop arrival
    if (sIdx > 0 && prevStopArrivalMins !== undefined && reqMins < prevStopArrivalMins) {
      reqMins = prevStopArrivalMins;
    }

    const { hour, minute, ampm } = convertFromTotalMinutes(reqMins);

    onUpdateWaypoint(wpId, (wp) => ({
      ...wp,
      stops: (wp.stops || []).map(s => s.id === stopId ? {
        ...s,
        depHour: hour,
        depMin: minute,
        depAmPm: ampm
      } : s)
    }));
  };

  return (
    <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto max-w-6xl mx-auto w-full space-y-4 sm:space-y-6 flex-col">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-3 sm:pb-4">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-slate-100 flex items-center gap-2">
            <i className="fa-solid fa-calendar-days text-emerald-400"></i> Multi-Day RV Trip Itinerary
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400">Multi-stop daily pacing, daylight safety, live weather &amp; time zone shifts.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {onFetchWeather && (
            <button 
              onClick={onFetchWeather} 
              className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
            >
              <i className={`fa-solid fa-rotate ${isLoadingWeather ? 'animate-spin' : ''}`}></i> Weather
            </button>
          )}

          <button 
            onClick={onOpenAiCopilot} 
            className="bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i> Plan with AI
          </button>

          <button 
            onClick={onAddWaypoint} 
            className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
          >
            <i className="fa-solid fa-plus"></i> Add Waypoint
          </button>

          {waypoints.length > 0 && (
            <button 
              onClick={onClearAll}
              className="bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
              title="Clear all days"
            >
              <i className="fa-solid fa-trash-can"></i> Clear
            </button>
          )}
        </div>
      </div>

      {/* 3-3-3 Metric Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl sm:rounded-2xl p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:gap-3 text-center sm:text-left">
          <div className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl mb-1 sm:mb-0 ${profile.isEvTowVehicle ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            <i className={`fa-solid ${profile.isEvTowVehicle ? 'fa-bolt' : 'fa-gauge-high'} text-sm sm:text-xl`}></i>
          </div>
          <div>
            <div className="text-[10px] sm:text-xs text-slate-400">{profile.isEvTowVehicle ? "EV Daily Target" : "Daily Target"}</div>
            <div className={`text-xs sm:text-lg font-bold ${profile.isEvTowVehicle ? 'text-cyan-300' : 'text-slate-100'}`}>
              {profile.isEvTowVehicle ? `≤${(profile.evTowingRangeMiles || 140) * 2} Mi/Day` : "≤300 Mi/Day"}
            </div>
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

      {/* Missing Start Date Prompt Banner */}
      {!tripStartDate && waypoints.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <i className="fa-regular fa-calendar-plus text-lg"></i>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-amber-200">Trip Start Date Required</div>
              <p className="text-[11px] text-slate-300">Set your departure date to automatically calculate exact dates for all waypoints.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <input
              type="date"
              min="2026-01-01"
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-amber-200 focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
            />
          </div>
        </div>
      )}

      {/* Waypoints List */}
      <div className="space-y-3 sm:space-y-4">
        {waypoints.length === 0 ? (
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
                onClick={onOpenAiCopilot}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i> Generate with AI
              </button>
              <button 
                onClick={onAddWaypoint}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <i className="fa-solid fa-plus text-emerald-400"></i> Add Day Manually
              </button>
            </div>
          </div>
        ) : (
          waypoints.map((wp, wIdx) => {
            const currentDisplayDay = getWaypointDisplayDay(waypoints, wIdx);
            const stayCount = wp.stayNights !== undefined ? wp.stayNights : 1;
            const wpDate = getWaypointDate(tripStartDate, waypoints, wIdx);
            const formattedDateStr = wpDate ? formatWaypointDateDisplay(wpDate) : null;

            const breaksMiles = wp.estMiles > 300;
            const arrH = wp.arrivalHour !== undefined ? wp.arrivalHour : 15;
            const arrM = wp.arrivalMinute !== undefined ? wp.arrivalMinute : 0;
            const breaksTime = (arrH > 16) || (arrH === 16 && arrM > 0);
            const breaksStay = stayCount < 3 && stayCount > 0;
            const brokenCount = (breaksMiles ? 1 : 0) + (breaksTime ? 1 : 0) + (breaksStay ? 1 : 0);

            let badgeBgClass = "bg-emerald-600 text-white";
            if (brokenCount === 1) badgeBgClass = "bg-amber-500 text-slate-950 font-bold";
            else if (brokenCount === 2) badgeBgClass = "bg-pink-500 text-white font-bold";
            else if (brokenCount >= 3) badgeBgClass = "bg-red-600 text-white font-bold";

            const formattedArrTime = `${arrH % 12 || 12}:${arrM < 10 ? '0' : ''}${arrM} ${arrH >= 12 ? 'PM' : 'AM'}`;
            const isExpanded = wp.isExpanded ?? true;

            return (
              <div key={wp.id} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 sm:p-4 space-y-3 shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      onClick={() => onUpdateWaypoint(wp.id, (prev) => ({ ...prev, isExpanded: !isExpanded }))} 
                      className="text-slate-300 hover:text-emerald-400 p-1 text-xs font-semibold flex items-center gap-1.5 bg-slate-900/50 rounded-lg px-2 border border-slate-700"
                    >
                      <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                      <span className={`${badgeBgClass} text-[11px] font-bold px-2 py-0.5 rounded`}>
                        DAY {currentDisplayDay}{wIdx > 0 && formattedDateStr ? ` · ${formattedDateStr}` : ''}
                      </span>
                    </button>

                    {wIdx === 0 && (
                      <div 
                        onClick={(e) => {
                          const input = e.currentTarget.querySelector('input');
                          if (input && 'showPicker' in input) {
                            try { input.showPicker(); } catch {}
                          }
                        }}
                        className={`flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border ${!tripStartDate ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-emerald-500/40'} shadow-sm cursor-pointer`}
                      >
                        <i className={`fa-regular fa-calendar ${!tripStartDate ? 'text-amber-400' : 'text-emerald-400'} text-xs`}></i>
                        <input 
                          type="date" 
                          min="2026-01-01"
                          value={tripStartDate || ''} 
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className={`bg-transparent text-xs font-semibold focus:outline-none cursor-pointer ${!tripStartDate ? 'text-amber-300' : 'text-emerald-300'}`}
                          title="Click to edit Trip Start Date (cascades to all waypoints)"
                        />
                        {formattedDateStr ? (
                          <span className="text-[11px] text-emerald-400/90 font-medium hidden sm:inline">
                            ({formattedDateStr})
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold animate-pulse">
                            Set Start Date
                          </span>
                        )}
                      </div>
                    )}

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
                      onChange={(e) => onUpdateWaypoint(wp.id, (prev) => ({ ...prev, stayNights: Math.max(0, parseInt(e.target.value, 10) || 0) }))} 
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-slate-200 focus:outline-none focus:border-emerald-500" 
                    />
                    <span className="text-slate-400">{wp.stayNights === 0 ? 'Nights (Transit/End)' : `${wp.stayNights} Night${wp.stayNights > 1 ? 's' : ''}`}</span>

                    <button onClick={() => onRemoveWaypoint(wp.id)} className="text-slate-400 hover:text-red-400 p-1.5 ml-1" title="Delete Day">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Starting Place (Origin)</label>
                      <input 
                        ref={(el) => {
                          attachAutocomplete(el, (addr) => onUpdateWaypoint(wp.id, (prev) => ({ ...prev, origin: addr })));
                        }}
                        type="text" 
                        value={wp.origin} 
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateWaypoint(wp.id, (prev) => ({ ...prev, origin: val }));
                        }}
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
                          onClick={() => handleAddStop(wp.id)}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg"
                        >
                          <i className="fa-solid fa-plus"></i> Add Stop
                        </button>
                      </div>

                      {(wp.stops || []).map((stop, sIdx, arr) => {
                        const prevLoc = sIdx === 0 ? wp.origin : arr[sIdx - 1].destination;
                        const prevStop = sIdx > 0 ? arr[sIdx - 1] : null;
                        const prevStopArrH = prevStop?.arrivalHour !== undefined ? prevStop.arrivalHour : 12;
                        const prevStopArrM = prevStop?.arrivalMinute !== undefined ? prevStop.arrivalMinute : 0;
                        const prevStopArrTotalMins = sIdx > 0 ? (prevStopArrH * 60 + prevStopArrM) : undefined;
                        const formattedPrevArrTime = sIdx > 0 ? `${prevStopArrH % 12 || 12}:${prevStopArrM < 10 ? '0' : ''}${prevStopArrM} ${prevStopArrH >= 12 ? 'PM' : 'AM'}` : null;

                        const stopArrH = stop.arrivalHour !== undefined ? stop.arrivalHour : 15;
                        const stopArrM = stop.arrivalMinute !== undefined ? stop.arrivalMinute : 0;
                        const formattedStopArrTime = `${stopArrH % 12 || 12}:${stopArrM < 10 ? '0' : ''}${stopArrM} ${stopArrH >= 12 ? 'PM' : 'AM'}`;
                        const weatherInfo = stop.destination ? destinationWeathers[stop.destination] : null;
                        const isLastStopOfWaypoint = sIdx === (arr.length - 1);

                        const currentDepH = stop.depHour !== undefined ? stop.depHour : (sIdx === 0 ? 8 : 12);
                        const currentDepM = stop.depMin !== undefined ? stop.depMin : 0;
                        const currentDepAP = stop.depAmPm || (sIdx === 0 ? 'AM' : 'PM');
                        const currentDepTotalMins = convertToTotalMinutes(currentDepH, currentDepM, currentDepAP);

                        const layoverMins = sIdx > 0 && prevStopArrTotalMins !== undefined && currentDepTotalMins >= prevStopArrTotalMins
                          ? currentDepTotalMins - prevStopArrTotalMins
                          : 0;

                        return (
                          <div key={stop.id} className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-emerald-400">Stop {sIdx + 1}</span>
                                {isLastStopOfWaypoint ? (
                                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold">
                                    🏕️ Overnight Destination ({stayCount}N)
                                  </span>
                                ) : (
                                  <span className={`text-[10px] border px-1.5 py-0.5 rounded font-medium ${profile.isEvTowVehicle ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                    {profile.isEvTowVehicle ? '⚡ EV Fast Charge' : '☕ Mid-day / Fuel Pause'}
                                  </span>
                                )}

                                {sIdx > 0 && layoverMins > 0 && (
                                  <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded font-medium" title={`Layover at Stop ${sIdx} before departure`}>
                                    ⏱️ {layoverMins >= 60 ? `${Math.floor(layoverMins / 60)}h ${layoverMins % 60 > 0 ? `${layoverMins % 60}m` : ''}` : `${layoverMins}m`} break
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400">
                                  Leg: <strong className="text-emerald-300">{stop.estMiles || 0} mi</strong> | Arr: <strong className="text-slate-200">{formattedStopArrTime}</strong>
                                </span>
                                {arr.length > 1 && (
                                  <button 
                                    onClick={() => handleRemoveStop(wp.id, stop.id)}
                                    className="text-slate-500 hover:text-red-400 p-1 text-xs"
                                    title="Remove this stop"
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Destination Input, Departure Time Selects & Navigate Button */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                              <div className="sm:col-span-12 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                                <div className="flex-1">
                                  <label className="block text-[10px] text-slate-400 mb-1">
                                    {isLastStopOfWaypoint ? "Evening Destination (Campground / Hotel)" : "Daytime Stop (Fuel / Lunch / Scenic)"}
                                  </label>
                                  <input 
                                    ref={(el) => {
                                      attachAutocomplete(el, (addr) => {
                                        onUpdateWaypoint(wp.id, (prev) => ({
                                          ...prev,
                                          stops: prev.stops.map(s => s.id === stop.id ? { ...s, destination: addr } : s)
                                        }));
                                      });
                                    }}
                                    type="text" 
                                    value={stop.destination} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      onUpdateWaypoint(wp.id, (prev) => ({
                                        ...prev,
                                        stops: prev.stops.map(s => s.id === stop.id ? { ...s, destination: val } : s)
                                      }));
                                    }}
                                    placeholder={isLastStopOfWaypoint ? "Evening destination or RV park..." : "Lunch, gas or scenic stop..."} 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" 
                                  />
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <label className="text-[10px] text-slate-400">Departure Time</label>
                                      {sIdx > 0 && formattedPrevArrTime && (
                                        <span className="text-[9px] text-emerald-400 font-medium" title="Earliest allowed departure">
                                          (&ge; {formattedPrevArrTime})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <select 
                                        value={currentDepH} 
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value, 10);
                                          handleUpdateStopDepartureTime(wp.id, stop.id, sIdx, val, currentDepM, currentDepAP as 'AM' | 'PM', prevStopArrTotalMins);
                                        }}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                                      >
                                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                                          <option key={h} value={h}>{h}</option>
                                        ))}
                                      </select>
                                      <span className="text-slate-400 font-bold">:</span>
                                      <select 
                                        value={currentDepM} 
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value, 10);
                                          handleUpdateStopDepartureTime(wp.id, stop.id, sIdx, currentDepH, val, currentDepAP as 'AM' | 'PM', prevStopArrTotalMins);
                                        }}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                                      >
                                        {Array.from(new Set([0, 15, 30, 45, currentDepM])).sort((a, b) => a - b).map(m => (
                                          <option key={m} value={m}>{m < 10 ? `0${m}` : m}</option>
                                        ))}
                                      </select>
                                      <div className="flex bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shrink-0">
                                        <button 
                                          type="button" 
                                          onClick={() => {
                                            handleUpdateStopDepartureTime(wp.id, stop.id, sIdx, currentDepH, currentDepM, 'AM', prevStopArrTotalMins);
                                          }} 
                                          className={`px-2 py-1.5 text-[11px] font-semibold transition ${currentDepAP === 'AM' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                          AM
                                        </button>
                                        <button 
                                          type="button" 
                                          onClick={() => {
                                            handleUpdateStopDepartureTime(wp.id, stop.id, sIdx, currentDepH, currentDepM, 'PM', prevStopArrTotalMins);
                                          }} 
                                          className={`px-2 py-1.5 text-[11px] font-semibold transition ${currentDepAP === 'PM' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
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

                            {/* Stop Action Bar */}
                            <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2 text-slate-300 flex-wrap">
                                {stop.destination && (
                                  <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
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

                              {/* RV Site Picker Button for Final Overnight Stop */}
                              {isLastStopOfWaypoint && stop.destination && stayCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSitePicker(stop.destination, stayCount, wp.id, sIdx)}
                                  className="bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 hover:text-amber-200 font-semibold px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 shadow-sm transition"
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

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Day Notes &amp; Highlights</label>
                      <textarea 
                        value={wp.notes} 
                        onChange={(e) => onUpdateWaypoint(wp.id, (prev) => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-y"
                      ></textarea>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Bottom Action Bar for Long Itineraries */}
        {waypoints.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 pb-4 bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-slate-700/70 shadow-lg">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded text-[11px]">
                {waypoints.length} {waypoints.length === 1 ? 'Travel Day' : 'Travel Days'}
              </span>
              <span>Ready to add another stop or re-plan?</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button 
                onClick={onOpenAiCopilot} 
                className="flex-1 sm:flex-none bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-3.5 sm:px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i> Plan with AI
              </button>

              <button 
                onClick={onAddWaypoint} 
                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3.5 sm:px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <i className="fa-solid fa-plus"></i> Add Waypoint
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
