import { Waypoint, WaypointStop } from '../types/itinerary';
import { RouteSummary } from '../types/places';
import { RvProfile } from '../types/rv';

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
      arrivalMinute: 0
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

          // For stops after stop 0: if departure was set before previous stop arrival, cascade departure to previous arrival
          if (sIdx > 0 && prevArrivalTotalMins > 0 && stopDepTotalMins < prevArrivalTotalMins) {
            stopDepTotalMins = prevArrivalTotalMins;
            const newDepH24 = Math.floor(stopDepTotalMins / 60) % 24;
            depH = newDepH24 % 12 || 12;
            depM = stopDepTotalMins % 60;
            depAP = newDepH24 >= 12 ? 'PM' : 'AM';
          }

          // Calculate arrival time for this stop
          const stopArrTotalMins = stopDepTotalMins + legDrivingMins;
          const arrH24 = Math.floor(stopArrTotalMins / 60) % 24;
          const arrH = arrH24;
          const arrM = stopArrTotalMins % 60;

          // Update prevArrivalTotalMins for the next stop
          prevArrivalTotalMins = stopArrTotalMins;

          return {
            ...stop,
            depHour: depH,
            depMin: depM,
            depAmPm: depAP,
            estMiles: legMiles,
            estHours: legHours,
            arrivalHour: arrH,
            arrivalMinute: arrM
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

        onCalculated({
          ...waypoint,
          stops: updatedStops,
          estMiles: totalMiles,
          estHours: totalHours,
          arrivalHour: finalArrH,
          arrivalMinute: finalArrM
        });
      }
    }
  );
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
