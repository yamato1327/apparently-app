import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);

      // Google OAuth sign-ins (login or a dedicated "Connect Gmail" flow) carry
      // provider tokens on the session — persist them for Edge Functions to use.
      if (event === "SIGNED_IN" && session?.provider_token && session?.provider_refresh_token) {
        supabase
          .from("user_integrations")
          .upsert(
            {
              user_id: session.user.id,
              google_access_token: session.provider_token,
              google_refresh_token: session.provider_refresh_token,
              google_token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
              google_email: session.user.email,
              gmail_connected: true,
            },
            { onConflict: "user_id" }
          )
          .then(({ error }) => {
            if (error) console.error("Failed to save Google integration tokens:", error);
          });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
