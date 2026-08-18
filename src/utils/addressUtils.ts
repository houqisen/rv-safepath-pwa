export const parseDestinationList = (input: string): string[] => {
  if (!input || !input.trim()) return [];
  const rawParts = input.split(/(?:\s*->\s*|\s*-->\s*|\s*&\s*|\s+and\s+)/i);
  return rawParts.map(p => p.trim()).filter(p => p.length > 0);
};

export const formatResolvedPlaceAddress = (place: any): string => {
  if (!place) return '';
  const name = (typeof place.name === 'string' ? place.name : place.displayName?.text || '').trim();
  const addr = (typeof place.formatted_address === 'string' ? place.formatted_address : place.formattedAddress || '').trim();
  
  if (name && addr) {
    // If the address already starts with or contains the specific place name, avoid redundant prefixing
    if (addr.toLowerCase().startsWith(name.toLowerCase())) {
      return addr;
    }
    return `${name}, ${addr}`;
  }
  return addr || name || '';
};
