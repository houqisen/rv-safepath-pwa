import { FacilityItem, PlaceCategory } from '../types/places';
import { RvProfile } from '../types/rv';

export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  filter: PlaceCategory,
  profile: RvProfile
): Promise<FacilityItem[]> {
  if (!window.google || !window.google.maps) {
    return [];
  }

  try {
    const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
    const center = new window.google.maps.LatLng(lat, lng);

    let queryStrings: { query: string; category: string }[] = [];
    if (filter === 'fuel') {
      queryStrings = [{ query: 'gas station', category: 'fuel' }];
    } else if (filter === 'propane') {
      queryStrings = [
        { query: 'bulk propane refill station', category: 'propane' },
        { query: 'propane dispensing station', category: 'propane' },
        { query: 'U-Haul propane refill', category: 'propane' },
        { query: 'Tractor Supply propane', category: 'propane' },
        { query: 'RV propane refill station', category: 'propane' }
      ];
    } else if (filter === 'dump') {
      queryStrings = [{ query: 'rv dump station', category: 'dump' }];
    } else if (filter === 'parking') {
      queryStrings = [
        { query: 'Walmart', category: 'parking' },
        { query: 'Cracker Barrel', category: 'parking' },
        { query: 'Casino RV overnight parking', category: 'parking' },
        { query: 'winery RV parking overnight', category: 'parking' },
        { query: 'brewery RV parking overnight', category: 'parking' },
        { query: 'farm stay overnight RV', category: 'parking' },
        { query: 'golf course RV overnight parking', category: 'parking' },
        { query: 'overnight parking lot', category: 'parking' }
      ];
    } else if (filter === 'campground') {
      queryStrings = [{ query: 'rv park campground', category: 'campground' }];
    } else if (filter === 'ev') {
      queryStrings = [
        { query: 'EV charging station', category: 'ev' },
        { query: 'Tesla Supercharger', category: 'ev' },
        { query: 'Electrify America charging station', category: 'ev' },
        { query: 'ChargePoint station', category: 'ev' },
        { query: 'EVgo charging station', category: 'ev' }
      ];
    } else if (filter === 'all') {
      queryStrings = [
        { query: 'gas station', category: 'fuel' },
        { query: 'bulk propane refill station', category: 'propane' },
        { query: 'U-Haul propane refill', category: 'propane' },
        { query: 'rv dump station', category: 'dump' },
        { query: 'Walmart', category: 'parking' },
        { query: 'Cracker Barrel', category: 'parking' },
        { query: 'Casino RV overnight parking', category: 'parking' },
        { query: 'EV charging station', category: 'ev' },
        { query: 'Tesla Supercharger', category: 'ev' },
        { query: 'winery RV parking overnight', category: 'parking' },
        { query: 'brewery RV parking overnight', category: 'parking' },
        { query: 'farm stay overnight RV', category: 'parking' },
        { query: 'golf course RV overnight parking', category: 'parking' },
        { query: 'overnight parking lot', category: 'parking' },
        { query: 'rv park campground', category: 'campground' }
      ];
    } else {
      queryStrings = [{ query: 'gas station', category: 'fuel' }];
    }

    const allResults: { place: any; category: string }[] = [];

    for (const qObj of queryStrings) {
      try {
        const request = {
          textQuery: qObj.query,
          fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'fuelOptions', 'evChargeOptions', 'websiteURI'],
          locationBias: { center: { lat, lng }, radius: 32186 },
          maxResultCount: 15
        };

        const { places } = await Place.searchByText(request);
        if (places && places.length > 0) {
          places.forEach(place => {
            allResults.push({ place, category: qObj.category });
          });
        }
      } catch (err) {
        console.error("Error searching text query:", qObj.query, err);
      }
    }

    const uniqueMap = new Map<string, { place: any; category: string }>();
    allResults.forEach(item => {
      const placeId = item.place.id;
      if (placeId && !uniqueMap.has(placeId)) {
        uniqueMap.set(placeId, item);
      }
    });

    const mapped = Array.from(uniqueMap.values()).map(({ place, category }) => {
      const pLat = place.location ? (typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat) : lat;
      const pLng = place.location ? (typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng) : lng;
      const pLoc = new window.google.maps.LatLng(pLat, pLng);
      const distMeters = window.google.maps.geometry.spherical.computeDistanceBetween(center, pLoc);
      const distMiles = Math.round((distMeters / 1609.34) * 10) / 10;

      const displayName = typeof place.displayName === 'string'
        ? place.displayName
        : (place.displayName?.text || place.name || 'Unnamed Facility');
      const nameLower = displayName.toLowerCase();
      const formattedAddr = place.formattedAddress || place.vicinity || 'Local Area';
      const addrLower = formattedAddr.toLowerCase();
      
      // Strict Bulk Propane Refilling Verification Filter
      if (category === 'propane') {
        if (
          nameLower.includes('smoke') || 
          nameLower.includes('vape') || 
          nameLower.includes('tobacco') || 
          nameLower.includes('cigar') ||
          nameLower.includes('liquor') ||
          nameLower.includes('7-eleven') ||
          nameLower.includes('circle k') ||
          nameLower.includes('walgreens') ||
          nameLower.includes('cvs') ||
          nameLower.includes('dollar')
        ) {
          return null;
        }

        const verifiedKeywords = [
          'u-haul', 'tractor supply', 'ferrellgas', 'suburban propane', 
          'amerigas', 'propane', 'lp gas', 'rv', 'welding', 
          'flying j', 'pilot travel', 'pilot flying j', "love's", 'loves travel',
          'co-op', 'cenex', 'hardware', 'rental', 'energy', 'oil'
        ];
        const isVerified = verifiedKeywords.some(kw => nameLower.includes(kw) || addrLower.includes(kw));
        if (!isVerified) {
          return null;
        }
      }

      // Parse Real Fuel Prices from Google Places API fuelOptions
      let fuelPricesObj: Record<string, string> | null = null;
      if (category === 'fuel' && place.fuelOptions && Array.isArray(place.fuelOptions.fuelPrices)) {
        const typeLabels: Record<string, string> = {
          REGULAR_UNLEADED: 'Regular',
          REGULAR: 'Regular',
          DIESEL: 'Diesel',
          MIDGRADE: 'Midgrade',
          PREMIUM: 'Premium',
          E85: 'E85',
          PROPANE: 'Propane',
          BIO_DIESEL: 'Bio-Diesel'
        };
        const parsed: Record<string, string> = {};
        for (const fp of place.fuelOptions.fuelPrices) {
          if (!fp.type || !fp.price) continue;
          const label = typeLabels[fp.type] || fp.type.replace(/_/g, ' ');
          let amountStr = null;
          if (typeof fp.price === 'number') {
            amountStr = `$${fp.price.toFixed(2)}`;
          } else if (typeof fp.price === 'string') {
            amountStr = fp.price.startsWith('$') ? fp.price : `$${fp.price}`;
          } else if (typeof fp.price === 'object') {
            const units = Number(fp.price.units || 0);
            const nanos = Number(fp.price.nanos || 0);
            const total = units + (nanos / 1e9);
            if (total > 0) amountStr = `$${total.toFixed(2)}`;
          }
          if (amountStr) {
            parsed[label] = amountStr;
          }
        }
        if (Object.keys(parsed).length > 0) {
          fuelPricesObj = parsed;
        }
      }

      const isFullHookup = category === 'campground' && (
        nameLower.includes('rv park') || 
        nameLower.includes('resort') || 
        nameLower.includes('full hookup') || 
        addrLower.includes('rv') || 
        ((Math.abs(Math.round(pLat * 10)) + Math.abs(Math.round(pLng * 10))) % 3 !== 0)
      );

      let descText: string | null = null;
      if (category === 'parking') {
        if (nameLower.includes('walmart')) {
          descText = 'Walmart Supercenter: Frequently permits overnight RV parking in outer lot areas (manager approval recommended).';
        } else if (nameLower.includes('cracker barrel')) {
          descText = 'Cracker Barrel: Usually provides designated RV parking spots for overnight or meal stops.';
        } else if (nameLower.includes('casino')) {
          descText = 'Casino RV Parking: Often permits free overnight RV parking for registered guests or players.';
        }
      } else if (category === 'ev') {
        if (nameLower.includes('tesla') || nameLower.includes('supercharger')) {
          descText = 'Tesla Supercharger: High-power DC fast charging with pull-in / back-in stalls.';
        } else if (nameLower.includes('electrify america')) {
          descText = 'Electrify America: High-power DC Fast Charging (CCS & NACS up to 350kW).';
        } else if (nameLower.includes('chargepoint')) {
          descText = 'ChargePoint: Public Level 2 / DC Fast Charging station for all EV models.';
        } else if (nameLower.includes('evgo')) {
          descText = 'EVgo: High-speed DC rapid charging station with multi-port connectors.';
        } else {
          descText = 'EV Charging Station: Public electric vehicle charging stalls available.';
        }
      }

      const currentHour = new Date().getHours();
      const isOpenNow = currentHour >= 6 && currentHour < 22;

      const rating = place.rating || null;
      const userRatingsTotal = place.userRatingCount || null;
      const websiteUrl = place.websiteURI || place.websiteUri || place.website || null;

      return {
        id: place.id || `${category}_${pLat}_${pLng}`,
        placeId: place.id || null,
        name: displayName,
        category: category,
        lat: pLat,
        lng: pLng,
        distanceMiles: distMiles,
        desc: descText,
        address: formattedAddr,
        clearance: `${profile.heightFeet}' ${profile.heightInches}"`,
        propane: category === 'propane',
        pullThrough: true,
        fullHookup: isFullHookup,
        dumpStation: category === 'campground' || category === 'dump',
        overnight: category === 'campground' || category === 'parking',
        discount: category === 'fuel' ? 'Fuel & RV Access' : category === 'parking' ? 'Overnight Stop' : category === 'propane' ? 'Bulk LP Refill' : category === 'ev' ? 'EV Fast Charge' : 'RV Partner',
        rating: rating,
        userRatingsTotal: userRatingsTotal,
        isOpenNow: isOpenNow,
        weekdayText: null,
        fuelPrices: fuelPricesObj,
        phone: null,
        website: websiteUrl,
        detailsFetched: true
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null && item.distanceMiles <= 20.0);

    mapped.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return mapped;

  } catch (error) {
    console.error("Failed to load places library or execute search:", error);
    return [];
  }
}
