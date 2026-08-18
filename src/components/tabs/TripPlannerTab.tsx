import React from 'react';
import { Waypoint, WaypointStop, DestinationWeather } from '../../types/itinerary';
import { RvProfile } from '../../types/rv';
import { getWaypointDisplayDay } from '../../utils/dateUtils';
import { formatResolvedPlaceAddress } from '../../utils/addressUtils';

interface TripPlannerTabProps {
  waypoints: Waypoint[];
  destinationWeathers: Record<string, DestinationWeather>;
  profile: RvProfile;
  onOpenAiCopilot: () => void;
  onOpenSitePicker: (destination: string, stayNights: number, wpId: number, stopIdx: number) => void;
  onAddWaypoint: () => void;
  onClearAll: () => void;
  onUpdateWaypoint: (wpId: number, updater: (wp: Waypoint) => Waypoint) => void;
  onRemoveWaypoint: (wpId: number) => void;
}

export const TripPlannerTab: React.FC<TripPlannerTabProps> = ({
  waypoints,
  destinationWeathers,
  profile,
  onOpenAiCopilot,
  onOpenSitePicker,
  onAddWaypoint,
  onClearAll,
  onUpdateWaypoint,
  onRemoveWaypoint
}) => {
  const setupPlaceAutocomplete = (inputEl: HTMLInputElement | null, onSelected: (address: string) => void) => {
    if (!inputEl || !window.google || !window.google.maps || !window.google.maps.places) return;
    if ((inputEl as any).__autocompleteAttached) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputEl);
      (inputEl as any).__autocompleteAttached = true;
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const formatted = formatResolvedPlaceAddress(place);
        if (formatted) {
          onSelected(formatted);
        }
      });
    } catch (e) {
      console.error("Autocomplete setup error:", e);
    }
  };

  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(38, el.scrollHeight) + 'px';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-5xl mx-auto w-full">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <div>
          <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <i className="fa-solid fa-calendar-days text-emerald-400"></i>
            <span>Multi-Stop RV Trip Itinerary</span>
          </h2>
          <p className="text-xs text-slate-400">Pacing, daylight arrivals, multi-stop driving legs &amp; campground selection.</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenAiCopilot}
            className="flex-1 sm:flex-none bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
            <span>RV SafePath AI Copilot</span>
          </button>
          <button
            type="button"
            onClick={onAddWaypoint}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
          >
            <i className="fa-solid fa-plus text-emerald-400"></i>
            <span>Add Day</span>
          </button>
          {waypoints.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 p-2 rounded-xl text-xs transition"
              title="Clear all waypoints"
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          )}
        </div>
      </div>

      {/* 3-3-3 Rule Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">RV 3-3-3 Safe Pacing:</span>
          <span className="text-slate-400 hidden sm:inline">&le;300 miles driving/day · Arrive before 3:00 PM in daylight · Stay &ge;3 nights at destination</span>
        </div>
        <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">Active Guard</span>
      </div>

      {/* Empty State */}
      {waypoints.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl space-y-3">
          <div className="bg-emerald-500/10 text-emerald-400 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-xl border border-emerald-500/20">
            <i className="fa-solid fa-route"></i>
          </div>
          <h3 className="font-bold text-slate-200 text-sm">No Travel Days Planned Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click "RV SafePath AI Copilot" to generate a complete multi-day itinerary with verified stops, or add days manually.
          </p>
        </div>
      ) : (
        /* Waypoints List */
        <div className="space-y-4">
          {waypoints.map((wp, wpIdx) => {
            const displayDay = getWaypointDisplayDay(waypoints, wpIdx);
            const isHomeReturn = wp.isHomeReturn || (wp.stayNights === 0 && wpIdx > 0);
            const stops = wp.stops || [];
            const finalStop = stops[stops.length - 1];

            return (
              <div
                key={wp.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3 transition hover:border-slate-700"
              >
                {/* Day Header */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-emerald-500 text-slate-950 font-black px-2.5 py-1 rounded-lg text-xs tracking-wider">
                      DAY {displayDay}
                    </span>
                    <span className="text-xs text-slate-400">
                      {isHomeReturn ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <i className="fa-solid fa-house"></i> Return Home Journey
                        </span>
                      ) : (
                        <span>
                          Stay: <strong className="text-emerald-400">{wp.stayNights} Night{wp.stayNights > 1 ? 's' : ''}</strong>
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isHomeReturn && (
                      <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg text-xs">
                        <span className="text-slate-400 text-[10px]">Nights:</span>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={wp.stayNights}
                          onChange={(e) => {
                            const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                            onUpdateWaypoint(wp.id, prev => ({ ...prev, stayNights: n }));
                          }}
                          className="w-10 bg-slate-900 border border-slate-700 rounded px-1 text-center text-xs text-emerald-400 font-bold"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveWaypoint(wp.id)}
                      className="text-slate-400 hover:text-red-400 text-xs p-1 transition"
                      title="Remove Day"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>

                {/* Origin Input */}
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium">Starting Location (Origin)</label>
                  <input
                    ref={(el) => setupPlaceAutocomplete(el, (addr) => {
                      onUpdateWaypoint(wp.id, prev => ({ ...prev, origin: addr }));
                    })}
                    type="text"
                    defaultValue={wp.origin}
                    placeholder="Enter starting city, state, or address..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                  />
                </div>

                {/* Nested Stops Timeline */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Daytime Stops &amp; Overnight Destination ({stops.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newStop: WaypointStop = {
                          id: Date.now(),
                          destination: '',
                          depHour: 10,
                          depMin: 0,
                          depAmPm: 'AM',
                          estMiles: 0,
                          estHours: 0,
                          arrivalHour: 12,
                          arrivalMinute: 0
                        };
                        onUpdateWaypoint(wp.id, prev => ({ ...prev, stops: [...prev.stops, newStop] }));
                      }}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                    >
                      <i className="fa-solid fa-plus text-[10px]"></i> Add Intermediate Stop
                    </button>
                  </div>

                  {stops.map((stop, sIdx) => {
                    const isLastStop = sIdx === stops.length - 1;
                    const stopWeather = destinationWeathers[stop.destination?.trim()];

                    return (
                      <div
                        key={stop.id || sIdx}
                        className={`p-3 rounded-xl border space-y-2 text-xs ${
                          isLastStop
                            ? 'bg-slate-800/80 border-slate-700'
                            : 'bg-slate-850 border-slate-750'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 font-bold text-[11px]">
                            <span className={isLastStop ? 'text-emerald-400' : 'text-sky-400'}>
                              {isLastStop ? '🏁 Final Overnight Stop:' : `📍 Stop ${sIdx + 1}:`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* RV Site Picker for destination stops */}
                            {isLastStop && !isHomeReturn && (
                              <button
                                type="button"
                                onClick={() => onOpenSitePicker(stop.destination, wp.stayNights, wp.id, sIdx)}
                                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 transition"
                              >
                                <i className="fa-solid fa-campground"></i> Top 3 RV Campsites
                              </button>
                            )}

                            {stops.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateWaypoint(wp.id, prev => ({
                                    ...prev,
                                    stops: prev.stops.filter((_, idx) => idx !== sIdx)
                                  }));
                                }}
                                className="text-slate-400 hover:text-red-400 text-xs p-0.5"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Stop Destination Field */}
                        <input
                          ref={(el) => setupPlaceAutocomplete(el, (addr) => {
                            onUpdateWaypoint(wp.id, prev => {
                              const updatedStops = [...prev.stops];
                              updatedStops[sIdx] = { ...updatedStops[sIdx], destination: addr };
                              return { ...prev, stops: updatedStops };
                            });
                          })}
                          type="text"
                          defaultValue={stop.destination}
                          placeholder={isLastStop ? "Overnight Campground or City..." : "Daytime scenic overlook or rest stop..."}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:border-emerald-500"
                        />

                        {/* Weather Badge & Alerts */}
                        {stopWeather && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="bg-sky-500/10 text-sky-300 border border-sky-500/30 text-[10px] px-2 py-0.5 rounded font-medium">
                              🌡️ {stopWeather.temp} · {stopWeather.condition}
                            </span>
                            {stopWeather.hazardAlert && (
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2 py-0.5 rounded font-bold">
                                ⚠️ {stopWeather.hazardAlert}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Day Summary Metrics */}
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 flex flex-wrap justify-between items-center text-xs text-slate-300 gap-2">
                  <div className="flex items-center gap-3">
                    <span>Total Day Distance: <strong className="text-emerald-400">{wp.estMiles || 0} mi</strong></span>
                    <span>Driving Time: <strong className="text-slate-200">~{wp.estHours ? Math.round(wp.estHours * 10) / 10 : 0} hrs</strong></span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Est. Arrival: <strong className="text-amber-400">{wp.arrivalHour || 15}:{String(wp.arrivalMinute || 0).padStart(2, '0')}</strong> in daylight
                  </div>
                </div>

                {/* Notes Textarea */}
                <div>
                  <textarea
                    rows={1}
                    value={wp.notes || ''}
                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                    onChange={(e) => {
                      const txt = e.target.value;
                      onUpdateWaypoint(wp.id, prev => ({ ...prev, notes: txt }));
                    }}
                    placeholder="Add driver notes, campsite confirmation #, turn cautions, or points of interest..."
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 resize-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
