export type PlaceCategory = 'fuel' | 'propane' | 'dump' | 'parking' | 'campground' | 'ev' | 'all';

export interface FacilityItem {
  id: string;
  placeId: string | null;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  desc: string | null;
  address: string;
  clearance: string;
  propane: boolean;
  pullThrough: boolean;
  fullHookup: boolean;
  dumpStation: boolean;
  overnight: boolean;
  discount: string;
  rating: number | null;
  userRatingsTotal: number | null;
  isOpenNow: boolean | null;
  weekdayText: string[] | null;
  fuelPrices: Record<string, string> | null;
  phone: string | null;
  website: string | null;
  detailsFetched: boolean;
}

export interface RouteSummary {
  distanceMiles: number;
  travelTime: string;
  fuelExpense: number;
  avgMpg: number;
  hazardNotice: string;
}

export interface RvCampsiteRecommendation {
  name: string;
  address: string;
  category: string;
  proximity: string;
  viewSetting: string;
  padType: string;
  hookups: string;
  turnEase: string;
  connectivity: string;
  amenities: string;
  priceDiscounts: string;
  bestFor: string;
}

export interface RvSitePickerResults {
  location: string;
  sites: RvCampsiteRecommendation[];
}
