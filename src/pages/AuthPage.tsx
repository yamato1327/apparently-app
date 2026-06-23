import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const AuthPage = () => {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a password reset link!");
        setMode("signin");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "forgot" ? "Reset password" : mode === "signup" ? "Create your account" : "Welcome back";
  const buttonText = mode === "forgot" ? "Send Reset Link" : mode === "signup" ? "Create Account" : "Sign In";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background overflow-hidden p-4">
      {/* Aurora background orbs — warm brand palette */}
      <div className="pointer-events-none absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-60"
           style={{ background: "hsl(12 85% 62% / 0.35)" }} />
      <div className="pointer-events-none absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-50"
           style={{ background: "hsl(180 70% 38% / 0.30)" }} />
      <div className="pointer-events-none absolute top-[20%] right-[10%] w-[30%] h-[40%] rounded-full blur-[100px] opacity-50"
           style={{ background: "hsl(38 95% 58% / 0.30)" }} />
      <div className="pointer-events-none absolute bottom-[10%] left-[20%] w-[40%] h-[30%] rounded-full blur-[100px] opacity-40"
           style={{ background: "hsl(165 70% 45% / 0.25)" }} />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle variant="inline" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass rounded-[2.5rem] p-8 md:p-12 shadow-elevated">
          {/* Logo & header */}
          <div className="text-center mb-10">
            <h1 className="font-display italic text-4xl font-semibold tracking-tight text-foreground mb-3">
              <span className="text-gradient-aurora">APParently</span>
              <span className="text-foreground">.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              The operating system for modern families.
            </p>
          </div>

          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-6 text-center">
            {title}
          </h2>

          {mode === "forgot" && (
            <p className="text-xs text-muted-foreground mb-5 text-center">
              Enter your email and we'll send you a link to reset your password.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-2 ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-5 py-4 bg-background/50 border border-border rounded-2xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all outline-none text-foreground placeholder:text-muted-foreground/60"
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-2 ml-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-background/50 border border-border rounded-2xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all outline-none text-foreground placeholder:text-muted-foreground/60"
                placeholder="name@example.com"
                required
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex justify-between mb-2 ml-1">
                  <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-medium text-secondary hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-background/50 border border-border rounded-2xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all outline-none text-foreground placeholder:text-muted-foreground/60"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                {mode === "signup" && (
                  <p className="mt-2 ml-1 text-[11px] text-muted-foreground">
                    Min 8 characters. Avoid common or breached passwords.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ boxShadow: "0 10px 30px -10px hsl(180 70% 38% / 0.45)" }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {buttonText}
            </button>
          </form>

          {mode !== "forgot" && (
            <>
              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-card/0 text-muted-foreground font-medium uppercase tracking-widest">
                    or continue with
                  </span>
                </div>
              </div>

              {/* Social */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-border rounded-xl hover:bg-background/50 transition-colors disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                )}
                <span className="text-sm font-medium text-foreground">Continue with Google</span>
              </button>
            </>
          )}

          <p className="mt-10 text-center text-sm text-muted-foreground">
            {mode === "forgot" ? (
              <button onClick={() => setMode("signin")} className="font-semibold text-secondary hover:underline">
                Back to sign in
              </button>
            ) : mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button onClick={() => setMode("signin")} className="font-semibold text-[hsl(12_85%_55%)] hover:underline">
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to APParently?{" "}
                <button onClick={() => setMode("signup")} className="font-semibold text-[hsl(12_85%_55%)] hover:underline">
                  Create an account
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-medium">
          Co-parenting, harmonized
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
