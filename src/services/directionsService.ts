import { Waypoint, WaypointStop } from '../types/itinerary';
import { RouteSummary } from '../types/places';
import { RvProfile } from '../types/rv';
import { calculateTimeZoneShift, getTimeZoneInfo } from '../utils/timezoneUtils';

export function calculateWaypointMetricsService(
  waypoint: Waypoint,
  onCalculated: (updatedWp: Waypoint) => void
): void {
  if (!window.google || !window.google.maps) return;

  const origin = waypoint.origin?.trim();
  const stops = waypoint.stops || [];
  const validDests = stops.map(s => s.destination?.trim()).filter(Boolean);

  if (!origin || validDests.length === 0) {
    onCalculated({
      ...waypoint,
      estMiles: 0,
      estHours: 0,
      arrivalHour: 15,
      arrivalMinute: 0,
      hasUnreachableStop: false
    });
    return;
  }

  const finalDestination = validDests[validDests.length - 1];
  const waypointsParam = validDests.slice(0, validDests.length - 1).map(d => ({ location: d, stopover: true }));

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
        const warnings = result.routes[0].warnings || [];
        const closureWarning = warnings.find(w => /closed|closure|wildfire|hazard|emergency|snow|ferry/i.test(w)) || null;

        let totalMeters = 0;
        let totalSeconds = 0;
        let prevArrivalTotalMins = 0;

        const updatedStops: WaypointStop[] = stops.map((stop, sIdx) => {
          const leg = legs[sIdx];
          if (!leg) return stop;

          const legMeters = leg.distance?.value || 0;
          const legSeconds = leg.duration?.value || 0;
          const legMiles = Math.round((legMeters / 1609.34) * 10) / 10;
          const legHours = legSeconds / 3600;
          const legDrivingMins = Math.round(legSeconds / 60);

          let depH = stop.depHour !== undefined ? stop.depHour : (sIdx === 0 ? 8 : 12);
          let depM = stop.depMin !== undefined ? stop.depMin : 0;
          let depAP = stop.depAmPm || (sIdx === 0 ? 'AM' : 'PM');

          // Convert departure time to minutes from midnight
          let depBaseH = depH % 12;
          if (depAP === 'PM') depBaseH += 12;
          let stopDepTotalMins = depBaseH * 60 + depM;

          // For stops after stop 0: if departure was set before previous stop arrival (or user didn't specify a valid time),
          // cascade departure to previous stop arrival + 15 min default stay (rounded to 15-min increments)
          if (sIdx > 0 && prevArrivalTotalMins !== undefined && stopDepTotalMins < prevArrivalTotalMins) {
            stopDepTotalMins = Math.min(23 * 60 + 45, Math.ceil((prevArrivalTotalMins + 15) / 15) * 15);
            const newDepH24 = Math.floor(stopDepTotalMins / 60) % 24;
            depH = newDepH24 % 12 || 12;
            depM = stopDepTotalMins % 60;
            depAP = newDepH24 >= 12 ? 'PM' : 'AM';
          }

          // CR #1: Calculate time zone shift for this leg
          const legDepAddr = sIdx === 0 ? origin : stops[sIdx - 1].destination;
          const legDestAddr = stop.destination;
          const depCoords = leg.start_location ? { lat: leg.start_location.lat(), lng: leg.start_location.lng() } : undefined;
          const destCoords = leg.end_location ? { lat: leg.end_location.lat(), lng: leg.end_location.lng() } : undefined;

          const tzResult = calculateTimeZoneShift(legDepAddr, legDestAddr, depCoords, destCoords);
          const tzShiftHours = tzResult.shiftHours;

          // Arrival time in destination's local time: Departure + Driving Time + Time Zone Shift
          const rawArrTotalMins = stopDepTotalMins + legDrivingMins + Math.round(tzShiftHours * 60);
          const normArrTotalMins = ((rawArrTotalMins % 1440) + 1440) % 1440;
          const arrH24 = Math.floor(normArrTotalMins / 60);
          const arrM = normArrTotalMins % 60;

          // Update prevArrivalTotalMins for subsequent stop (in current stop's local time)
          prevArrivalTotalMins = normArrTotalMins;

          return {
            ...stop,
            depHour: depH,
            depMin: depM,
            depAmPm: depAP,
            estMiles: legMiles,
            estHours: legHours,
            arrivalHour: arrH24,
            arrivalMinute: arrM,
            timeZoneAbbr: tzResult.destTz.abbr,
            timeZoneOffsetHours: tzResult.destTz.offsetHours,
            timeZoneShiftFromPrev: tzShiftHours,
            isUnreachable: false,
            reachabilityWarning: closureWarning || null
          };
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

        const originTz = getTimeZoneInfo(origin);
        const finalTz = finalStop?.timeZoneAbbr ? { abbr: finalStop.timeZoneAbbr, offsetHours: finalStop.timeZoneOffsetHours || originTz.offsetHours } : originTz;
        const totalTzShift = Math.round((finalTz.offsetHours - originTz.offsetHours) * 10) / 10;

        onCalculated({
          ...waypoint,
          stops: updatedStops,
          estMiles: totalMiles,
          estHours: totalHours,
          arrivalHour: finalArrH,
          arrivalMinute: finalArrM,
          destTimeZoneAbbr: finalTz.abbr,
          totalTimeZoneShift: totalTzShift,
          hasUnreachableStop: false
        });
      } else {
        // CR #3: Route failed (ZERO_RESULTS or NOT_FOUND) -> Pinpoint which stop is unreachable
        console.warn("Directions route returned status:", status, "- verifying individual leg reachability...");
        checkIndividualLegReachability(directionsService, origin, stops).then((diagnosedStops) => {
          const hasUnreachable = diagnosedStops.some(s => s.isUnreachable);
          onCalculated({
            ...waypoint,
            stops: diagnosedStops,
            hasUnreachableStop: hasUnreachable
          });
        });
      }
    }
  );
}

