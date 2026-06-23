import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { useChildren, type Child } from "@/hooks/useChildren";
import { useDevelopment, type MeetingPhase, type Owner, type ScoreValue } from "@/hooks/useDevelopment";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SCORE_COLOR: Record<ScoreValue, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  yellow: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
};

const OWNERS: Owner[] = ["Teacher", "Parent", "Child", "All"];

export default function ChildDevelopment() {
  const { user } = useAuth();
  const { children: kids } = useChildren();
  const { scores, meetings, loading, upsertScore, removeScore, upsertMeeting, removeMeeting } = useDevelopment();
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  const child: Child | undefined = useMemo(
    () => kids.find((c) => c.id === activeChildId) ?? kids[0],
    [kids, activeChildId]
  );

  const childScores = useMemo(() => scores.filter((s) => s.child_id === child?.id), [scores, child]);
  const childMeetings = useMemo(() => meetings.filter((m) => m.child_id === child?.id), [meetings, child]);

  if (loading) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading development...
        </CardContent>
      </Card>
    );
  }

  if (kids.length === 0) {
    return (
      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="text-lg">Child Development</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Add a child in your profile to begin tracking development.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>🌱</span> Child Development
          </CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {kids.map((k) => (
              <button
                key={k.id}
                onClick={() => setActiveChildId(k.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                  (child?.id === k.id) ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="mr-1">{k.emoji}</span>{k.name}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {child && (
          <Tabs defaultValue="scores">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl">
              <TabsTrigger value="scores" className="rounded-xl">Scores</TabsTrigger>
              <TabsTrigger value="meetings" className="rounded-xl">Meetings</TabsTrigger>
            </TabsList>

            <TabsContent value="scores" className="mt-4 space-y-3">
              <ScoresPanel
                childId={child.id}
                scores={childScores}
                onSave={upsertScore}
                onDelete={removeScore}
              />
            </TabsContent>

            <TabsContent value="meetings" className="mt-4 space-y-3">
              <MeetingsPanel
                child={child}
                userId={user?.id || ""}
                meetings={childMeetings}
                onSave={upsertMeeting}
                onDelete={removeMeeting}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

/* ----- Scores ----- */
function ScoresPanel({
  childId, scores, onSave, onDelete,
}: {
  childId: string;
  scores: ReturnType<typeof useDevelopment>["scores"];
  onSave: ReturnType<typeof useDevelopment>["upsertScore"];
  onDelete: ReturnType<typeof useDevelopment>["removeScore"];
}) {
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("academic");

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Area (e.g. Reading, Friendships)" value={area} onChange={(e) => setArea(e.target.value)} className="flex-1 min-w-[160px] rounded-xl" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[140px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="academic">Academic</SelectItem>
            <SelectItem value="social">Social</SelectItem>
            <SelectItem value="behaviour">Behaviour</SelectItem>
            <SelectItem value="wellbeing">Wellbeing</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="rounded-xl"
          onClick={async () => {
            if (!area.trim()) return;
            await onSave({ child_id: childId, area: area.trim(), category, score: "green" });
            setArea("");
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add area
        </Button>
      </div>

      {scores.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">No areas tracked yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {scores.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-card/50">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{s.area}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{s.category}{s.term ? ` · ${s.term}` : ""}</div>
              </div>
              <div className="flex items-center gap-1">
                {(["red", "yellow", "green"] as ScoreValue[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => onSave({ id: s.id, child_id: s.child_id, area: s.area, score: v })}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${s.score === v ? SCORE_COLOR[v] : "text-muted-foreground border-border hover:bg-muted"}`}
                  >
                    {v}
                  </button>
                ))}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----- Meetings ----- */
function MeetingsPanel({
  child, userId, meetings, onSave, onDelete,
}: {
  child: Child;
  userId: string;
  meetings: ReturnType<typeof useDevelopment>["meetings"];
  onSave: ReturnType<typeof useDevelopment>["upsertMeeting"];
  onDelete: ReturnType<typeof useDevelopment>["removeMeeting"];
}) {
  const [creating, setCreating] = useState(false);

  const createNew = async () => {
    setCreating(true);
    await onSave({ child_id: child.id, title: "Parent-Teacher Meeting", phase: "pre" });
    setCreating(false);
  };

  return (
    <div className="space-y-3">
      <Button size="sm" className="rounded-xl" onClick={createNew} disabled={creating}>
        {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} New meeting
      </Button>

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">No meetings yet.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} userId={userId} childName={child.name} onSave={onSave} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({
  meeting, userId, childName, onSave, onDelete,
}: {
  meeting: ReturnType<typeof useDevelopment>["meetings"][number];
  userId: string;
  childName: string;
  onSave: ReturnType<typeof useDevelopment>["upsertMeeting"];
  onDelete: ReturnType<typeof useDevelopment>["removeMeeting"];
}) {
  const [phase, setPhase] = useState<MeetingPhase>(meeting.phase);
  const [parentNotes, setParentNotes] = useState(meeting.pre_parent_notes || "");
  const [childNotes, setChildNotes] = useState(meeting.pre_child_notes || "");
  const [overall, setOverall] = useState(meeting.overall_notes || "");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<{ area: string; owner: Owner }[]>([
    { area: meeting.post_focus_1 || "", owner: (meeting.post_owner_1 as Owner) || "Teacher" },
    { area: meeting.post_focus_2 || "", owner: (meeting.post_owner_2 as Owner) || "Parent" },
    { area: meeting.post_focus_3 || "", owner: (meeting.post_owner_3 as Owner) || "Child" },
  ]);

  const save = async (extra: any = {}) => {
    await onSave({
      id: meeting.id,
      child_id: meeting.child_id,
      phase,
      pre_parent_notes: parentNotes || null,
      pre_child_notes: childNotes || null,
      overall_notes: overall || null,
      post_focus_1: focus[0].area || null,
      post_focus_2: focus[1].area || null,
      post_focus_3: focus[2].area || null,
      post_owner_1: focus[0].area ? focus[0].owner : null,
      post_owner_2: focus[1].area ? focus[1].owner : null,
      post_owner_3: focus[2].area ? focus[2].owner : null,
      ...extra,
    });
    toast.success("Saved");
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const path = `${userId}/${meeting.id}-${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("meeting-docs").upload(path, file);
      if (up.error) throw up.error;

      // Read as base64 for AI
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("extract-meeting", {
        body: { images: [base64], childName },
      });
      if (error) throw error;

      setOverall(data.overall_notes || overall);
      setFocus((prev) => prev.map((f, i) => {
        const a = data[`post_focus_${i + 1}`];
        const o = data[`post_owner_${i + 1}`];
        return a ? { area: a, owner: (o as Owner) || f.owner } : f;
      }));

      await onSave({
        id: meeting.id,
        child_id: meeting.child_id,
        file_url: path,
        file_name: file.name,
        ai_extracted: true,
        overall_notes: data.overall_notes || overall,
        improvement_area_1: data.improvement_area_1,
        improvement_area_2: data.improvement_area_2,
        improvement_area_3: data.improvement_area_3,
        post_focus_1: data.post_focus_1,
        post_focus_2: data.post_focus_2,
        post_focus_3: data.post_focus_3,
        post_owner_1: data.post_owner_1,
        post_owner_2: data.post_owner_2,
        post_owner_3: data.post_owner_3,
      });
      toast.success("Extracted from file");
    } catch (e) {
      console.error(e);
      toast.error("Extraction failed");
    } finally {
      setBusy(false);
    }
  };

  const extractText = async () => {
    if (!pasted.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-meeting", {
        body: { text: pasted, childName },
      });
      if (error) throw error;
      setOverall(data.overall_notes || overall);
      setFocus((prev) => prev.map((f, i) => {
        const a = data[`post_focus_${i + 1}`];
        const o = data[`post_owner_${i + 1}`];
        return a ? { area: a, owner: (o as Owner) || f.owner } : f;
      }));
      setPasted("");
      toast.success("Extracted");
    } catch (e) {
      console.error(e);
      toast.error("Extraction failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{phase}</Badge>
          <span className="text-xs text-muted-foreground">{meeting.meeting_date}</span>
        </div>
        <div className="flex items-center gap-1">
          {(["pre", "meeting", "post"] as MeetingPhase[]).map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`px-2 py-0.5 text-[11px] rounded-md border ${phase === p ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`}
            >
              {p}
            </button>
          ))}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(meeting.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {phase === "pre" && (
        <div className="space-y-2">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Parent prep notes</label>
            <Textarea rows={2} value={parentNotes} onChange={(e) => setParentNotes(e.target.value)} className="rounded-xl" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">What {childName} wants to share</label>
            <Textarea rows={2} value={childNotes} onChange={(e) => setChildNotes(e.target.value)} className="rounded-xl" />
          </div>
        </div>
      )}

      {phase === "meeting" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer rounded-xl border px-3 py-2 bg-card hover:bg-muted">
              <Upload className="h-3.5 w-3.5" /> Upload report
              <input type="file" hidden accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          </div>
          <Textarea rows={3} placeholder="Or paste teacher notes here…" value={pasted} onChange={(e) => setPasted(e.target.value)} className="rounded-xl" />
          <Button size="sm" variant="secondary" className="rounded-xl" onClick={extractText} disabled={busy || !pasted.trim()}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />} Extract focus areas
          </Button>
          <Textarea rows={3} placeholder="Overall notes" value={overall} onChange={(e) => setOverall(e.target.value)} className="rounded-xl" />
        </div>
      )}

      {phase === "post" && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Focus areas & owners</p>
          {focus.map((f, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder={`Focus area ${i + 1}`} value={f.area} onChange={(e) => setFocus((p) => p.map((x, j) => j === i ? { ...x, area: e.target.value } : x))} className="rounded-xl" />
              <Select value={f.owner} onValueChange={(v) => setFocus((p) => p.map((x, j) => j === i ? { ...x, owner: v as Owner } : x))}>
                <SelectTrigger className="w-[110px] rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" className="rounded-xl" onClick={() => save()} disabled={busy}>Save</Button>
      </div>
    </div>
  );
}