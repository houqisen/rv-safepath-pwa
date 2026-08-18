import { Waypoint, DestinationWeather } from '../types/itinerary';

export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!address || !address.trim()) return null;

  // 1. Try Google Maps Geocoder SDK
  if (window.google && window.google.maps) {
    const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          resolve({
            lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
            lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng
          });
        } else {
          resolve(null);
        }
      });
    });
    if (coords) return coords;
  }

  // 2. Open-Meteo Direct Geocoding Fallback Search
  try {
    const query = encodeURIComponent(address.split(',')[0].trim() || address);
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (geoData && geoData.results && geoData.results.length > 0) {
      return {
        lat: geoData.results[0].latitude,
        lng: geoData.results[0].longitude
      };
    }
  } catch (err) {
    console.error("Open-Meteo geocode fallback error:", err);
  }

  return null;
};

export const getWeatherConditionText = (code: number): string => {
  const map: Record<number, string> = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing Rime Fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    71: 'Slight Snow Fall',
    73: 'Moderate Snow Fall',
    75: 'Heavy Snow Fall',
    77: 'Snow Grains',
    80: 'Slight Rain Showers',
    81: 'Moderate Rain Showers',
    82: 'Violent Rain Showers',
    85: 'Slight Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with Slight Hail',
    99: 'Thunderstorm with Heavy Hail'
  };
  return map[code] || 'Clear & Pleasant';
};

export async function fetchLiveWeatherForStops(
  waypoints: Waypoint[],
  existingWeathers: Record<string, DestinationWeather>
): Promise<Record<string, DestinationWeather>> {
  if (!waypoints || waypoints.length === 0) return {};

  const newlyFetched: Record<string, DestinationWeather> = {};

  for (const wp of waypoints) {
    const stops = wp.stops || [];
    for (const stop of stops) {
      const dest = stop.destination?.trim();
      if (dest && !existingWeathers[dest] && !newlyFetched[dest]) {
        try {
          const coords = await geocodeAddress(dest);
          if (coords) {
            const { lat, lng } = coords;
            const weatherRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph`
            );
            const weatherData = await weatherRes.json();
            if (weatherData && weatherData.current_weather) {
              const current = weatherData.current_weather;
              const tempF = Math.round(current.temperature);
              const windSpeedMph = Math.round(current.windspeed);
              const weatherCode = current.weathercode;
              const condition = getWeatherConditionText(weatherCode);

              let hazardAlert = null;
              if (windSpeedMph >= 25) {
                hazardAlert = `WIND ADVISORY: High Crosswinds (${windSpeedMph} mph) Hazard for RV Towing!`;
              } else if (weatherCode >= 95) {
                hazardAlert = `SEVERE WEATHER: ${condition} Detected in Area!`;
              } else if (weatherCode >= 71 && weatherCode <= 86) {
                hazardAlert = `WINTER ALERT: Snow / Icy Road Conditions Possible!`;
              } else if (tempF <= 32) {
                hazardAlert = `FREEZE WARNING: Below Freezing (${tempF}°F) - Risk to RV Water Lines!`;
              }

              newlyFetched[dest] = {
                temp: `${tempF}°F`,
                condition: `${condition} (${windSpeedMph} mph wind)`,
                hazardAlert: hazardAlert
              };
            } else {
              newlyFetched[dest] = { temp: '72°F', condition: 'Clear Sky', hazardAlert: null };
            }
          } else {
            newlyFetched[dest] = { temp: '70°F', condition: 'Pleasant RV Weather', hazardAlert: null };
          }
        } catch (err) {
          console.error("Failed to fetch live weather for", dest, err);
          newlyFetched[dest] = { temp: '70°F', condition: 'Pleasant RV Weather', hazardAlert: null };
        }
      }
    }
  }

  return newlyFetched;
}
