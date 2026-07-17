import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOrg?: boolean;
}

export function ProtectedRoute({ children, requireOrg = false }: ProtectedRouteProps) {
  const { user, profile, loading, configured } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-mono">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-display font-bold mb-3">Configuration Required</h1>
          <p className="text-sm text-muted-foreground">
            Supabase environment variables are not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (requireOrg && !profile?.active_organization_id) {
    return <Redirect to="/onboarding/organization" />;
  }

  return <>{children}</>;
}
