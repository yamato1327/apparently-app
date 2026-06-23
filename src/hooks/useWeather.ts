import { useState, useEffect } from "react";

interface DayWeather {
  date: string;
  tempMax: number;
  tempMin: number;
  uvMax: number;
  weatherCode: number;
}

export interface WeatherData {
  currentTemp: number;
  currentCode: number;
  today: DayWeather;
  tomorrow: DayWeather;
  forecast: DayWeather[];
  locationLabel: string;
  timezone: string;
}

const WMO_ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  56: "🌨️", 57: "🌨️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  66: "🌨️", 67: "🌨️",
  71: "❄️", 73: "❄️", 75: "❄️", 77: "❄️",
  80: "🌦️", 81: "🌧️", 82: "🌧️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

export const getWeatherIcon = (code: number): string => {
  return WMO_ICONS[code] || "🌡️";
};

export const getUVLabel = (uv: number): { label: string; color: string } => {
  if (uv <= 2) return { label: "Low", color: "text-green-600" };
  if (uv <= 5) return { label: "Moderate", color: "text-yellow-600" };
  if (uv <= 7) return { label: "High", color: "text-orange-500" };
  if (uv <= 10) return { label: "Very High", color: "text-red-500" };
  return { label: "Extreme", color: "text-purple-600" };
};

const STATE_FALLBACK: Record<string, { lat: number; lon: number; tz: string; label: string }> = {
  WA: { lat: -31.95, lon: 115.86, tz: "Australia/Perth", label: "Perth, WA" },
  NSW: { lat: -33.87, lon: 151.21, tz: "Australia/Sydney", label: "Sydney, NSW" },
  VIC: { lat: -37.81, lon: 144.96, tz: "Australia/Melbourne", label: "Melbourne, VIC" },
  QLD: { lat: -27.47, lon: 153.03, tz: "Australia/Brisbane", label: "Brisbane, QLD" },
  SA: { lat: -34.93, lon: 138.6, tz: "Australia/Adelaide", label: "Adelaide, SA" },
  TAS: { lat: -42.88, lon: 147.33, tz: "Australia/Hobart", label: "Hobart, TAS" },
  NT: { lat: -12.46, lon: 130.84, tz: "Australia/Darwin", label: "Darwin, NT" },
  ACT: { lat: -35.28, lon: 149.13, tz: "Australia/Sydney", label: "Canberra, ACT" },
};

interface GeoResult {
  lat: number;
  lon: number;
  tz: string;
  label: string;
}

const geocode = async (city?: string | null, state?: string | null): Promise<GeoResult> => {
  const fallback = (state && STATE_FALLBACK[state]) || STATE_FALLBACK.WA;

  // If city looks like an Australian postcode (4 digits), search by it
  const query = city?.trim();
  if (!query) return fallback;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&country=AU&count=5&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const data = await res.json();
    const results: any[] = data?.results || [];
    if (results.length === 0) return fallback;

    // Prefer match in same state if provided
    const match =
      (state && results.find((r) => r.admin1_code === state || r.admin1?.toLowerCase().includes(state.toLowerCase()))) ||
      results[0];

    return {
      lat: match.latitude,
      lon: match.longitude,
      tz: match.timezone || fallback.tz,
      label: `${match.name}${match.admin1_code ? ", " + match.admin1_code : ""}`,
    };
  } catch {
    return fallback;
  }
};

interface UseWeatherOptions {
  city?: string | null;
  state?: string | null;
}

export const useWeather = ({ city, state }: UseWeatherOptions = {}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchWeather = async () => {
      setLoading(true);
      try {
        const geo = await geocode(city, state);
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&daily=temperature_2m_max,temperature_2m_min,uv_index_max,weather_code&current=temperature_2m,weather_code&timezone=${encodeURIComponent(geo.tz)}&forecast_days=5`
        );
        if (!res.ok) throw new Error("Weather fetch failed");
        const data = await res.json();

        const days: DayWeather[] = (data.daily.time as string[]).map((t, i) => ({
          date: t,
          tempMax: Math.round(data.daily.temperature_2m_max[i]),
          tempMin: Math.round(data.daily.temperature_2m_min[i]),
          uvMax: Math.round(data.daily.uv_index_max[i] * 10) / 10,
          weatherCode: data.daily.weather_code[i],
        }));

        if (cancelled) return;
        setWeather({
          currentTemp: Math.round(data.current.temperature_2m),
          currentCode: data.current.weather_code,
          today: days[0],
          tomorrow: days[1],
          forecast: days,
          locationLabel: geo.label,
          timezone: geo.tz,
        });
      } catch (err) {
        console.error("Weather error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, [city, state]);

  return { weather, loading };
};
