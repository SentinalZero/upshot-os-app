import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

export default function OnboardingOrganization() {
  const { createOrganization, profile, user } = useAuth();
  const [, navigate] = useLocation();
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If user already has an org, redirect
  useEffect(() => {
    if (profile?.active_organization_id) {
      navigate("/app");
    }
  }, [profile, navigate]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugEdited && orgName) {
      const generated = orgName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 48);
      setSlug(generated);
    }
  }, [orgName, slugEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!orgName.trim()) {
      setError("Organization name is required.");
      return;
    }
    if (!slug.trim() || !/^[a-z0-9-]+$/.test(slug)) {
      setError("Slug must be lowercase letters, numbers, and hyphens only.");
      return;
    }

    setSubmitting(true);
    const { error: err } = await createOrganization(orgName.trim(), slug.trim());
    if (err) {
      setError(err);
      setSubmitting(false);
    } else {
      navigate("/app");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[480px]">
        <div className="flex justify-center mb-8">
          <a href="/">
            <img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-14 w-auto" />
          </a>
        </div>

        <div className="rounded-2xl border border-subtle bg-surface p-8">
          <div className="mb-6">
            <span className="text-[10px] font-mono text-gold tracking-wider uppercase">// Onboarding</span>
            <h1 className="font-display text-2xl font-bold tracking-tight mt-1">Set up your organization</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome{user?.user_metadata?.first_name ? `, ${user.user_metadata.first_name}` : ""}. Create your workspace to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-mono font-medium tracking-wider uppercase text-muted-foreground block mb-1.5">Organization name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-subtle bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
                placeholder="Acme Logistics"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-medium tracking-wider uppercase text-muted-foreground block mb-1.5">URL slug</label>
              <div className="flex items-center gap-0">
                <span className="px-3 py-3 rounded-l-lg border border-r-0 border-subtle bg-muted text-xs text-muted-foreground font-mono">
                  app/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
                  required
                  className="flex-1 px-4 py-3 rounded-r-lg border border-subtle bg-background text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
                  placeholder="acme-logistics"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only.</p>
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
              {submitting ? "Creating organization..." : "Create Organization"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
