export const parseDestinationList = (input: string): string[] => {
  if (!input || !input.trim()) return [];
  const rawParts = input.split(/(?:\s*->\s*|\s*-->\s*|\s*&\s*|\s+and\s+)/i);
  return rawParts.map(p => p.trim()).filter(p => p.length > 0);
};

export const cleanAddressForNavigation = (rawAddress: string): string => {
  if (!rawAddress || !rawAddress.trim()) return '';
  let cleaned = rawAddress.trim();

  // 1. Remove trailing country names (, Canada, , USA, , United States)
  cleaned = cleaned.replace(/,\s*(Canada|USA|United States)$/i, '').trim();

  // 2. Remove Canadian postal code (e.g., "BC V3R 4J5" or "BC V3R4J5" -> "BC")
  cleaned = cleaned.replace(/,\s*([A-Z]{2})\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i, ', $1');
  cleaned = cleaned.replace(/\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i, '');

  // 3. Remove US ZIP code (e.g., "WA 98101" or "WA 98101-1234" -> "WA")
  cleaned = cleaned.replace(/,\s*([A-Z]{2})\s+\d{5}(-\d{4})?$/i, ', $1');
  cleaned = cleaned.replace(/\s+\d{5}(-\d{4})?$/i, '');

  // 4. Remove any lingering trailing commas or whitespace
  cleaned = cleaned.replace(/,\s*$/, '').trim();

  return cleaned;
};

export const formatResolvedPlaceAddress = (place: any): string => {
  if (!place) return '';
  const name = (typeof place.name === 'string' ? place.name : place.displayName?.text || '').trim();
  const rawAddr = (typeof place.formatted_address === 'string' ? place.formatted_address : place.formattedAddress || '').trim();
  const addr = cleanAddressForNavigation(rawAddr);
  
  if (name && addr) {
    // If the address already starts with or contains the specific place name, avoid redundant prefixing
    if (addr.toLowerCase().startsWith(name.toLowerCase())) {
      return addr;
    }
    return `${name}, ${addr}`;
  }
  return addr || name || '';
};

/**
 * Checks if a given destination address represents a private residential street address
 * (e.g. driveway, family house, or home return) where an RV campground site picker is not required.
 */
export const isResidentialAddress = (address: string): boolean => {
  if (!address || !address.trim()) return false;
  const lower = address.toLowerCase().trim();

  // Commercial / campground / park / lodging keywords that SHOULD show RV site picker
  const campingKeywords = [
    'rv', 'campground', 'camping', 'camp', 'koa', 'resort', 'state park',
    'national park', 'provincial park', 'blm', 'recreation', 'rec area',
    'marina', 'hotel', 'motel', 'lodge', 'inn', 'suites', 'casino',
    'fairground', 'fairgrounds', 'travel plaza', 'flying j', 'pilot', "love's",
    'walmart', 'cracker barrel'
  ];

  if (campingKeywords.some(kw => lower.includes(kw))) {
    return false;
  }

  // Explicit private residence keywords
  if (
    lower.includes('home') ||
    lower.includes('residence') ||
    lower.includes('driveway') ||
    lower.includes('moochdock') ||
    lower.includes('my house')
  ) {
    return true;
  }

  // Check if address starts with a street building number: e.g. "14205 SE 36th St", "10376 152 St"
  const startsWithStreetNumber = /^\d+[\w\s-]*\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|boulevard|blvd|place|pl|circle|cir|terrace|ter|loop|trail|trl|pkwy|parkway|crescent|cres|highway|hwy)\b/i.test(lower) ||
    /^\d+\s+[A-Za-z0-9\s.]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\b/i.test(address);

  return startsWithStreetNumber;
};
