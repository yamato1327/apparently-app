import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import DailyView from "@/components/DailyView";
import WeeklyView from "@/components/WeeklyView";
import MonthlyView from "@/components/MonthlyView";
import InsightsPanel from "@/components/InsightsPanel";
import AddEventDialog from "@/components/AddEventDialog";
import EditEventDialog from "@/components/EditEventDialog";
import ChildDevelopment from "@/components/ChildDevelopment";
import IntegrationsStrip from "@/components/IntegrationsStrip";
import RemindersStrip from "@/components/RemindersStrip";
import ReadingTogether from "@/components/ReadingTogether";
import DigitalLibrary from "@/components/DigitalLibrary";
import NowNextStrip from "@/components/NowNextStrip";
import MainTabs, { type MainTab } from "@/components/MainTabs";
import { useEvents } from "@/hooks/useEvents";
import { useChildren } from "@/hooks/useChildren";
import { useReadingBooks } from "@/hooks/useReadingBooks";
import { supabase } from "@/integrations/supabase/client";
import { FamEvent } from "@/types/events";
import { Loader2 } from "lucide-react";

type ViewMode = "daily" | "weekly" | "nextweek" | "monthly";

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "nextweek", label: "Next Week" },
  { key: "monthly", label: "Month" },
];

const VALID_TABS: MainTab[] = ["plan", "reading", "development"];

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: MainTab = (VALID_TABS.includes(tabParam as MainTab) ? tabParam : "plan") as MainTab;

  const [activeTab, setActiveTab] = useState<MainTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FamEvent | null>(null);
  const { events, loading, addEvent, addMultipleEvents, toggleComplete, deleteEvent, deleteOccurrence, updateEvent, bulkUpdateEmojis } = useEvents();
  const { children: familyChildren } = useChildren();
  const { books: readingBooks } = useReadingBooks();
  const today = new Date();
  const autoBackfillFired = useRef(false);

  // Sync tab → URL.
  const handleTabChange = (t: MainTab) => {
    setActiveTab(t);
    const next = new URLSearchParams(searchParams);
    if (t === "plan") next.delete("tab");
    else next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  // Live tab badges.
  const badges = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const planCount = events.filter((e) => e.date === todayStr && !e.isCompleted).length;
    const readingCount = readingBooks.filter((b) => !b.is_read).length;
    return {
      plan: planCount,
      reading: readingCount,
      development: 0, // wired later when meeting lead-window logic is centralised
    };
  }, [events, readingBooks]);

  // Auto-run the smart-emoji backfill once per user (silent).
  useEffect(() => {
    if (loading || autoBackfillFired.current) return;
    autoBackfillFired.current = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("emoji_backfill_at")
          .eq("user_id", user.id)
          .maybeSingle();
        const alreadyRan = !!(profile as { emoji_backfill_at?: string | null } | null)?.emoji_backfill_at;
        const hasMissing = events.some((e) => !e.emoji);
        if (alreadyRan && !hasMissing) return;
        supabase.functions.invoke("backfill-event-emojis", { body: { mode: "emojis" } }).catch(() => {});
      } catch {
        /* silent */
      }
    })();
  }, [loading, events]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-animated flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full gradient-aurora opacity-30 blur-2xl animate-pulse-glow" />
          <Loader2 className="h-10 w-10 text-primary animate-spin relative z-10" />
        </div>
        <p className="text-sm text-muted-foreground font-display italic">loading your day…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh-animated">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Always visible: header + Now/Next strip + tab bar */}
        <DashboardHeader
          currentDate={today}
          onAddEvent={() => setDialogOpen(true)}
        />

        <NowNextStrip events={events} onJumpToPlan={() => handleTabChange("plan")} />

        <IntegrationsStrip />

        <MainTabs active={activeTab} onChange={handleTabChange} badges={badges} />

        {/* Tab content */}
        {activeTab === "plan" && (
          <div role="tabpanel" aria-label="Plan">
            <div className="mb-6">
              <InsightsPanel events={events} children={familyChildren} />
            </div>

            <div className="mb-6">
              <RemindersStrip />
            </div>

            {/* Calendar view toggle */}
            <div className="relative inline-flex items-center gap-1 mb-6 glass rounded-full p-1 shadow-soft">
              {VIEW_TABS.map((tab) => {
                const active = viewMode === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setViewMode(tab.key)}
                    className={`relative rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                      active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-0 rounded-full gradient-primary shadow-glow" aria-hidden />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {viewMode === "daily" ? (
              <DailyView date={today} events={events} onToggle={toggleComplete} onDelete={deleteEvent} onDeleteOccurrence={deleteOccurrence} onEdit={setEditingEvent} />
            ) : viewMode === "monthly" ? (
              <MonthlyView currentDate={today} events={events} onToggle={toggleComplete} onDelete={deleteEvent} onDeleteOccurrence={deleteOccurrence} onEdit={setEditingEvent} />
            ) : (
              <WeeklyView currentDate={today} events={events} onToggle={toggleComplete} onDelete={deleteEvent} onDeleteOccurrence={deleteOccurrence} onEdit={setEditingEvent} weekOffset={viewMode === "nextweek" ? 1 : 0} />
            )}
          </div>
        )}

        {activeTab === "reading" && (
          <div role="tabpanel" aria-label="Reading">
            <section className="rounded-3xl border bg-card shadow-soft overflow-hidden">
              <div className="divide-y">
                <div className="px-2 sm:px-4 py-2">
                  <ReadingTogether />
                </div>
                <div className="px-2 sm:px-4 py-2">
                  <DigitalLibrary />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "development" && (
          <div role="tabpanel" aria-label="Development">
            <ChildDevelopment />
          </div>
        )}
      </div>

      <AddEventDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={addEvent} />
      <EditEventDialog key={editingEvent?.id ?? 'none'} event={editingEvent} onClose={() => setEditingEvent(null)} onSave={updateEvent} />
    </div>
  );
};

export default Index;
