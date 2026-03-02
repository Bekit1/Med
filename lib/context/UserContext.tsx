"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

interface UserContextValue {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // Initial session check + subscribe to changes
  useEffect(() => {
    let ignore = false;

    // 1. Check current session (fast, reads from cookies/storage — no network call)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (ignore) return;

      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // 2. Listen for all auth changes (login, logout, token refresh, expiry)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const authUser = session?.user ?? null;
        setUser(authUser);

        if (authUser) {
          loadProfile(authUser.id);
        } else {
          setProfile(null);
        }

        // If we were still in loading state, we're done now
        setLoading(false);
      }
    );

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setProfile(data as Profile);
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — session might already be invalid
    }
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  };

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        isAdmin: profile?.role === "admin",
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
