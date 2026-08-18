export const parseDestinationList = (input: string): string[] => {
  if (!input || !input.trim()) return [];
  const rawParts = input.split(/(?:\s*->\s*|\s*-->\s*|\s*&\s*|\s+and\s+)/i);
  return rawParts.map(p => p.trim()).filter(p => p.length > 0);
};

export const formatResolvedPlaceAddress = (place: any): string => {
  if (!place) return '';
  const name = place.name?.trim() || '';
  const addr = place.formatted_address?.trim() || '';
  if (name && addr) {
    if (addr.toLowerCase().startsWith(name.toLowerCase())) {
      return addr;
    }
    return `${name}, ${addr}`;
  }
  return addr || name || '';
};
