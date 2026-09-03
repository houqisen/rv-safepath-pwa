export interface TimeZoneInfo {
  name: string;
  abbr: string;
  offsetHours: number;
}

// US and Canadian State/Province Time Zone Mappings
const PACIFIC_REGIONS = new Set([
  'WA', 'WASHINGTON',
  'OR', 'OREGON',
  'CA', 'CALIFORNIA',
  'NV', 'NEVADA',
  'BC', 'BRITISH COLUMBIA',
  'YT', 'YUKON'
]);

const MOUNTAIN_REGIONS = new Set([
  'MT', 'MONTANA',
  'ID', 'IDAHO',
  'WY', 'WYOMING',
  'UT', 'UTAH',
  'CO', 'COLORADO',
  'AZ', 'ARIZONA',
  'NM', 'NEW MEXICO',
  'AB', 'ALBERTA',
  'NT', 'NORTHWEST TERRITORIES'
]);

const CENTRAL_REGIONS = new Set([
  'ND', 'NORTH DAKOTA',
  'SD', 'SOUTH DAKOTA',
  'NE', 'NEBRASKA',
  'KS', 'KANSAS',
  'OK', 'OKLAHOMA',
  'TX', 'TEXAS',
  'MN', 'MINNESOTA',
  'IA', 'IOWA',
  'MO', 'MISSOURI',
  'AR', 'ARKANSAS',
  'LA', 'LOUISIANA',
  'WI', 'WISCONSIN',
  'IL', 'ILLINOIS',
  'MS', 'MISSISSIPPI',
  'AL', 'ALABAMA',
  'TN', 'TENNESSEE',
  'KY', 'KENTUCKY',
  'SK', 'SASKATCHEWAN',
  'MB', 'MANITOBA',
  'NU', 'NUNAVUT'
]);

const EASTERN_REGIONS = new Set([
  'MI', 'MICHIGAN',
  'IN', 'INDIANA',
  'OH', 'OHIO',
  'GA', 'GEORGIA',
  'FL', 'FLORIDA',
  'SC', 'SOUTH CAROLINA',
  'NC', 'NORTH CAROLINA',
  'VA', 'VIRGINIA',
  'WV', 'WEST VIRGINIA',
  'MD', 'MARYLAND',
  'DE', 'DELAWARE',
  'PA', 'PENNSYLVANIA',
  'NJ', 'NEW JERSEY',
  'NY', 'NEW YORK',
  'CT', 'CONNECTICUT',
  'RI', 'RHODE ISLAND',
  'MA', 'MASSACHUSETTS',
  'VT', 'VERMONT',
  'NH', 'NEW HAMPSHIRE',
  'ME', 'MAINE',
  'DC', 'DISTRICT OF COLUMBIA',
  'ON', 'ONTARIO',
  'QC', 'QUEBEC'
]);

const ATLANTIC_REGIONS = new Set([
  'NB', 'NEW BRUNSWICK',
  'NS', 'NOVA SCOTIA',
  'PE', 'PRINCE EDWARD ISLAND'
]);

const NEWFOUNDLAND_REGIONS = new Set([
  'NL', 'NEWFOUNDLAND', 'NEWFOUNDLAND AND LABRADOR'
]);

const ALASKA_REGIONS = new Set([
  'AK', 'ALASKA'
]);

const HAWAII_REGIONS = new Set([
  'HI', 'HAWAII'
]);

/**
 * Returns whether Daylight Saving Time (DST) is currently active.
 * In US/Canada: 2nd Sunday in March to 1st Sunday in November.
 */
function isDaylightSavingTime(date: Date = new Date()): boolean {
  // Standard approximation: March through October is DST in northern hemisphere
  const month = date.getMonth();
  return month >= 2 && month <= 10;
}

/**
 * Extracts state or province code/name from an address string.
 */
function extractRegionFromAddress(address: string): string | null {
  if (!address) return null;
  const upper = address.toUpperCase();

  // Pattern 1: State code after comma: e.g. ", WA", ", BC", ", MT"
  const codeMatch = upper.match(/,\s*([A-Z]{2})\b/);
  if (codeMatch && codeMatch[1]) {
    return codeMatch[1];
  }

  // Pattern 2: Explicit full state or province names
  const allRegions = [
    ...Array.from(PACIFIC_REGIONS),
    ...Array.from(MOUNTAIN_REGIONS),
    ...Array.from(CENTRAL_REGIONS),
    ...Array.from(EASTERN_REGIONS),
    ...Array.from(ATLANTIC_REGIONS),
    ...Array.from(NEWFOUNDLAND_REGIONS),
    ...Array.from(ALASKA_REGIONS),
    ...Array.from(HAWAII_REGIONS)
  ];

  for (const reg of allRegions) {
    if (reg.length > 2) {
      const regex = new RegExp(`\\b${reg}\\b`, 'i');
      if (regex.test(upper)) {
        return reg;
      }
    }
  }

  return null;
}

/**
 * Resolves TimeZoneInfo for a given location (via address text and optional lat/lng).
 */
