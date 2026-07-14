import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ReadingBook {
  id: string;
  child_id: string;
  photo_path: string;
  title: string | null;
  question_1: string | null;
  question_2: string | null;
  question_3: string | null;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  cover_url: string | null;
  progress: string | null; // 'beginning' | 'middle' | 'end' | page number string
}

export function useReadingBooks() {
  const { user } = useAuth();
  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBooks = useCallback(async () => {
    if (!user) { setBooks([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("reading_books")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else setBooks((data || []) as ReadingBook[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  const addBook = useCallback(async (childId: string, file: File) => {
    if (!user) return null;
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${childId}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("reading-photos").upload(path, file, { upsert: false });
      if (up.error) throw up.error;

      // Convert to base64 for AI
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      const { data: ai, error: aiErr } = await supabase.functions.invoke("extract-book", {
        body: { image: base64 },
      });
      if (aiErr) throw aiErr;
      if (ai?.error) throw new Error(ai.error);

      const { data, error } = await supabase
        .from("reading_books")
        .insert({
          user_id: user.id,
          child_id: childId,
          photo_path: path,
          title: ai?.title || null,
          question_1: ai?.question_1 || null,
          question_2: ai?.question_2 || null,
          question_3: ai?.question_3 || null,
          cover_url: ai?.cover_url || null,
        } as any)
        .select("*")
        .single();
      if (error) throw error;
      setBooks((prev) => [data as ReadingBook, ...prev]);
      toast.success("Book added 📚");
      return data as ReadingBook;
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to add book");
      return null;
    }
  }, [user]);

  const removeBook = useCallback(async (id: string) => {
    const target = books.find((b) => b.id === id);
    const { error } = await supabase.from("reading_books").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    if (target?.photo_path) {
      await supabase.storage.from("reading-photos").remove([target.photo_path]);
    }
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }, [books]);

  const toggleRead = useCallback(async (id: string, isRead: boolean) => {
    const read_at = isRead ? new Date().toISOString() : null;
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, is_read: isRead, read_at } : b)));
    const { error } = await supabase
      .from("reading_books")
      .update({ is_read: isRead, read_at })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update");
      setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, is_read: !isRead } : b)));
    } else if (isRead) {
      toast.success("Nice — book marked as read 🎉");
    }
  }, []);

  const getSignedUrl = useCallback(async (path: string) => {
    const { data, error } = await supabase.storage.from("reading-photos").createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  }, []);

  const updateProgress = useCallback(async (
    bookId: string,
    progress: string,
    childName?: string,
    childAge?: number | null
  ) => {
    if (!user) return;

    const book = books.find((b) => b.id === bookId);
    if (!book) return;

    // Optimistically update progress in UI immediately
    setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, progress } : b));

    // Save progress to DB
    await supabase.from("reading_books").update({ progress }).eq("id", bookId);

    // Regenerate questions using the stored photo
    if (!book.photo_path) return;
    try {
      const { data: signedData } = await supabase.storage
        .from("reading-photos")
        .createSignedUrl(book.photo_path, 120);
      if (!signedData?.signedUrl) return;

      const imgResponse = await fetch(signedData.signedUrl);
      const blob = await imgResponse.blob();
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });

      const { data: ai, error: aiErr } = await supabase.functions.invoke("extract-book", {
        body: { image: base64, progress, childName, childAge },
      });

      if (aiErr || ai?.error) {
        toast.error("Couldn't regenerate questions");
        return;
      }

      const updates = {
        question_1: ai.question_1 || null,
        question_2: ai.question_2 || null,
        question_3: ai.question_3 || null,
      };
      await supabase.from("reading_books").update(updates).eq("id", bookId);
      setBooks((prev) =>
        prev.map((b) => b.id === bookId ? { ...b, ...updates } : b)
      );
      toast.success("Questions updated 📚");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update questions");
    }
  }, [user, books]);

  return { books, loading, addBook, removeBook, toggleRead, getSignedUrl, refetch: fetchBooks, updateProgress };
}