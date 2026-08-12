import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

async function ensureProfile(user: User) {
  const { data } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (data) return;

  const fallbackName =
    (user.user_metadata?.["full_name"] as string | undefined) ??
    (user.user_metadata?.["name"] as string | undefined) ??
    user.email?.split("@")[0] ??
    "Pessoa da Rede";

  await supabase.from("profiles").insert({
    id: user.id,
    display_name: fallbackName,
    avatar_url: (user.user_metadata?.["avatar_url"] as string | undefined) ?? null,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (nextSession?.user) {
        void ensureProfile(nextSession.user);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        void ensureProfile(data.session.user);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
