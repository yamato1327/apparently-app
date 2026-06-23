import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, X, ArrowRight, Loader2, Baby, MapPin } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

interface ChildEntry {
  name: string;
  emoji: string;
  birthMonth: string;
  birthYear: string;
  schoolName: string;
}

const KID_EMOJIS = [
  "👦", "👧", "👶", "🧒", "👸", "🤴", "🦸", "🧑‍🎓",
  "⚽", "🎨", "🎵", "🦄", "🐶", "🐱", "🌟", "🦋",
  "🎀", "🤖", "🧸", "🎮", "📚", "🏄", "🎭", "🌈",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => currentYear - i);

const AU_STATES = [
  { value: "NSW", label: "🏖️ New South Wales" },
  { value: "VIC", label: "🏙️ Victoria" },
  { value: "QLD", label: "☀️ Queensland" },
  { value: "SA", label: "🍷 South Australia" },
  { value: "WA", label: "🌊 Western Australia" },
  { value: "TAS", label: "🌲 Tasmania" },
  { value: "NT", label: "🐊 Northern Territory" },
  { value: "ACT", label: "🏛️ ACT" },
];

const emptyChild = (): ChildEntry => ({ name: "", emoji: "👦", birthMonth: "", birthYear: "", schoolName: "" });

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || "");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [children, setChildren] = useState<ChildEntry[]>([emptyChild()]);
  const [saving, setSaving] = useState(false);

  const addChildField = () => setChildren((prev) => [...prev, emptyChild()]);

  const updateChild = (index: number, field: keyof ChildEntry, value: string) => {
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const removeChild = (index: number) => {
    if (children.length <= 1) return;
    setChildren((prev) => prev.filter((_, i) => i !== index));
  };

  const importHolidays = async () => {
    if (!user || !state) return;

    try {
      toast.info("🔍 Looking up school terms & public holidays...");

      const { data, error } = await supabase.functions.invoke("lookup-holidays", {
        body: { state, year: currentYear },
      });

      if (error) {
        console.error("Holiday lookup error:", error);
        return;
      }

      const events = data?.events;
      if (!events || events.length === 0) return;

      const rows = events.map((e: any) => ({
        user_id: user.id,
        title: e.title,
        description: e.description || null,
        date: e.date,
        category: e.category || "general",
        child_name: "Family",
        is_completed: false,
      }));

      const { error: insertError } = await supabase.from("events").insert(rows);

      if (insertError) {
        console.error("Holiday insert error:", insertError);
      } else {
        toast.success(`📅 Added ${events.length} holidays & term dates!`);
      }
    } catch (err) {
      console.error("Holiday import failed:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validChildren = children.filter((c) => c.name.trim().length > 0);

    if (validChildren.length === 0) {
      toast.error("Please add at least one child 👶");
      return;
    }

    if (!state) {
      toast.error("Please select your state 📍");
      return;
    }

    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || user.email,
          city: city.trim() || null,
          state,
          onboarding_completed: true,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      const { error: childrenError } = await supabase.from("children").insert(
        validChildren.map((c) => ({
          user_id: user.id,
          name: c.name.trim(),
          emoji: c.emoji,
          birth_month: c.birthMonth ? parseInt(c.birthMonth) : null,
          birth_year: c.birthYear ? parseInt(c.birthYear) : null,
          school_name: c.schoolName.trim() || null,
        } as any))
      );

      if (childrenError) throw childrenError;

      // Import holidays in the background
      await importHolidays();

      toast.success("You're all set! 🎉");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold font-display text-foreground">🏠 Apparently</h1>
          <p className="text-sm text-muted-foreground mt-2">Let's set up your family profile 👨‍👩‍👧‍👦</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-5">
            <Baby className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold font-display text-foreground">About your family</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Display name */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Your name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Your name"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                <MapPin className="inline h-3.5 w-3.5 mr-1" />
                📍 Where are you based?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">State *</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-lg border bg-background px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select state</option>
                    {AU_STATES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">City / Town</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. Sydney"
                  />
                </div>
              </div>
              {state && (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  ✨ We'll auto-add {AU_STATES.find((s) => s.value === state)?.label.slice(2)} school terms & public holidays
                </p>
              )}
            </div>

            {/* Children */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">👶 Your children</label>
              <div className="space-y-4">
                {children.map((child, index) => (
                  <div key={index} className="rounded-lg border bg-background/50 p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const currentIdx = KID_EMOJIS.indexOf(child.emoji);
                          const nextIdx = (currentIdx + 1) % KID_EMOJIS.length;
                          updateChild(index, "emoji", KID_EMOJIS[nextIdx]);
                        }}
                        className="text-2xl hover:scale-110 transition-transform shrink-0"
                        title="Tap to change emoji"
                      >
                        {child.emoji}
                      </button>
                      <input
                        type="text"
                        value={child.name}
                        onChange={(e) => updateChild(index, "name", e.target.value)}
                        className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder={`Child ${index + 1}'s name`}
                        autoFocus={index === 0}
                      />
                      {children.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeChild(index)}
                          className="rounded-md p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Emoji picker grid */}
                    <div className="flex flex-wrap gap-1">
                      {KID_EMOJIS.map((e) => (
                        <button
                          type="button"
                          key={e}
                          onClick={() => updateChild(index, "emoji", e)}
                          className={`w-7 h-7 rounded-md text-sm flex items-center justify-center transition-all ${
                            child.emoji === e
                              ? "bg-primary/20 ring-2 ring-primary scale-110"
                              : "hover:bg-muted"
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">🎂 Birth month</label>
                        <select
                          value={child.birthMonth}
                          onChange={(e) => updateChild(index, "birthMonth", e.target.value)}
                          className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">Month</option>
                          {MONTHS.map((m, i) => (
                            <option key={m} value={String(i + 1)}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">📅 Birth year</label>
                        <select
                          value={child.birthYear}
                          onChange={(e) => updateChild(index, "birthYear", e.target.value)}
                          className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">Year</option>
                          {YEARS.map((y) => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">🏫 School name</label>
                      <input
                        type="text"
                        value={child.schoolName}
                        onChange={(e) => updateChild(index, "schoolName", e.target.value)}
                        className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="e.g. Greenwood Primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addChildField}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add another child
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {saving ? "Setting up..." : "Get Started 🚀"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