/**
 * Fallback diagnostic: tests individual legs when composite route fails,
 * isolating exactly which stop is unreachable due to road closures, wildfires, or terrain.
 */
async function checkIndividualLegReachability(
  directionsService: google.maps.DirectionsService,
  origin: string,
  stops: WaypointStop[]
): Promise<WaypointStop[]> {
  const diagnosed = [...stops];

  for (let i = 0; i < diagnosed.length; i++) {
    const from = i === 0 ? origin : diagnosed[i - 1].destination;
    const to = diagnosed[i].destination;

    if (!from?.trim() || !to?.trim()) continue;

    await new Promise<void>((resolve) => {
      directionsService.route(
        {
          origin: from,
          destination: to,
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (res, st) => {
          if (st === window.google.maps.DirectionsStatus.OK && res && res.routes[0]) {
            const leg = res.routes[0].legs[0];
            const miles = Math.round(((leg.distance?.value || 0) / 1609.34) * 10) / 10;
            const hours = (leg.duration?.value || 0) / 3600;
            const warnings = res.routes[0].warnings || [];
            const closureWarn = warnings.find(w => /closed|closure|wildfire|hazard|emergency|snow/i.test(w)) || null;

            diagnosed[i] = {
              ...diagnosed[i],
              estMiles: miles,
              estHours: hours,
              isUnreachable: false,
              reachabilityWarning: closureWarn
            };
          } else {
            diagnosed[i] = {
              ...diagnosed[i],
              isUnreachable: true,
              reachabilityWarning: "No drivable route found. The road may be closed due to wildfires, seasonal conditions, or impassable terrain."
            };
          }
          resolve();
        }
      );
    });
  }

  return diagnosed;
}

export function calculateSafeRouteService(
  origin: string,
  destination: string,
  profile: RvProfile,
  onSuccess: (summary: RouteSummary, overviewPath: any[]) => void,
  onError: (errorMsg: string) => void
): void {
  if (!destination || !window.google || !window.google.maps) return;

  const directionsService = new window.google.maps.DirectionsService();
  directionsService.route(
    {
      origin: origin,
      destination: destination,
      travelMode: window.google.maps.TravelMode.DRIVING,
      avoidHighways: false,
      avoidTolls: false
    },
    (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK && result && result.routes[0]) {
        const route = result.routes[0].legs[0];
        const distanceMeters = route.distance?.value || 0;
        const miles = Math.round((distanceMeters / 1609.34) * 10) / 10;
        const hours = Math.floor(miles / 52);
        const mins = Math.round(((miles / 52) - hours) * 60);
        const avgMpg = Number(profile.towingMpg) || 10;
        const fuelExpense = Math.round((miles / avgMpg) * 3.85);

        const summary: RouteSummary = {
          distanceMiles: miles,
          travelTime: `${hours} hrs ${mins} mins`,
          fuelExpense: fuelExpense,
          avgMpg: avgMpg,
          hazardNotice: `Checked Clear: Safe path configured for ${profile.heightFeet}'${profile.heightInches}" height clearance, ${profile.weightLbs.toLocaleString()} lbs weight limit, and ${avgMpg} Towing MPG.`
        };

        onSuccess(summary, result.routes[0].overview_path);
      } else {
        onError("No driving route found between these locations. Please select valid connected driving locations.");
      }
    }
  );
}
