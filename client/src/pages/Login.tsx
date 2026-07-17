import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Link } from "wouter";

export default function Login() {
  const { signIn, user, profile, loading, configured } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in (wrapped in useEffect to avoid setState during render)
  useEffect(() => {
    if (!loading && user) {
      if (!profile?.active_organization_id) {
        navigate("/onboarding/organization");
      } else {
        navigate("/app");
      }
    }
  }, [loading, user, profile, navigate]);

  // Show nothing while redirecting
  if (!loading && user) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
    // Auth state change will trigger redirect
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <a href="/">
            <img
              src="/manus-storage/upshot-theory-logo_f207295d.png"
              alt="Upshot Theory"
              className="h-14 w-auto"
            />
          </a>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-subtle bg-surface p-8">
          <div className="text-center mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Access your Upshot OS Command Center</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-mono font-medium tracking-wider uppercase text-muted-foreground block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-subtle bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-medium tracking-wider uppercase text-muted-foreground block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-subtle bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[oklch(0.62_0.22_25/10%)] border border-[oklch(0.62_0.22_25/30%)] text-[oklch(0.75_0.18_25)] text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-sm bg-gold text-background hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.97]"
              style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-xs text-gold hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link href="/signup" className="text-gold hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
