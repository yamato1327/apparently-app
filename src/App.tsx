import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import ProfileSettings from "./pages/ProfileSettings.tsx";
import ShareHandler from "./pages/ShareHandler.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading, signOut } = useAuth();
  type ProfileState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "ready"; onboarded: boolean }
    | { status: "error"; message: string };
  const [profileState, setProfileState] = useState<ProfileState>({ status: "idle" });

  useEffect(() => {
    if (!user) {
      setProfileState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setProfileState({ status: "checking" });

    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          // Treat profile fetch failure as "needs onboarding" rather than hanging.
          console.error("Profile lookup failed:", error);
          setProfileState({ status: "ready", onboarded: false });
          return;
        }
        setProfileState({
          status: "ready",
          onboarded: data?.onboarding_completed ?? false,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Profile lookup threw:", err);
        setProfileState({
          status: "error",
          message: err instanceof Error ? err.message : "Could not load your profile.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  if (profileState.status === "idle" || profileState.status === "checking") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your family profile…</p>
      </div>
    );
  }

  if (profileState.status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-base font-semibold text-foreground">We couldn't load your profile.</p>
        <p className="text-sm text-muted-foreground max-w-sm">{profileState.message}</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Retry
          </button>
          <button
            onClick={() => signOut()}
            className="rounded-full border px-4 py-2 text-sm font-semibold text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!profileState.onboarded) {
    return (
      <Onboarding
        onComplete={() => setProfileState({ status: "ready", onboarded: true })}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/settings" element={<ProfileSettings />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/share" element={<ShareHandler />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
