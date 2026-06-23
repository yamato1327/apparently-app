const TITLE_COVER_CACHE = new Map<string, Promise<string | null>>();

const HEIC_FILE_RE = /\.(heic|heif)(?:$|\?)/i;

function uniqueTitles(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);
  const stripped = trimmed.split(/\s[:\-–—]\s|:\s|\?\s+(?=[A-Z])/, 1)[0]?.trim();

  if (stripped && stripped !== trimmed) {
    variants.add(stripped);
    if (trimmed.includes("?") && !stripped.endsWith("?")) {
      variants.add(`${stripped}?`);
    }
  }

  return Array.from(variants);
}

async function searchOpenLibrary(title: string) {
  const response = await fetch(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5`
  );

  if (!response.ok) return null;

  const json = await response.json();
  for (const doc of json?.docs || []) {
    if (doc?.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
    if (doc?.isbn?.[0]) {
      return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    }
  }

  return null;
}

async function searchGoogleBooks(title: string) {
  const queries = [`intitle:${title}`, title];

  for (const query of queries) {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&printType=books`
    );

    if (!response.ok) continue;

    const json = await response.json();
    for (const item of json?.items || []) {
      const imageLinks = item?.volumeInfo?.imageLinks;
      const raw = imageLinks?.extraLarge || imageLinks?.large || imageLinks?.medium || imageLinks?.thumbnail || imageLinks?.smallThumbnail;
      if (raw) return String(raw).replace(/^http:\/\//, "https://");
    }
  }

  return null;
}

export function canUseUploadedBookPhoto(path: string | null | undefined) {
  if (!path) return false;
  return !HEIC_FILE_RE.test(path);
}

export async function findBookCoverByTitle(title: string | null | undefined) {
  const normalized = title?.trim().toLowerCase();
  if (!normalized) return null;

  const cached = TITLE_COVER_CACHE.get(normalized);
  if (cached) return cached;

  const request = (async () => {
    for (const candidate of uniqueTitles(title!)) {
      try {
        const openLibrary = await searchOpenLibrary(candidate);
        if (openLibrary) return openLibrary;
      } catch {
        // continue to the next source
      }

      try {
        const googleBooks = await searchGoogleBooks(candidate);
        if (googleBooks) return googleBooks;
      } catch {
        // continue to the next candidate
      }
    }

    return null;
  })();

  TITLE_COVER_CACHE.set(normalized, request);
  return request;
}