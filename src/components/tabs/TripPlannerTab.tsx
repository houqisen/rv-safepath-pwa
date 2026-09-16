import React, { useRef, useState } from 'react';
import { RvProfile } from '../../types/rv';
import { Waypoint, WaypointStop, DestinationWeather } from '../../types/itinerary';
import { getWaypointDisplayDay, getWaypointDate, formatWaypointDateDisplay } from '../../utils/dateUtils';
import { formatResolvedPlaceAddress, isResidentialAddress, cleanAddressForNavigation } from '../../utils/addressUtils';

interface TripPlannerTabProps {
  waypoints: Waypoint[];
  tripStartDate?: string;
  onUpdateTripStartDate?: (dateStr: string) => void;
  destinationWeathers: Record<string, DestinationWeather>;
  profile: RvProfile;
  isGoogleLoaded?: boolean;
  isLoadingWeather?: boolean;
  onFetchWeather?: () => void;
  onOpenAiCopilot: () => void;
  onOpenSitePicker: (destination: string, stayNights: number, wpId: number, stopIdx: number) => void;
  onAddWaypoint: () => void;
  onClearAll: () => void;
  onUpdateWaypoint: (wpId: number, updater: (wp) => Waypoint) => void;
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

function adjustWaypointStopsSchedule(
  stops: WaypointStop[],
  initialDepHour = 8,
  initialDepMin = 0,
  initialDepAmPm: 'AM' | 'PM' = 'AM',
  enforceCascade = false
): WaypointStop[] {
  if (!stops || stops.length === 0) return [];

  let prevArrTotalMins = 0;

  return stops.map((stop, sIdx) => {
    let depH = stop.depHour !== undefined ? stop.depHour : (sIdx === 0 ? initialDepHour : 12);
    let depM = stop.depMin !== undefined ? stop.depMin : (sIdx === 0 ? initialDepMin : 0);
    let depAP: 'AM' | 'PM' = stop.depAmPm || (sIdx === 0 ? initialDepAmPm : 'PM');

    if (sIdx === 0) {
      depH = initialDepHour;
      depM = initialDepMin;
      depAP = initialDepAmPm;
    }

    let depTotalMins = convertToTotalMinutes(depH, depM, depAP);

    // Only cascade departure times if enforceCascade is true (e.g., when stops are reordered)
    if (enforceCascade && sIdx > 0 && prevArrTotalMins > 0) {
      const defaultBreakMins = 15;
      const minAllowedDep = Math.min(23 * 60 + 45, Math.ceil((prevArrTotalMins + defaultBreakMins) / 15) * 15);
      if (depTotalMins < prevArrTotalMins) {
        depTotalMins = minAllowedDep;
        const parsed = convertFromTotalMinutes(depTotalMins);
        depH = parsed.hour;
        depM = parsed.minute;
        depAP = parsed.ampm;
      }
    }

    const legDrivingMins = stop.estHours && stop.estHours > 0
      ? Math.round(stop.estHours * 60)
      : (stop.estMiles && stop.estMiles > 0 ? Math.round((stop.estMiles / 50) * 60) : 60);

    const tzShiftMins = Math.round((stop.timeZoneShiftFromPrev || 0) * 60);
    const rawArrTotalMins = depTotalMins + legDrivingMins + tzShiftMins;
    const normArrTotalMins = ((rawArrTotalMins % 1440) + 1440) % 1440;
    const arrH24 = Math.floor(normArrTotalMins / 60);
    const arrM = normArrTotalMins % 60;

    prevArrTotalMins = normArrTotalMins;

    return {
      ...stop,
      depHour: depH,
      depMin: depM,
      depAmPm: depAP,
      arrivalHour: arrH24,
      arrivalMinute: arrM
    };
  });
}

export const TripPlannerTab: React.FC<TripPlannerTabProps> = ({
  waypoints,
  tripStartDate,
  onUpdateTripStartDate,
  destinationWeathers,
  profile,
  isGoogleLoaded = false,
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
  const [collapsedStopSections, setCollapsedStopSections] = useState<Record<number, boolean>>({});
  const [collapsedStops, setCollapsedStops] = useState<Record<number, boolean>>({});

  const toggleStopsSection = (wpId: number) => {
    setCollapsedStopSections(prev => ({
      ...prev,
      [wpId]: !prev[wpId]
    }));
  };

  const toggleStopCollapse = (stopId: number) => {
    setCollapsedStops(prev => ({
      ...prev,
      [stopId]: !prev[stopId]
    }));
  };

  const attachAutocomplete = (inputEl: HTMLInputElement | null, onSelected: (addr: string) => void) => {
    if (!inputEl) return;
    // Always keep the latest callback reference on the DOM element so place_changed never calls a stale closure
    (inputEl as any).__onAutocompleteSelect = onSelected;

    if (!window.google || !window.google.maps || !window.google.maps.places) return;
    if (attachedInputsRef.current.has(inputEl)) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputEl, {
        fields: ['formatted_address', 'name', 'geometry']
      });
      attachedInputsRef.current.add(inputEl);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const formatted = formatResolvedPlaceAddress(place) || cleanAddressForNavigation(inputEl.value);
        if (formatted) {
          const handler = (inputEl as any).__onAutocompleteSelect;
          if (handler) handler(formatted);
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

  const handleMoveStop = (wpId: number, stopIndex: number, direction: 'up' | 'down') => {
    onUpdateWaypoint(wpId, (wp) => {
      const currentStops = [...(wp.stops || [])];
      const targetIndex = direction === 'up' ? stopIndex - 1 : stopIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentStops.length) return wp;

      const firstStop = currentStops[0];
      const initialDepH = firstStop?.depHour !== undefined ? firstStop.depHour : 8;
      const initialDepM = firstStop?.depMin !== undefined ? firstStop.depMin : 0;
      const initialDepAP = firstStop?.depAmPm || 'AM';

      // Swap stops
      const temp = currentStops[stopIndex];
      currentStops[stopIndex] = currentStops[targetIndex];
      currentStops[targetIndex] = temp;

      const adjustedStops = adjustWaypointStopsSchedule(currentStops, initialDepH, initialDepM, initialDepAP, true);
      const totalMiles = Math.round(adjustedStops.reduce((sum, s) => sum + (s.estMiles || 0), 0) * 10) / 10;
      const totalHours = adjustedStops.reduce((sum, s) => sum + (s.estHours || 0), 0);
      const lastStop = adjustedStops[adjustedStops.length - 1];

      return {
        ...wp,
        stops: adjustedStops,
        estMiles: totalMiles,
        estHours: totalHours,
        arrivalHour: lastStop ? lastStop.arrivalHour : 15,
        arrivalMinute: lastStop ? (lastStop.arrivalMinute || 0) : 0
      };
    });
  };

  const handleRemoveStop = (wpId: number, stopId: number) => {
    onUpdateWaypoint(wpId, (wp) => {
      const currentStops = wp.stops || [];
      const firstStop = currentStops[0];
      const initialDepH = firstStop?.depHour !== undefined ? firstStop.depHour : 8;
      const initialDepM = firstStop?.depMin !== undefined ? firstStop.depMin : 0;
      const initialDepAP = firstStop?.depAmPm || 'AM';

      const filteredStops = currentStops.filter(s => s.id !== stopId);
      const adjustedStops = adjustWaypointStopsSchedule(filteredStops, initialDepH, initialDepM, initialDepAP, true);

      const totalMiles = Math.round(adjustedStops.reduce((sum, s) => sum + (s.estMiles || 0), 0) * 10) / 10;
      const totalHours = adjustedStops.reduce((sum, s) => sum + (s.estHours || 0), 0);
      const lastStop = adjustedStops[adjustedStops.length - 1];

      return {
        ...wp,
        stops: adjustedStops,
        estMiles: totalMiles,
        estHours: totalHours,
        arrivalHour: lastStop ? lastStop.arrivalHour : 15,
        arrivalMinute: lastStop ? (lastStop.arrivalMinute || 0) : 0
      };
    });
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
    // Always respect the user's explicit AM/PM, Hour, and Minute selection without snapping back
    const reqMins = convertToTotalMinutes(newHour, newMin, newAmPm);
    const { hour, minute, ampm } = convertFromTotalMinutes(reqMins);

    onUpdateWaypoint(wpId, (wp) => {
      const updatedStops = (wp.stops || []).map(s => s.id === stopId ? {
        ...s,
        depHour: hour,
        depMin: minute,
        depAmPm: ampm
      } : s);

      const firstStop = updatedStops[0];
      const initialDepH = firstStop?.depHour !== undefined ? firstStop.depHour : 8;
      const initialDepM = firstStop?.depMin !== undefined ? firstStop.depMin : 0;
      const initialDepAP = firstStop?.depAmPm || 'AM';

      const adjustedStops = adjustWaypointStopsSchedule(updatedStops, initialDepH, initialDepM, initialDepAP, false);
      const totalMiles = Math.round(adjustedStops.reduce((sum, s) => sum + (s.estMiles || 0), 0) * 10) / 10;
      const totalHours = adjustedStops.reduce((sum, s) => sum + (s.estHours || 0), 0);
      const lastStop = adjustedStops[adjustedStops.length - 1];

      return {
        ...wp,
        stops: adjustedStops,
        estMiles: totalMiles,
        estHours: totalHours,
        arrivalHour: lastStop ? lastStop.arrivalHour : 15,
        arrivalMinute: lastStop ? (lastStop.arrivalMinute || 0) : 0
      };
    });
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
          <div className="flex items-center