export function getTimeZoneInfo(
  address: string,
  lat?: number,
  lng?: number,
  utcOffsetMinutes?: number
): TimeZoneInfo {
  const dst = isDaylightSavingTime();

  // If explicit Google Places utcOffsetMinutes is provided and valid
  if (typeof utcOffsetMinutes === 'number' && !isNaN(utcOffsetMinutes)) {
    const hours = utcOffsetMinutes / 60;
    if (hours === -7 || hours === -8) {
      return { name: 'Pacific Time', abbr: dst ? 'PDT' : 'PST', offsetHours: hours };
    } else if (hours === -6 || hours === -7) {
      return { name: 'Mountain Time', abbr: dst ? 'MDT' : 'MST', offsetHours: hours };
    } else if (hours === -5 || hours === -6) {
      return { name: 'Central Time', abbr: dst ? 'CDT' : 'CST', offsetHours: hours };
    } else if (hours === -4 || hours === -5) {
      return { name: 'Eastern Time', abbr: dst ? 'EDT' : 'EST', offsetHours: hours };
    }
  }

  const region = extractRegionFromAddress(address);

  if (region) {
    if (PACIFIC_REGIONS.has(region)) {
      return {
        name: 'Pacific Time',
        abbr: dst ? 'PDT' : 'PST',
        offsetHours: dst ? -7 : -8
      };
    }
    if (MOUNTAIN_REGIONS.has(region)) {
      // Arizona does not observe DST (except Navajo Nation), stays UTC-7 (MST)
      const isAz = region === 'AZ' || region === 'ARIZONA';
      return {
        name: 'Mountain Time',
        abbr: isAz ? 'MST' : (dst ? 'MDT' : 'MST'),
        offsetHours: isAz ? -7 : (dst ? -6 : -7)
      };
    }
    if (CENTRAL_REGIONS.has(region)) {
      // Saskatchewan does not observe DST, stays UTC-6 (CST)
      const isSk = region === 'SK' || region === 'SASKATCHEWAN';
      return {
        name: 'Central Time',
        abbr: isSk ? 'CST' : (dst ? 'CDT' : 'CST'),
        offsetHours: isSk ? -6 : (dst ? -5 : -6)
      };
    }
    if (EASTERN_REGIONS.has(region)) {
      return {
        name: 'Eastern Time',
        abbr: dst ? 'EDT' : 'EST',
        offsetHours: dst ? -4 : -5
      };
    }
    if (ATLANTIC_REGIONS.has(region)) {
      return {
        name: 'Atlantic Time',
        abbr: dst ? 'ADT' : 'AST',
        offsetHours: dst ? -3 : -4
      };
    }
    if (NEWFOUNDLAND_REGIONS.has(region)) {
      return {
        name: 'Newfoundland Time',
        abbr: dst ? 'NDT' : 'NST',
        offsetHours: dst ? -2.5 : -3.5
      };
    }
    if (ALASKA_REGIONS.has(region)) {
      return {
        name: 'Alaska Time',
        abbr: dst ? 'AKDT' : 'AKST',
        offsetHours: dst ? -8 : -9
      };
    }
    if (HAWAII_REGIONS.has(region)) {
      return {
        name: 'Hawaii Time',
        abbr: 'HST',
        offsetHours: -10
      };
    }
  }

  // Fallback to Longitude approximation if coordinates are present
  if (typeof lng === 'number' && !isNaN(lng)) {
    if (lng < -114.5) {
      return { name: 'Pacific Time', abbr: dst ? 'PDT' : 'PST', offsetHours: dst ? -7 : -8 };
    } else if (lng >= -114.5 && lng < -104.0) {
      return { name: 'Mountain Time', abbr: dst ? 'MDT' : 'MST', offsetHours: dst ? -6 : -7 };
    } else if (lng >= -104.0 && lng < -86.5) {
      return { name: 'Central Time', abbr: dst ? 'CDT' : 'CST', offsetHours: dst ? -5 : -6 };
    } else if (lng >= -86.5 && lng < -67.0) {
      return { name: 'Eastern Time', abbr: dst ? 'EDT' : 'EST', offsetHours: dst ? -4 : -5 };
    } else if (lng >= -67.0 && lng < -59.0) {
      return { name: 'Atlantic Time', abbr: dst ? 'ADT' : 'AST', offsetHours: dst ? -3 : -4 };
    } else if (lng >= -59.0) {
      return { name: 'Newfoundland Time', abbr: dst ? 'NDT' : 'NST', offsetHours: dst ? -2.5 : -3.5 };
    }
  }

  // Default fallback to Pacific Time if unknown
  return {
    name: 'Pacific Time',
    abbr: dst ? 'PDT' : 'PST',
    offsetHours: dst ? -7 : -8
  };
}

/**
 * Calculates the net time zone shift (in hours) between departure and destination.
 * Positive value = Destination is ahead (e.g. PT -> MT is +1h, clock moves forward).
 * Negative value = Destination is behind (e.g. MT -> PT is -1h, clock moves backward).
 */
export function calculateTimeZoneShift(
  depAddress: string,
  destAddress: string,
  depCoords?: { lat: number; lng: number },
  destCoords?: { lat: number; lng: number }
): {
  shiftHours: number;
  depTz: TimeZoneInfo;
  destTz: TimeZoneInfo;
} {
  const depTz = getTimeZoneInfo(depAddress, depCoords?.lat, depCoords?.lng);
  const destTz = getTimeZoneInfo(destAddress, destCoords?.lat, destCoords?.lng);
  const shiftHours = Math.round((destTz.offsetHours - depTz.offsetHours) * 10) / 10;

  return {
    shiftHours,
    depTz,
    destTz
  };
}
