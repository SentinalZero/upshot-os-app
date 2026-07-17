import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";

export default function ForgotPassword() {
  const { resetPassword, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!configured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-display font-bold mb-3">Configuration Required</h1>
          <p className="text-sm text-muted-foreground">
            Supabase environment variables are not configured.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: err } = await resetPassword(email);
    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
    setSubmitting(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="flex justify-center mb-8">
            <a href="/">
              <img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-14 w-auto" />
            </a>
          </div>
          <div className="rounded-2xl border border-subtle bg-surface p-8 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-4">
              If an account exists for <strong className="text-foreground">{email}</strong>, we've sent a password reset link.
            </p>
            <Link href="/login" className="text-sm text-gold hover:underline">
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            <h1 className="font-display text-2xl font-bold tracking-tight">Reset password</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your email to receive a reset link</p>
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
              {submitting ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/login" className="text-xs text-gold hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
