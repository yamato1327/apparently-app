import { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useReadingBooks } from "@/hooks/useReadingBooks";
import { useChildren } from "@/hooks/useChildren";
import { canUseUploadedBookPhoto, findBookCoverByTitle } from "@/lib/readingCovers";

export default function TonightsReading() {
  const { children: familyChildren } = useChildren();
  const { books: readingBooks, getSignedUrl } = useReadingBooks();

  const activeBooks = useMemo(() => readingBooks.filter((b) => !b.is_read), [readingBooks]);

  const readingChildIds = useMemo(
    () => Array.from(new Set(activeBooks.map((b) => b.child_id))),
    [activeBooks]
  );

  const [readingChildFilter, setReadingChildFilter] = useState<string>("all");
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  const visibleBooks = useMemo(() => {
    return readingChildFilter === "all"
      ? activeBooks
      : activeBooks.filter((b) => b.child_id === readingChildFilter);
  }, [activeBooks, readingChildFilter]);

  useEffect(() => {
    if (visibleBooks.length === 0) {
      setActiveBookId(null);
      return;
    }
    if (!activeBookId || !visibleBooks.find((b) => b.id === activeBookId)) {
      setActiveBookId(visibleBooks[0].id);
    }
  }, [visibleBooks, activeBookId]);

  const selectedBook =
    visibleBooks.find((b) => b.id === activeBookId) || visibleBooks[0] || null;
  const readingQuestions = selectedBook
    ? ([selectedBook.question_1, selectedBook.question_2, selectedBook.question_3].filter(Boolean) as string[])
    : [];
  const selectedBookChild = selectedBook
    ? familyChildren?.find((c: any) => c.id === selectedBook.child_id)
    : undefined;

  if (!selectedBook) return null;

  return (
    <div className="rounded-2xl border bg-gradient-to-b from-primary/5 to-transparent p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="rounded-lg bg-primary/10 p-1.5 text-primary shrink-0">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold font-display text-foreground">Tonight's Reading</h3>
          <p className="text-[10px] text-muted-foreground">
            {selectedBook.title ? `Ask about “${selectedBook.title}”` : "Conversation starters"}
          </p>
        </div>
      </div>

      {readingChildIds.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          <button
            onClick={() => setReadingChildFilter("all")}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all ${
              readingChildFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {readingChildIds.map((cid) => {
            const c = familyChildren?.find((k: any) => k.id === cid);
            if (!c) return null;
            return (
              <button
                key={cid}
                onClick={() => setReadingChildFilter(cid)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all ${
                  readingChildFilter === cid
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="mr-1">{c.emoji}</span>{c.name}
              </button>
            );
          })}
        </div>
      )}

      {visibleBooks.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {visibleBooks.map((b) => {
            const isActive = b.id === selectedBook.id;
            return (
              <button
                key={b.id}
                onClick={() => setActiveBookId(b.id)}
                title={b.title || "Untitled"}
                className={`shrink-0 w-12 h-16 rounded-md overflow-hidden bg-muted border-2 transition-all ${
                  isActive ? "border-primary shadow-soft" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <BookCover
                  coverUrl={b.cover_url}
                  photoPath={b.photo_path}
                  title={b.title}
                  getSignedUrl={getSignedUrl}
                  iconSize="h-4 w-4"
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-3">
        <div className="shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-muted shadow-soft">
          <BookCover
            coverUrl={selectedBook.cover_url}
            photoPath={selectedBook.photo_path}
            title={selectedBook.title}
            getSignedUrl={getSignedUrl}
            iconSize="h-5 w-5"
          />
        </div>
        <div className="flex-1 min-w-0">
          {selectedBookChild && (
            <p className="text-[10px] text-muted-foreground mb-1">
              {selectedBookChild.emoji} {selectedBookChild.name} is reading
            </p>
          )}
          {readingQuestions.length > 0 ? (
            <ol className="list-decimal list-inside space-y-1">
              {readingQuestions.map((q, i) => (
                <li key={i} className="text-[12px] leading-snug text-foreground">{q}</li>
              ))}
            </ol>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              No questions yet for this book.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BookCover({
  coverUrl,
  photoPath,
  title,
  getSignedUrl,
  iconSize = "h-4 w-4",
}: {
  coverUrl: string | null;
  photoPath: string;
  title: string | null;
  getSignedUrl: (path: string) => Promise<string | null>;
  iconSize?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolveCover = async () => {
      if (!failed) {
        if (coverUrl) {
          setSrc(coverUrl);
          return;
        }

        const discoveredCover = await findBookCoverByTitle(title);
        if (discoveredCover) {
          if (!cancelled) setSrc(discoveredCover);
          return;
        }
      }

      if (!canUseUploadedBookPhoto(photoPath)) {
        if (!cancelled) setSrc(null);
        return;
      }

      const uploadedPhoto = await getSignedUrl(photoPath);
      if (!cancelled) setSrc(uploadedPhoto);
    };

    resolveCover();

    return () => {
      cancelled = true;
    };
  }, [coverUrl, photoPath, title, failed, getSignedUrl]);

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <BookOpen className={iconSize} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={title || "Book"}
      className="w-full h-full object-cover"
      onError={() => {
        setSrc(null);
        setFailed(true);
      }}
    />
  );
}