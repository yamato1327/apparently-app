import { useEffect, useRef, useState, useCallback } from "react";
import { Paperclip, Upload, Loader2, FileText, Image as ImageIcon, Trash2, Eye, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getSeedId } from "@/lib/recurrence";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EventAttachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

interface EventAttachmentsProps {
  eventId: string;
  /** Compact: smaller surface for inline use on the event card */
  compact?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/*,application/pdf";

const EventAttachments = ({ eventId, compact = false }: EventAttachmentsProps) => {
  const { user } = useAuth();
  // Recurring events use synthetic IDs per-occurrence; attachments live on the seed event.
  const seedId = getSeedId(eventId);
  const [items, setItems] = useState<EventAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<EventAttachment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EventAttachment | null>(null);

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_attachments")
      .select("id, storage_path, file_name, mime_type, size_bytes, created_at")
      .eq("event_id", seedId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("load attachments", error);
    } else {
      setItems((data ?? []) as EventAttachment[]);
    }
    setLoading(false);
  }, [seedId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  // Sign URLs for image previews (1 hour validity)
  useEffect(() => {
    const imgs = items.filter((i) => (i.mime_type || "").startsWith("image/"));
    if (imgs.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const it of imgs) {
        if (signedUrls[it.id]) {
          next[it.id] = signedUrls[it.id];
          continue;
        }
        const { data } = await supabase.storage
          .from("event-attachments")
          .createSignedUrl(it.storage_path, 60 * 60);
        if (data?.signedUrl) next[it.id] = data.signedUrl;
      }
      if (!cancelled) setSignedUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const handleFiles = async (files: File[]) => {
    if (!user) {
      toast.error("Please sign in to upload");
      return;
    }
    const valid = files.filter((f) => {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} is over 10 MB`);
        return false;
      }
      if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
        toast.error(`${f.name}: only images and PDFs are supported`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    setUploading(true);
    try {
      for (const file of valid) {
        const ext = file.name.split(".").pop() || "bin";
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
        const path = `${user.id}/${seedId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("event-attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("event_attachments").insert({
          event_id: seedId,
          user_id: user.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (insErr) throw insErr;
      }
      toast.success(`📎 Attached ${valid.length} file${valid.length > 1 ? "s" : ""}`);
      await loadAttachments();
    } catch (e: any) {
      console.error("upload error", e);
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFiles(Array.from(files));
    if (inputRef.current) inputRef.current.value = "";
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const imgs: File[] = [];
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) imgs.push(f);
      }
    }
    if (imgs.length > 0) handleFiles(imgs);
  };

  const doDelete = async (att: EventAttachment) => {
    setBusyId(att.id);
    // Delete the DB row first; if that fails we keep the file (better than orphaned row).
    const { error } = await supabase.from("event_attachments").delete().eq("id", att.id);
    if (error) {
      toast.error("Failed to delete");
      setBusyId(null);
      return;
    }
    // Then best-effort remove the underlying object.
    const { error: delObj } = await supabase.storage
      .from("event-attachments")
      .remove([att.storage_path]);
    if (delObj) console.warn("storage delete", delObj);
    setItems((prev) => prev.filter((x) => x.id !== att.id));
    setSignedUrls((prev) => {
      const next = { ...prev };
      delete next[att.id];
      return next;
    });
    setBusyId(null);
    toast.success("Removed");
  };

  const startReplace = (att: EventAttachment) => {
    setReplaceTarget(att);
    // Defer click until state is set so onChange has the right target.
    setTimeout(() => replaceInputRef.current?.click(), 0);
  };

  const onReplacePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = replaceTarget;
    if (replaceInputRef.current) replaceInputRef.current.value = "";
    setReplaceTarget(null);
    if (!file || !target || !user) return;

    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} is over 10 MB`);
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error(`${file.name}: only images and PDFs are supported`);
      return;
    }

    setBusyId(target.id);
    const oldPath = target.storage_path;
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
      const newPath = `${user.id}/${seedId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("event-attachments")
        .upload(newPath, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from("event_attachments")
        .update({
          storage_path: newPath,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        })
        .eq("id", target.id);
      if (updErr) {
        // Roll back the new upload so we don't leak a file.
        await supabase.storage.from("event-attachments").remove([newPath]);
        throw updErr;
      }

      // Best-effort delete of the old object.
      const { error: delObj } = await supabase.storage
        .from("event-attachments")
        .remove([oldPath]);
      if (delObj) console.warn("storage delete (old)", delObj);

      // Refresh local state and clear stale preview URL.
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
      await loadAttachments();
      toast.success(`🔄 Replaced ${target.file_name}`);
    } catch (err: any) {
      console.error("replace error", err);
      toast.error(err.message || "Replace failed");
    } finally {
      setBusyId(null);
    }
  };

  const view = async (att: EventAttachment) => {
    const { data, error } = await supabase.storage
      .from("event-attachments")
      .createSignedUrl(att.storage_path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error("Could not open file");
      return;
    }
    const win = window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked — fall back to a same-tab navigation via a hidden anchor.
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    }
  };

  return (
    <div onPaste={onPaste} className={compact ? "" : "rounded-xl border bg-card p-3"}>
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments {items.length > 0 && <span className="text-muted-foreground">({items.length})</span>}
        </div>
        <label className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors">
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {uploading ? "Uploading…" : "Add"}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={onPick}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept={ACCEPT}
        onChange={onReplacePick}
        className="hidden"
      />

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No attachments yet — add an image, screenshot or PDF (paste with Ctrl+V also works).
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {items.map((it) => {
            const isImg = (it.mime_type || "").startsWith("image/");
            const url = signedUrls[it.id];
            const isBusy = busyId === it.id;
            return (
              <li
                key={it.id}
                className="group relative rounded-lg border bg-background overflow-hidden aspect-square"
              >
                <button
                  type="button"
                  onClick={() => view(it)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-center"
                  title={it.file_name}
                >
                  {isImg && url ? (
                    <img
                      src={url}
                      alt={it.file_name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : isImg ? (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <>
                      <FileText className="h-6 w-6 text-destructive" />
                      <span className="text-[9px] font-semibold text-muted-foreground">PDF</span>
                    </>
                  )}
                  <span className="relative z-10 mt-auto w-full truncate bg-foreground/60 text-background text-[9px] px-1 py-0.5 pr-14">
                    {it.file_name}
                  </span>
                </button>
                {/* Always-visible action bar (discoverable on touch) */}
                <div className="absolute bottom-1 right-1 z-20 flex gap-0.5 rounded-md bg-background/85 backdrop-blur-sm shadow-sm ring-1 ring-border/60">
                  {isBusy ? (
                    <span className="p-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); view(it); }}
                        className="p-1 text-foreground/70 hover:text-primary transition-colors"
                        title="View"
                        aria-label={`View ${it.file_name}`}
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startReplace(it); }}
                        className="p-1 text-foreground/70 hover:text-primary transition-colors"
                        title="Replace"
                        aria-label={`Replace ${it.file_name}`}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(it); }}
                        className="p-1 text-foreground/70 hover:text-destructive transition-colors"
                        title="Delete"
                        aria-label={`Delete ${it.file_name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold text-foreground">
                {confirmDelete?.file_name}
              </span>
              . This action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  const att = confirmDelete;
                  setConfirmDelete(null);
                  doDelete(att);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventAttachments;