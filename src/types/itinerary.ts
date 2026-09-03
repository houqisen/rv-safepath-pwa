export interface WaypointStop {
  id: number;
  destination: string;
  depHour: number;
  depMin: number;
  depAmPm: 'AM' | 'PM';
  estMiles: number;
  estHours: number;
  arrivalHour: number;
  arrivalMinute: number;
  // CR #1 Time Zone Support
  timeZoneAbbr?: string;
  timeZoneOffsetHours?: number;
  timeZoneShiftFromPrev?: number;
  // CR #3 Reachability & Road Closure Alerts
  isUnreachable?: boolean;
  reachabilityWarning?: string | null;
}

export interface Waypoint {
  id: number;
  origin: string;
  isExpanded?: boolean;
  isHomeReturn?: boolean;
  stops: WaypointStop[];
  notes: string;
  stayNights: number;
  estMiles: number;
  estHours: number;
  arrivalHour: number;
  arrivalMinute: number;
  // CR #1 & CR #3 Waypoint-level summaries
  destTimeZoneAbbr?: string;
  totalTimeZoneShift?: number;
  hasUnreachableStop?: boolean;
}

export interface AiPlanPreview {
  tripTitle: string;
  summary: string;
  isFeasible: boolean;
  feasibilityWarning: string | null;
  waypoints: any[];
  tripStartDate?: string;
}

export interface ItineraryCloudData {
  waypoints: Waypoint[];
  tripStartDate?: string;
}

export interface DestinationWeather {
  temp: string;
  condition: string;
  hazardAlert: string | null;
}
