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
