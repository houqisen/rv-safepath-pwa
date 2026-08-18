import { RvProfile } from '../types/rv';

export const DEFAULT_PROFILE: RvProfile = {
  rvType: "Travel Trailer",
  heightFeet: 9,
  heightInches: 5,
  lengthFeet: 16,
  combinedLengthFeet: 33,
  weightLbs: 4300,
  towingMpg: 10,
  towSetup: "Trailer Towed by SUV, Truck, or Car",
  propaneStyle: "Portable Cylinders",
  propaneCount: 2,
  propaneLb: 20,
  memberships: ["Good Sam"],
  ampRating: "30A",
  minHookup: "partial",
  batteryType: "Lithium (LiFePO4) - 100Ah",
  solarWatts: "200W - 400W (Moderate Off-Grid)",
  hasDogbone: true,
  hasStarlink: true
};
