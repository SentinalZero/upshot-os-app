import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";

export default function Signup() {
  const { signUp, user, profile, loading, configured } = useAuth();
  const [, navigate] = useLocation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

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

  if (needsConfirmation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="flex justify-center mb-8">
            <a href="/">
              <img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-14 w-auto" />
            </a>
          </div>
          <div className="rounded-2xl border border-subtle bg-surface p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[oklch(0.75_0.18_155/15%)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[oklch(0.75_0.18_155)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-4">
              We've sent a confirmation link to <strong className="text-foreground">{email}</strong>. Click the link to activate your account.
            </p>
            <Link href="/login" className="text-sm text-gold hover:underline">
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    const { error: err, needsConfirmation: nc } = await signUp(email, password, firstName, lastName);
    if (err) {
      setError(err);
      setSubmitting(false);
    } else if (nc) {
      setNeedsConfirmation(true);
    }
    // If no confirmation needed, auth state change will redirect
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-8">
          <a href="/">
            <img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-14 w-auto" />
          </a>
        </div>

        <div className="rounded-2xl border border-subtle bg-surface p-8">
          <div className="text-center mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Get started with Upshot OS</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono font-medium tracking-wider uppercase text-muted-foreground block mb-1.5">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-subtle bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono font-medium tracking-wider uppercase text-muted-foreground block mb-1.5">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-subtle bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
                  placeholder="Smith"
                />
              </div>
            </div>

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

            <div>
              <label className="text-[11px] font-mono font-medium tracking-wider uppercase text-muted-foreground block mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
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
              {submitting ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-gold hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
