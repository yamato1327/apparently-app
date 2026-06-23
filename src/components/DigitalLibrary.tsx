import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Library, BookOpen, Users } from "lucide-react";
import { useChildren, type Child } from "@/hooks/useChildren";
import { useReadingBooks, type ReadingBook } from "@/hooks/useReadingBooks";
import { canUseUploadedBookPhoto, findBookCoverByTitle } from "@/lib/readingCovers";
import { format, parseISO, startOfMonth, isSameMonth } from "date-fns";

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(35 90% 55%)",
  "hsl(150 60% 45%)",
  "hsl(280 60% 60%)",
];

type FilterKey = "all" | string;

export default function DigitalLibrary() {
  const { children: kids } = useChildren();
  const { books, getSignedUrl } = useReadingBooks();
  const [filter, setFilter] = useState<FilterKey>("all");

  const colorForChild = useMemo(() => {
    const map = new Map<string, string>();
    kids.forEach((k, i) => map.set(k.id, PALETTE[i % PALETTE.length]));
    return map;
  }, [kids]);

  const readBooks = useMemo(
    () =>
      books
        .filter((b) => b.is_read)
        .filter((b) => (filter === "all" ? true : b.child_id === filter))
        .sort((a, b) =>
          (b.read_at || b.created_at).localeCompare(a.read_at || a.created_at)
        ),
    [books, filter]
  );

  // Group by month
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; date: Date; books: ReadingBook[] }>();
    readBooks.forEach((b) => {
      const d = parseISO(b.read_at || b.created_at);
      const key = format(startOfMonth(d), "yyyy-MM");
      const label = format(d, "MMMM yyyy");
      const entry = map.get(key) || { label, date: startOfMonth(d), books: [] };
      entry.books.push(b);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [readBooks]);

  if (kids.length === 0) return null;

  const totalForFilter = readBooks.length;
  const thisMonthCount = readBooks.filter((b) =>
    isSameMonth(parseISO(b.read_at || b.created_at), new Date())
  ).length;

  return (
    <Card className="rounded-2xl shadow-none border-0 bg-transparent">
      <CardHeader className="pb-3 px-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" /> Digital Library
          </CardTitle>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span><span className="font-semibold text-foreground">{totalForFilter}</span> total</span>
            <span><span className="font-semibold text-foreground">{thisMonthCount}</span> this month</span>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            color="hsl(var(--primary))"
            icon={<Users className="h-3 w-3" />}
            label="Family"
          />
          {kids.map((k) => (
            <FilterChip
              key={k.id}
              active={filter === k.id}
              onClick={() => setFilter(k.id)}
              color={colorForChild.get(k.id) || "hsl(var(--primary))"}
              icon={<span>{k.emoji}</span>}
              label={k.name}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-8 text-center">
            No books finished yet. Tick books off in Reading Together to fill the shelf.
          </p>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.label} className="relative pl-7">
                  <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    {g.label} · {g.books.length} {g.books.length === 1 ? "book" : "books"}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {g.books.map((b) => (
                      <BookTile
                        key={b.id}
                        book={b}
                        child={kids.find((k) => k.id === b.child_id)}
                        color={colorForChild.get(b.child_id) || "hsl(var(--primary))"}
                        getSignedUrl={getSignedUrl}
                        showChildBadge={filter === "all"}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active, onClick, color, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all border"
      style={
        active
          ? { background: color, color: "hsl(var(--primary-foreground))", borderColor: color }
          : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function BookTile({
  book, child, color, getSignedUrl, showChildBadge,
}: {
  book: ReadingBook;
  child?: Child;
  color: string;
  getSignedUrl: (p: string) => Promise<string | null>;
  showChildBadge: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

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

  const date = book.read_at || book.created_at;

  return (
    <div className="group">
      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-soft relative">
        {url ? (
          <img
            src={url}
            alt={book.title || "Book"}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={() => {
              setUrl(null);
              setImgFailed(true);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <BookOpen className="h-6 w-6" />
          </div>
        )}
        {showChildBadge && child && (
          <span
            className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur"
            style={{ background: `${color}E6`, color: "hsl(var(--primary-foreground))" }}
            title={child.name}
          >
            <span>{child.emoji}</span>
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] font-semibold leading-tight line-clamp-2" title={book.title || ""}>
        {book.title || "Untitled"}
      </p>
      <p className="text-[10px] text-muted-foreground">{format(new Date(date), "d MMM")}</p>
    </div>
  );
}
