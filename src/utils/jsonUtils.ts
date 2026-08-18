export const normalizeWaypoints = (parsed: any): any[] => {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    if (parsed[0]?.waypoints && Array.isArray(parsed[0].waypoints)) return parsed[0].waypoints;
    if (parsed[0]?.destination || parsed[0]?.origin || parsed[0]?.stops) return parsed;
  }
  if (parsed.waypoints && Array.isArray(parsed.waypoints)) return parsed.waypoints;
  if (parsed.itinerary && Array.isArray(parsed.itinerary)) return parsed.itinerary;
  return [];
};

export const normalizeSiteResults = (parsed: any): any[] => {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    if (parsed[0]?.sites && Array.isArray(parsed[0].sites)) return parsed[0].sites;
    if (parsed[0]?.name) return parsed;
  }
  if (parsed.sites && Array.isArray(parsed.sites)) return parsed.sites;
  if (parsed.campgrounds && Array.isArray(parsed.campgrounds)) return parsed.campgrounds;
  return [];
};
