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
}

export interface AiPlanPreview {
  tripTitle: string;
  summary: string;
  isFeasible: boolean;
  feasibilityWarning: string | null;
  waypoints: any[];
}

export interface DestinationWeather {
  temp: string;
  condition: string;
  hazardAlert: string | null;
}
