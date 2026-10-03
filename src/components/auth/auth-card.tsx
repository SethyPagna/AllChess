import { continueAsGuest, signInWithGoogle, signInWithPassword, signUpWithPassword } from "@/app/actions";
import type { LocaleCode } from "@/lib/i18n/locales";

export function AuthCard({
  locale,
  copy,
  error
}: {
  locale: LocaleCode;
  copy: Record<"title" | "email" | "password" | "login" | "demo", string>;
  error?: string | null;
}) {
  return (
    <section className="auth-shell">
      <div className="auth-card">
        <h1 className="acct-title">{copy.title}</h1>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <form action={signInWithPassword} className="auth-form">
          <input type="hidden" name="locale" value={locale} />
          <label className="auth-field">
            <span>{copy.email}</span>
            <input className="focus-ring" type="email" name="email" autoComplete="email" required />
          </label>
          <label className="auth-field">
            <span>{copy.password}</span>
            <input className="focus-ring" type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="action-primary auth-wide focus-ring">{copy.login}</button>
          <button formAction={signUpWithPassword} className="auth-quiet focus-ring">
            Create account
          </button>
        </form>
        <div className="auth-divider" aria-hidden="true"><span>or</span></div>
        <form action={signInWithGoogle}>
          <input type="hidden" name="locale" value={locale} />
          <button className="action-secondary auth-wide focus-ring">Continue with Google</button>
        </form>
        <form action={continueAsGuest}>
          <input type="hidden" name="locale" value={locale} />
          <button className="auth-quiet focus-ring">{copy.demo}</button>
        </form>
      </div>
    </section>
  );
}
