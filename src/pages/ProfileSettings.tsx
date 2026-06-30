import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChildren, Child } from "@/hooks/useChildren";
import { toast } from "sonner";
import { ArrowLeft, User, Save, LogOut, Loader2, Pencil, Trash2, Plus, Check, X, Mail, Sun, Moon, Send, Sparkles, Trophy, RefreshCw } from "lucide-react";
import { useEmailPreferences } from "@/hooks/useEmailPreferences";
import GmailScanResults from "@/components/GmailScanResults";

const EMOJI_OPTIONS = ["👦", "👧", "👶", "🧒", "👱", "🧒🏽", "👦🏻", "👧🏽", "👶🏻", "🦸", "🧑‍🎓", "🎒"];
const PARENT_AVATAR_OPTIONS = [
  "👩", "👨", "🧑", "👩🏻", "👨🏻", "👩🏽", "👨🏽", "👩🏿", "👨🏿",
  "👱‍♀️", "👱‍♂️", "🧕", "👩‍🦰", "👨‍🦰", "👩‍🦱", "👨‍🦱",
  "🦸‍♀️", "🦸‍♂️", "🧙‍♀️", "🧙‍♂️", "🐻", "🦊", "🐱", "🐶",
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("👤");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { children, loading: childrenLoading, updateChild, removeChild, addChild } = useChildren();
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Child>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildEmoji, setNewChildEmoji] = useState("👦");

  const { prefs, loading: prefsLoading, update: updatePrefs, sendTest } = useEmailPreferences();
  const [testingMorning, setTestingMorning] = useState(false);
  const [testingNight, setTestingNight] = useState(false);
  const [ccDraft, setCcDraft] = useState("");
  const [ccError, setCcError] = useState<string | null>(null);

  const [backfillEmojiBusy, setBackfillEmojiBusy] = useState(false);
  const [backfillMilestoneBusy, setBackfillMilestoneBusy] = useState(false);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLastScanned, setGmailLastScanned] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [showGmailResults, setShowGmailResults] = useState(false);

  const runBackfill = async (mode: "emojis" | "rescore" | "milestones") => {
    const setBusy = mode === "emojis" ? setBackfillEmojiBusy : setBackfillMilestoneBusy;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("backfill-event-emojis", {
        body: { mode },
      });
      if (error) throw error;
      if (mode === "emojis" || mode === "rescore") {
        const ev = data?.eventsUpdated ?? 0;
        const rem = data?.remindersUpdated ?? 0;
        toast.success(
          ev + rem === 0
            ? "Everything already has an emoji ✨"
            : `Updated ${ev} event${ev === 1 ? "" : "s"}${rem ? ` and ${rem} reminder${rem === 1 ? "" : "s"}` : ""} ✨`,
        );
      } else {
        const flagged = data?.milestonesFlagged ?? 0;
        toast.success(
          flagged === 0
            ? "No new milestones detected"
            : `Tagged ${flagged} milestone${flagged === 1 ? "" : "s"} 🏆`,
        );
      }
    } catch (e) {
      console.error("backfill error", e);
      toast.error(e instanceof Error ? e.message : "Couldn't run catch-up");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setCcDraft(prefs.cc_email ?? "");
  }, [prefs.cc_email]);

  const saveCcEmail = async () => {
    const trimmed = ccDraft.trim().toLowerCase();
    if (trimmed === "") {
      setCcError(null);
      await updatePrefs({ cc_email: null });
      toast.success("CC email removed");
      return;
    }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!valid) {
      setCcError("Please enter a valid email address");
      return;
    }
    setCcError(null);
    await updatePrefs({ cc_email: trimmed });
    toast.success("CC email saved");
  };

  const removeCcEmail = async () => {
    setCcDraft("");
    setCcError(null);
    await updatePrefs({ cc_email: null });
    toast.success("CC email removed");
  };

  const handleTest = async (kind: "morning" | "night") => {
    if (kind === "morning") setTestingMorning(true); else setTestingNight(true);
    const res = await sendTest(kind);
    if (res.ok) {
      toast.success(`✉️ Test ${kind} email queued — check your inbox in a moment`);
    } else {
      toast.error(res.error || "Failed to send test");
    }
    if (kind === "morning") setTestingMorning(false); else setTestingNight(false);
  };

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name || "");
        setAvatar(data.avatar_url || "👤");
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchIntegration = async () => {
      const { data } = await supabase
        .from("user_integrations")
        .select("gmail_connected, google_email, gmail_last_scanned_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setGmailConnected(data.gmail_connected);
        setGmailEmail(data.google_email);
        setGmailLastScanned(data.gmail_last_scanned_at);
      }
      setGmailLoading(false);
    };
    fetchIntegration();
  }, [user]);

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/settings`,
          scopes: "https://www.googleapis.com/auth/gmail.readonly",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Failed to connect Gmail");
      setConnectingGmail(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null, avatar_url: avatar || null })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (child: Child) => {
    setEditingChildId(child.id);
    setEditForm({ name: child.name, emoji: child.emoji, birth_month: child.birth_month, birth_year: child.birth_year, school_name: child.school_name });
    setShowEmojiPicker(false);
  };

  const saveChild = async () => {
    if (!editingChildId || !editForm.name?.trim()) return;
    const success = await updateChild(editingChildId, {
      name: editForm.name.trim(),
      emoji: editForm.emoji || "👦",
      birth_month: editForm.birth_month || null,
      birth_year: editForm.birth_year || null,
      school_name: editForm.school_name?.trim() || null,
    });
    if (success) {
      toast.success("Child updated!");
      setEditingChildId(null);
    }
  };

  const handleAddChild = async () => {
    if (!newChildName.trim()) return;
    await addChild(newChildName.trim(), newChildEmoji);
    setNewChildName("");
    setNewChildEmoji("👦");
    setAddingChild(false);
    toast.success("Child added!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || childrenLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold font-display text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Profile form */}
        <div className="rounded-xl border bg-card p-6 shadow-card mb-6">
          <h2 className="text-sm font-bold font-display text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Avatar</label>
              <div className="flex items-center gap-3">
                <div className="text-3xl rounded-lg border bg-background p-2 leading-none">
                  {avatar || "👤"}
                </div>
                <div className="flex flex-wrap gap-1 flex-1">
                  {PARENT_AVATAR_OPTIONS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setAvatar(em)}
                      className={`text-lg rounded-md p-1 hover:bg-muted transition-colors ${
                        avatar === em ? "bg-primary/10 ring-1 ring-primary" : ""
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </form>
        </div>

        {/* Children management */}
        <div className="rounded-xl border bg-card p-6 shadow-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
              👨‍👩‍👧‍👦 Children
            </h2>
            {!addingChild && (
              <button
                onClick={() => setAddingChild(true)}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-semibold hover:bg-primary/20 transition-all"
              >
                <Plus className="h-3 w-3" /> Add child
              </button>
            )}
          </div>

          <div className="space-y-3">
            {children.map((child) => (
              <div key={child.id}>
                {editingChildId === child.id ? (
                  /* Edit mode */
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    {/* Emoji picker */}
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Avatar</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="text-2xl rounded-lg border bg-background p-2 hover:bg-muted/50 transition-colors"
                        >
                          {editForm.emoji || "👦"}
                        </button>
                        {showEmojiPicker && (
                          <div className="flex flex-wrap gap-1">
                            {EMOJI_OPTIONS.map((em) => (
                              <button
                                key={em}
                                onClick={() => { setEditForm({ ...editForm, emoji: em }); setShowEmojiPicker(false); }}
                                className={`text-lg rounded-md p-1 hover:bg-muted transition-colors ${editForm.emoji === em ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Name</label>
                      <input
                        type="text"
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Birth month/year */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Birth Month</label>
                        <select
                          value={editForm.birth_month ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, birth_month: e.target.value ? Number(e.target.value) : null })}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">—</option>
                          {MONTHS.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Birth Year</label>
                        <input
                          type="number"
                          min={2005}
                          max={2026}
                          value={editForm.birth_year ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, birth_year: e.target.value ? Number(e.target.value) : null })}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="e.g. 2018"
                        />
                      </div>
                    </div>

                    {/* School */}
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">School</label>
                      <input
                        type="text"
                        value={editForm.school_name ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, school_name: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="School name"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={saveChild}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all"
                      >
                        <Check className="h-3 w-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditingChildId(null)}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center justify-between rounded-lg border bg-muted/10 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{child.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{child.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {[
                            child.birth_month && child.birth_year
                              ? `Born ${MONTHS[child.birth_month - 1]} ${child.birth_year}`
                              : null,
                            child.school_name,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No details yet"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditing(child)}
                        className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${child.name}?`)) removeChild(child.id);
                        }}
                        className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add child inline */}
            {addingChild && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {EMOJI_OPTIONS.slice(0, 6).map((em) => (
                      <button
                        key={em}
                        onClick={() => setNewChildEmoji(em)}
                        className={`text-lg rounded-md p-1 hover:bg-muted transition-colors ${newChildEmoji === em ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Child's name"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddChild}
                    disabled={!newChildName.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                  <button
                    onClick={() => setAddingChild(false)}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {children.length === 0 && !addingChild && (
              <p className="text-xs text-muted-foreground italic text-center py-2">No children added yet</p>
            )}
          </div>
        </div>

        {/* Email preferences */}
        <div className="rounded-xl border bg-card p-6 shadow-card mb-6">
          <h2 className="text-sm font-bold font-display text-foreground mb-1 flex items-center gap-2">
            <Mail className="h-4 w-4" /> Daily insight emails
          </h2>
          <p className="text-[11px] text-muted-foreground mb-4">
            AI briefings delivered at the times that matter — what to pack, what to ask, what's next.
          </p>

          {prefsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading preferences…
            </div>
          ) : (
            <div className="space-y-4">
              {/* Morning */}
              <div className="rounded-lg border bg-gradient-to-br from-amber-50/60 to-transparent p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-100/70 p-2 text-amber-600">
                      <Sun className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Morning briefing</p>
                      <p className="text-[11px] text-muted-foreground">Day-ahead plan, must-takes, breakfast questions</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePrefs({ morning_enabled: !prefs.morning_enabled })}
                    className={`relative h-6 w-11 rounded-full transition-colors ${prefs.morning_enabled ? "bg-primary" : "bg-muted"}`}
                    aria-label="Toggle morning email"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${prefs.morning_enabled ? "left-[22px]" : "left-0.5"}`}
                    />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="time"
                    value={prefs.morning_time}
                    onChange={(e) => updatePrefs({ morning_time: e.target.value })}
                    disabled={!prefs.morning_enabled}
                    className="rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleTest("morning")}
                    disabled={testingMorning}
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-semibold hover:bg-primary/20 transition disabled:opacity-50"
                  >
                    {testingMorning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send test
                  </button>
                </div>
              </div>

              {/* Night */}
              <div className="rounded-lg border bg-gradient-to-br from-indigo-50/60 to-transparent p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-indigo-100/70 p-2 text-indigo-600">
                      <Moon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Evening reflection</p>
                      <p className="text-[11px] text-muted-foreground">Today recap, tomorrow prep, pack-tonight checklist</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePrefs({ night_enabled: !prefs.night_enabled })}
                    className={`relative h-6 w-11 rounded-full transition-colors ${prefs.night_enabled ? "bg-primary" : "bg-muted"}`}
                    aria-label="Toggle evening email"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${prefs.night_enabled ? "left-[22px]" : "left-0.5"}`}
                    />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="time"
                    value={prefs.night_time}
                    onChange={(e) => updatePrefs({ night_time: e.target.value })}
                    disabled={!prefs.night_enabled}
                    className="rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleTest("night")}
                    disabled={testingNight}
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-semibold hover:bg-primary/20 transition disabled:opacity-50"
                  >
                    {testingNight ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send test
                  </button>
                </div>
              </div>

              {/* CC email */}
              <div className="rounded-lg border bg-gradient-to-br from-emerald-50/60 to-transparent p-4">
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Also send to <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  They'll receive the same morning and night insights as you.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={ccDraft}
                    onChange={(e) => { setCcDraft(e.target.value); setCcError(null); }}
                    onBlur={saveCcEmail}
                    placeholder="partner@example.com"
                    className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {prefs.cc_email && (
                    <button
                      onClick={removeCcEmail}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted/70 transition"
                      aria-label="Remove CC email"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  )}
                </div>
                {ccError && (
                  <p className="mt-1.5 text-[11px] text-destructive">{ccError}</p>
                )}
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">Timezone</label>
                <select
                  value={prefs.timezone}
                  onChange={(e) => updatePrefs({ timezone: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {[
                    "Australia/Perth",
                    "Australia/Sydney",
                    "Australia/Melbourne",
                    "Australia/Brisbane",
                    "Australia/Adelaide",
                    "Australia/Darwin",
                    "Australia/Hobart",
                    "Pacific/Auckland",
                    "Asia/Singapore",
                    "Asia/Tokyo",
                    "Europe/London",
                    "Europe/Paris",
                    "America/New_York",
                    "America/Los_Angeles",
                    "UTC",
                  ].map((tz) => (
                    <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Connected Accounts */}
        <div className="rounded-xl border bg-card p-6 shadow-card mb-6">
          <h2 className="text-sm font-bold font-display text-foreground mb-1 flex items-center gap-2">
            <Mail className="h-4 w-4" /> Connected Accounts
          </h2>
          <p className="text-[11px] text-muted-foreground mb-4">
            Connect Gmail to automatically find family events in your inbox — school notices, excursion forms, appointment confirmations.
          </p>

          {gmailLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking connection…
            </div>
          ) : gmailConnected ? (
            <div className="rounded-lg border bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Gmail connected</p>
                    <p className="text-[11px] text-muted-foreground">{gmailEmail}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGmailResults(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:opacity-90 transition-opacity"
                >
                  <RefreshCw className="h-3 w-3" /> Scan inbox now
                </button>
              </div>
              {gmailLastScanned && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Last scanned {new Date(gmailLastScanned).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnectGmail}
              disabled={connectingGmail}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-border rounded-xl hover:bg-background/50 transition-colors disabled:opacity-50"
            >
              {connectingGmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
                </svg>
              )}
              <span className="text-sm font-medium text-foreground">Connect Gmail</span>
            </button>
          )}
        </div>

        {/* Catch up existing events */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-sm font-bold font-display text-foreground mb-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Catch up existing events
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Apply the latest event smarts to everything you've already added. Safe to re-run — only affects rows that need it.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => runBackfill("rescore")}
              disabled={backfillEmojiBusy}
              className="w-full flex items-center justify-between rounded-lg border bg-background px-4 py-3 text-left hover:bg-accent/30 transition-colors disabled:opacity-60"
            >
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Re-score emojis on every event
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Re-evaluates ALL events (even ones with a wrong emoji). AFL → 🏉, BJJ → 🥋, Swedish School → 🇸🇪, etc.
                </p>
              </div>
              {backfillEmojiBusy ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              ) : (
                <span className="text-xs font-semibold text-primary shrink-0">Run</span>
              )}
            </button>

            <button
              onClick={() => runBackfill("milestones")}
              disabled={backfillMilestoneBusy}
              className="w-full flex items-center justify-between rounded-lg border bg-background px-4 py-3 text-left hover:bg-accent/30 transition-colors disabled:opacity-60"
            >
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" /> Detect milestones in existing events
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Finds performances, exams, big games, photo days etc. You can untoggle any in the edit dialog.
                </p>
              </div>
              {backfillMilestoneBusy ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
              ) : (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">Run</span>
              )}
            </button>
          </div>
        </div>

        {/* Account section */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-sm font-bold font-display text-foreground mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <hr className="border-border" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-destructive/30 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>

      <GmailScanResults open={showGmailResults} onClose={() => setShowGmailResults(false)} />
    </div>
  );
};

export default ProfileSettings;
