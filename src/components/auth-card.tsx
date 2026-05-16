import { continueAsGuest, signInWithGoogle, signInWithPassword, signUpWithPassword } from "@/app/actions";
import { InfoHint } from "@/components/info-hint";
import type { LocaleCode } from "@/lib/i18n/locales";

export function AuthCard({
  locale,
  copy
}: {
  locale: LocaleCode;
  copy: Record<"title" | "subtitle" | "email" | "password" | "login" | "demo", string>;
}) {
  return (
    <section className="auth-page mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="auth-intro panel">
        <div className="compact-title-row">
          <h1>{copy.title}</h1>
          <InfoHint text={copy.subtitle} />
        </div>
        <div className="auth-benefits" aria-label="Account benefits">
          <span>Ratings</span>
          <span>Reviews</span>
          <span>Preferences</span>
        </div>
        <form action={continueAsGuest}>
          <input type="hidden" name="locale" value={locale} />
          <button className="focus-ring action-primary inline-flex px-5 py-3">{copy.demo}</button>
        </form>
      </div>
      <div className="panel auth-form-card">
        <form action={signInWithPassword} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="grid gap-2 text-sm font-bold">
            {copy.email}
            <input
              className="focus-ring rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            {copy.password}
            <input
              className="focus-ring rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button className="focus-ring rounded-md bg-[var(--foreground)] px-4 py-3 font-bold text-[var(--background)]">
              {copy.login}
            </button>
            <button
              formAction={signUpWithPassword}
              className="focus-ring rounded-md border border-[var(--border)] px-4 py-3 font-bold"
            >
              Create
            </button>
          </div>
        </form>
        <form action={signInWithGoogle} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <button className="focus-ring w-full rounded-md border border-[var(--border)] px-4 py-3 font-bold">
            Continue with Google
          </button>
        </form>
      </div>
    </section>
  );
}
