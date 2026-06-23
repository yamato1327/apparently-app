import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Status = "loading" | "valid" | "already" | "invalid" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        if (json.valid === false && json.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (json.valid === true) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) {
        setStatus("error");
      } else if ((data as any)?.success === true) {
        setStatus("done");
      } else if ((data as any)?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-card text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailX className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold font-display text-foreground mb-2">
          Email preferences
        </h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Checking your link…</p>
          </div>
        )}

        {status === "valid" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Click below to unsubscribe from these emails. You'll stop receiving
              briefings and reflections from this address.
            </p>
            <button
              onClick={confirm}
              disabled={submitting}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm unsubscribe
            </button>
          </>
        )}

        {status === "already" && (
          <div className="py-4">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              You're already unsubscribed. No more emails will be sent.
            </p>
          </div>
        )}

        {status === "done" && (
          <div className="py-4">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">You've been unsubscribed.</p>
            <p className="text-xs text-muted-foreground mt-1">
              You can re-enable emails anytime from Settings.
            </p>
          </div>
        )}

        {(status === "invalid" || status === "error") && (
          <div className="py-4">
            <XCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {status === "invalid"
                ? "This unsubscribe link is invalid or expired."
                : "Something went wrong. Please try again later."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
