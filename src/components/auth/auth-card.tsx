import { continueAsGuest, signInWithGoogle, signInWithPassword, signUpWithPassword } from "@/app/actions";
import { GameArtwork } from "@/components/games/game-artwork";
import { InfoHint } from "@/components/ui/info-hint";
import type { LocaleCode } from "@/lib/i18n/locales";

export function AuthCard({
  locale,
  copy,
  error
}: {
  locale: LocaleCode;
  copy: Record<"title" | "subtitle" | "email" | "password" | "login" | "demo", string>;
  error?: string | null;
}) {
  return (
    <section className="auth-page panel">
      <GameArtwork variantKey="classic" locale={locale} />
      <div className="auth-intro">
        <div className="compact-title-row">
          <h1>{copy.title}</h1>
          <InfoHint text={copy.subtitle} />
        </div>
      </div>
      <div className="auth-form-card">
        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
        <form action={signInWithPassword} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="grid gap-2 text-sm font-bold">
            {copy.email}
            <input className="auth-input focus-ring" type="email" name="email" autoComplete="email" required />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            {copy.password}
            <input className="auth-input focus-ring" type="password" name="password" autoComplete="current-password" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button className="auth-submit-primary focus-ring">
              {copy.login}
            </button>
            <button formAction={signUpWithPassword} className="auth-submit-secondary focus-ring">
              Create account
            </button>
          </div>
        </form>
        <form action={signInWithGoogle} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <button className="auth-google-button focus-ring">
            Continue with Google
          </button>
        </form>
        <form action={continueAsGuest}>
          <input type="hidden" name="locale" value={locale} />
          <button className="focus-ring action-secondary inline-flex px-5 py-3">{copy.demo}</button>
        </form>
      </div>
    </section>
  );
}
