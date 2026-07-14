import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, Camera, ChevronDown, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { useChildren, type Child } from "@/hooks/useChildren";
import { useReadingBooks, type ReadingBook } from "@/hooks/useReadingBooks";
import { canUseUploadedBookPhoto, findBookCoverByTitle } from "@/lib/readingCovers";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import TonightsReading from "@/components/TonightsReading";

export default function ReadingTogether() {
  const { children: kids } = useChildren();
  const { books, loading, addBook, removeBook, toggleRead, getSignedUrl, updateProgress } = useReadingBooks();
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const child = useMemo(
    () => (activeChildId ? kids.find((c) => c.id === activeChildId) ?? null : null),
    [kids, activeChildId]
  );

  // null = "All children" view
  const uploadChild = child ?? kids[0];

  const childBooks = useMemo(
    () => (child ? books.filter((b) => b.child_id === child.id) : books),
    [books, child]
  );

  // Active (in progress) on top, completed at the bottom (most recently read first).
  const sortedBooks = useMemo(() => {
    const active = childBooks.filter((b) => !b.is_read);
    const done = childBooks
      .filter((b) => b.is_read)
      .sort((a, b) => (b.read_at || b.created_at).localeCompare(a.read_at || a.created_at));
    return [...active, ...done];
  }, [childBooks]);

  const readCount = useMemo(() => childBooks.filter((b) => b.is_read).length, [childBooks]);
  const total = childBooks.length;

  // Cumulative books-read trend over the last 30 days (based on read_at).
  const trend = useMemo(() => {
    const days = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));

    // Count books read on each day in the window
    const perDay = new Map<string, number>();
    let baseline = 0; // books already read before the window starts
    for (const b of childBooks) {
      if (!b.is_read || !b.read_at) continue;
      const d = new Date(b.read_at);
      d.setHours(0, 0, 0, 0);
      if (d < start) {
        baseline += 1;
      } else if (d <= today) {
        const key = d.toISOString().slice(0, 10);
        perDay.set(key, (perDay.get(key) || 0) + 1);
      }
    }

    let running = baseline;
    const out: { date: string; label: string; read: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      running += perDay.get(key) || 0;
      out.push({
        date: key,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        read: running,
      });
    }
    return out;
  }, [childBooks]);

  const trendMax = trend[trend.length - 1]?.read ?? 0;
  const trendStart = trend[0]?.read ?? 0;
  const trendDelta = trendMax - trendStart;

  const COLLAPSED = 5;
  const visibleBooks = showAll ? sortedBooks : sortedBooks.slice(0, COLLAPSED);

  const childById = useMemo(() => {
    const map = new Map<string, Child>();
    kids.forEach((k) => map.set(k.id, k));
    return map;
  }, [kids]);

  if (kids.length === 0) {
    return (
      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5" /> Reading Together</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Add a child in your profile to start tracking books.</CardContent>
      </Card>
    );
  }

  const onPick = async (files: FileList) => {
    if (!uploadChild || files.length === 0) return;
    const list = Array.from(files);
    setUploadProgress({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      await addBook(uploadChild.id, list[i]);
      setUploadProgress({ done: i + 1, total: list.length });
    }
    setUploadProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploading = uploadProgress !== null;

  return (
    <Card className="rounded-2xl shadow-none border-0 bg-transparent">
      <CardHeader className="pb-3 px-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Reading Together
          </CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setActiveChildId(null)}
              aria-pressed={child === null}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                child === null ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              👨‍👩‍👧 All
            </button>
            {kids.map((k) => (
              <button
                key={k.id}
                onClick={() => setActiveChildId(k.id)}
                aria-pressed={child?.id === k.id}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                  child?.id === k.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="mr-1">{k.emoji}</span>{k.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {readCount} of {total} read
          </span>
          {child ? (
            <span>by {child.emoji} {child.name}</span>
          ) : (
            <span>across the whole family</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tonight's reading — moved from the dashboard insights panel */}
        <TonightsReading />

        {/* Cumulative reading progress — last 30 days */}
        {trendMax > 0 && (
          <div className="rounded-2xl border bg-card/40 p-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-xs font-semibold text-foreground">Reading progress</p>
                <p className="text-[10px] text-muted-foreground">Last 30 days · cumulative books finished</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold font-display text-primary leading-none">{trendMax}</p>
                <p className="text-[10px] text-muted-foreground">
                  {trendDelta > 0 ? `+${trendDelta} this month` : "no new books yet"}
                </p>
              </div>
            </div>
            <div className="h-24 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="readingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" hide />
                  <YAxis hide allowDecimals={false} domain={[0, "dataMax"]} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2 }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelFormatter={(l) => String(l)}
                    formatter={(v: number) => [`${v} read`, "Total"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="read"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#readingGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            hidden
            onChange={(e) => e.target.files && e.target.files.length > 0 && onPick(e.target.files)}
          />
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
            {uploading
              ? `Reading book ${uploadProgress!.done + 1} of ${uploadProgress!.total}…`
              : "Add book photos"}
          </Button>
          <p className="text-[11px] text-muted-foreground">Add several at once — tick each off as it's finished.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
        ) : sortedBooks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">
            No books yet{child ? ` for ${child.name}` : ""}. Add the first one above.
          </p>
        ) : (
          <div className="rounded-2xl border bg-card/40 divide-y divide-border/60 overflow-hidden">
            {visibleBooks.map((b) => (
              <BookRow
                key={b.id}
                book={b}
                child={childById.get(b.child_id)}
                getSignedUrl={getSignedUrl}
                onDelete={removeBook}
                onToggleRead={toggleRead}
                onUpdateProgress={updateProgress}
              />
            ))}
          </div>
        )}

        {sortedBooks.length > COLLAPSED && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" className="text-xs rounded-full" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show less" : `Show all ${sortedBooks.length}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BookRow({
  book, child, getSignedUrl, onDelete, onToggleRead, onUpdateProgress,
}: {
  book: ReadingBook;
  child?: Child;
  getSignedUrl: (path: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<void>;
  onToggleRead: (id: string, isRead: boolean) => Promise<void>;
  onUpdateProgress: (bookId: string, progress: string, childName?: string, childAge?: number | null) => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [showPageInput, setShowPageInput] = useState(false);

  const currentProgress = book.progress || "beginning";

  const handleProgressChange = async (newProgress: string) => {
    setUpdatingProgress(true);
    const childAge = child?.birth_year
      ? new Date().getFullYear() - child.birth_year
      : null;
    await onUpdateProgress(book.id, newProgress, child?.name, childAge);
    setUpdatingProgress(false);
    setShowPageInput(false);
  };

  const handlePageSubmit = async () => {
    const page = parseInt(pageInput.trim(), 10);
    if (!isNaN(page) && page > 0) {
      await handleProgressChange(String(page));
      setPageInput("");
    }
  };

  useEffect(() => {
    let cancelled = false;

    const resolveCover = async () => {
      if (!imgFailed) {
        if (book.cover_url) {
          setUrl(book.cover_url);
          return;
        }

        const discoveredCover = await findBookCoverByTitle(book.title);
        if (discoveredCover) {
          if (!cancelled) setUrl(discoveredCover);
          return;
        }
      }

      if (!canUseUploadedBookPhoto(book.photo_path)) {
        if (!cancelled) setUrl(null);
        return;
      }

      const signedUrl = await getSignedUrl(book.photo_path);
      if (!cancelled) setUrl(signedUrl);
    };

    resolveCover();

    return () => {
      cancelled = true;
    };
  }, [book.photo_path, book.cover_url, book.title, imgFailed, getSignedUrl]);

  const questions = [book.question_1, book.question_2, book.question_3].filter(Boolean) as string[];
  const hasQuestions = questions.length > 0;

  return (
    <div className={`transition-colors ${book.is_read ? "bg-primary/5" : ""}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Checkbox
          checked={book.is_read}
          onCheckedChange={(v) => onToggleRead(book.id, !!v)}
          aria-label="Mark book as read"
          className="h-5 w-5"
        />
        <div className="shrink-0 w-10 h-12 rounded-md overflow-hidden bg-muted">
          {url ? (
            <img
              src={url}
              alt={book.title || "Book"}
              className="w-full h-full object-cover"
              onError={() => {
                setUrl(null);
                setImgFailed(true);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => hasQuestions && setOpen((o) => !o)}
          className="flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          <p className={`text-sm font-semibold truncate ${book.is_read ? "line-through text-muted-foreground" : ""}`}>
            {book.title || "Untitled book"}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {child && <span className="font-medium text-foreground/70">{child.emoji} {child.name}</span>}
            <span>· {new Date(book.created_at).toLocaleDateString()}</span>
            {hasQuestions && <span>· {open ? "Hide questions" : "Show questions"}</span>}
          </div>
        </button>
        {hasQuestions && (
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          />
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onDelete(book.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && hasQuestions && (
        <div className="px-3 pb-3 pl-[4.25rem] space-y-3">
          {/* Progress picker */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              How far in?
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["beginning", "middle", "end"] as const).map((p) => (
                <button
                  key={p}
                  disabled={updatingProgress}
                  onClick={() => {
                    setShowPageInput(false);
                    handleProgressChange(p);
                  }}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-full border capitalize transition-all ${
                    currentProgress === p && !showPageInput
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={updatingProgress}
                onClick={() => setShowPageInput((v) => !v)}
                className={`px-3 py-1 text-[11px] font-semibold rounded-full border transition-all ${
                  showPageInput || (!["beginning", "middle", "end"].includes(currentProgress))
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Page #
              </button>
              {updatingProgress && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            {showPageInput && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 42"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePageSubmit()}
                  className="w-24 rounded-lg border border-border bg-background px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={handlePageSubmit}
                  disabled={!pageInput.trim() || updatingProgress}
                  className="px-3 py-1 text-[11px] font-semibold rounded-full bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
                >
                  Update
                </button>
              </div>
            )}

            {!showPageInput && !["beginning", "middle", "end"].includes(currentProgress) && (
              <p className="text-[11px] text-muted-foreground">
                Currently on page {currentProgress}
              </p>
            )}
          </div>

          {/* Questions list */}
          <ol className="space-y-1.5 list-decimal list-inside">
            {questions.map((q, i) => (
              <li key={i} className="text-sm leading-snug text-foreground">{q}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}