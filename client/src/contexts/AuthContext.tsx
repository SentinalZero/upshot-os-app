import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  active_organization_id: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface OrgMember {
  organization_id: string;
  user_id: string;
  role: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  orgRole: string | null;
  loading: boolean;
  configured: boolean;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  createOrganization: (name: string, slug: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    organization: null,
    orgRole: null,
    loading: true,
    configured: supabaseConfigured,
  });

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    return data as Profile | null;
  }, []);

  const fetchOrganization = useCallback(async (orgId: string) => {
    if (!supabase) return null;
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();
    return data as Organization | null;
  }, []);

  const fetchOrgRole = useCallback(async (userId: string, orgId: string) => {
    if (!supabase) return null;
    const { data } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .single();
    return data?.role || null;
  }, []);

  const loadUserData = useCallback(async (user: User) => {
    const profile = await fetchProfile(user.id);
    let organization: Organization | null = null;
    let orgRole: string | null = null;
    if (profile?.active_organization_id) {
      organization = await fetchOrganization(profile.active_organization_id);
      orgRole = await fetchOrgRole(user.id, profile.active_organization_id);
    }
    setState(prev => ({ ...prev, profile, organization, orgRole, loading: false }));
  }, [fetchProfile, fetchOrganization, fetchOrgRole]);

  useEffect(() => {
    if (!supabase) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setState(prev => ({ ...prev, user: session.user, session }));
        loadUserData(session.user);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({ ...prev, user: session?.user || null, session }));
      if (session?.user) {
        loadUserData(session.user);
      } else {
        setState(prev => ({ ...prev, profile: null, organization: null, orgRole: null, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    if (!supabase) return { error: "Supabase not configured", needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });
    if (error) return { error: error.message, needsConfirmation: false };
    const needsConfirmation = !data.session;
    return { error: null, needsConfirmation };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setState(prev => ({ ...prev, user: null, session: null, profile: null, organization: null, orgRole: null }));
  };

  const resetPassword = async (email: string) => {
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const createOrganization = async (name: string, slug: string) => {
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.rpc("create_organization", {
      organization_name: name,
      organization_slug: slug,
    });
    if (error) return { error: error.message };

    if (!state.user) return { error: "Organization created, but the signed-in user could not be resolved." };

    const profile = await fetchProfile(state.user.id);
    const organizationId = profile?.active_organization_id;
    if (!organizationId) {
      await loadUserData(state.user);
      return { error: "Organization created, but workspace provisioning could not determine the active organization." };
    }

    const { error: provisionError } = await supabase.functions.invoke("provision-default-workspace", {
      body: { organization_id: organizationId },
    });

    await loadUserData(state.user);

    if (provisionError) {
      return {
        error: `Organization created, but default automation setup needs attention: ${provisionError.message}`,
      };
    }

    return { error: null };
  };

  const refreshProfile = async () => {
    if (state.user) {
      await loadUserData(state.user);
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut, resetPassword, createOrganization, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
