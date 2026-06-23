import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Child {
  id: string;
  name: string;
  emoji: string;
  birth_month?: number | null;
  birth_year?: number | null;
  school_name?: string | null;
}

export function useChildren() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChildren = useCallback(async () => {
    if (!user) { setChildren([]); setLoading(false); return; }

    const { data, error } = await supabase
      .from("children")
      .select("id, name, emoji, birth_month, birth_year, school_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch children error:", error);
    } else {
      setChildren((data || []).map(d => ({ ...d, emoji: d.emoji || '👦' })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  const addChild = useCallback(async (name: string, emoji?: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("children")
      .insert({ user_id: user.id, name, emoji: emoji || '👦' } as any)
      .select("id, name, emoji, birth_month, birth_year, school_name")
      .single();

    if (error) {
      toast.error("Failed to add child");
    } else if (data) {
      setChildren((prev) => [...prev, { ...data, emoji: data.emoji || '👦' }]);
    }
  }, [user]);

  const updateChild = useCallback(async (id: string, updates: Partial<Omit<Child, "id">>) => {
    const { error } = await supabase
      .from("children")
      .update(updates as any)
      .eq("id", id);

    if (error) {
      toast.error("Failed to update child");
      return false;
    }
    setChildren((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    return true;
  }, []);

  const removeChild = useCallback(async (id: string) => {
    const { error } = await supabase.from("children").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove child");
    } else {
      setChildren((prev) => prev.filter((c) => c.id !== id));
    }
  }, []);

  return { children, loading, addChild, updateChild, removeChild, refetch: fetchChildren };
}
