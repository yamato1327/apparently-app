import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Settings, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useWeather, getWeatherIcon, getUVLabel } from "@/hooks/useWeather";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

interface DashboardHeaderProps {
  currentDate: Date;
  onAddEvent: () => void;
}

const DashboardHeader = ({ currentDate, onAddEvent }: DashboardHeaderProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileCity, setProfileCity] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<string | null>(null);
  const { weather } = useWeather({ city: profileCity, state: profileState });

  useEffect(() => {
    if (!user) return;
    const fetchLocation = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("city, state")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfileCity(data.city ?? null);
        setProfileState(data.state ?? null);
      }
    };
    fetchLocation();
  }, [user]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const greetingEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "☀️";
    if (hour < 17) return "🌤️";
    return "🌙";
  };

  return (
    <header className="pb-6">
      {/* Editorial hero — aurora gradient on dark canvas */}
      <div className="relative rounded-3xl overflow-hidden mb-4 ring-1 ring-white/10 shadow-elevated isolate">
        {/* Base canvas (works light + dark) */}
        <div className="absolute inset-0 bg-[hsl(180_35%_8%)]" />
        {/* Aurora gradient layer */}
        <div className="absolute inset-0 gradient-aurora opacity-90" />
        {/* Animated glow blobs */}
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl opacity-40 animate-float"
             style={{ background: "hsl(12 85% 62%)" }} />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full blur-3xl opacity-30 animate-float"
             style={{ background: "hsl(38 95% 58%)", animationDelay: "1.5s" }} />
        {/* Noise overlay */}
        <div className="noise" />

        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 px-2.5 py-1 text-[10px] font-semibold text-white/90 uppercase tracking-[0.18em]">
                  <Sparkles className="h-3 w-3" />
                  Family OS
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[0.95] tracking-tight text-white">
                Apparently<span className="text-white/50">.</span>
              </h1>
              <p className="mt-3 text-white/70 text-sm flex items-center gap-2 font-medium">
                <span className="text-base">{greetingEmoji()}</span>
                <span className="italic font-display text-white/85 text-base">{greeting()}</span>
                <span className="text-white/40">·</span>
                <span>{format(currentDate, "EEEE, MMMM d")}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />
              <button
                onClick={() => navigate("/settings")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 text-white/85 transition-all hover:bg-white/20 hover:text-white active:scale-95"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Action row — primary CTAs */}
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={onAddEvent}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[hsl(230_35%_9%)] shadow-lg shadow-black/20 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Add event
            </button>
          </div>
        </div>
      </div>

      {/* Weather strip — refined glass */}
      {weather && (
        <div className="flex items-center gap-3 rounded-2xl glass px-4 py-3 shadow-soft overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">{weather.locationLabel}</span>
          </div>

          <div className="h-8 w-px bg-border shrink-0" />

          {weather.forecast.slice(0, 5).map((day, idx) => {
            const dateObj = parseISO(day.date);
            const label = idx === 0 ? "Today" : idx === 1 ? "Tomorrow" : format(dateObj, "EEE");
            return (
              <div key={day.date} className="flex items-center gap-2 shrink-0">
                <span className="text-2xl">{getWeatherIcon(day.weatherCode)}</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground whitespace-nowrap font-mono">
                    {day.tempMin}°–{day.tempMax}°
                  </p>
                </div>
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${getUVLabel(day.uvMax).color} bg-muted`}>
                  UV {day.uvMax}
                </span>
                {idx < 4 && <div className="h-8 w-px bg-border ml-1" />}
              </div>
            );
          })}

          <div className="ml-auto flex items-baseline gap-1.5 shrink-0 pl-2">
            <span className="text-2xl font-display font-semibold text-foreground tracking-tight">{weather.currentTemp}°</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">now</span>
          </div>
        </div>
      )}
    </header>
  );
};

export default DashboardHeader;
