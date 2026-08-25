export interface RvProfile {
  rvType: string;
  heightFeet: number;
  heightInches: number;
  lengthFeet: number;
  combinedLengthFeet: number;
  weightLbs: number;
  towingMpg: number | '';
  towSetup: string;
  propaneStyle: string;
  propaneCount: number;
  propaneLb: number;
  memberships: string[];
  ampRating: string;
  minHookup: 'full' | 'partial' | 'electric' | 'dry' | string;
  batteryType: string;
  solarWatts: string;
  hasDogbone: boolean;
  hasStarlink: boolean;
  isEvTowVehicle?: boolean;
  evModel?: string;
  evTowingRangeMiles?: number;
  evPlugType?: string;
}
