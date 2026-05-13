import { continueAsGuest, signInWithGoogle, signInWithPassword, signUpWithPassword } from "@/app/actions";
import type { LocaleCode } from "@/lib/i18n/locales";

export function AuthCard({
  locale,
  copy
}: {
  locale: LocaleCode;
  copy: Record<"title" | "subtitle" | "email" | "password" | "login" | "demo", string>;
}) {
  return (
    <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-5 py-6">
        <h1 className="max-w-2xl text-4xl font-black tracking-normal sm:text-6xl">{copy.title}</h1>
        <p className="max-w-xl text-lg leading-8 text-[var(--muted)]">{copy.subtitle}</p>
        <form action={continueAsGuest}>
          <input type="hidden" name="locale" value={locale} />
          <button className="focus-ring inline-flex rounded-md bg-[var(--accent)] px-5 py-3 font-bold text-black">{copy.demo}</button>
        </form>
      </div>
      <div className="panel p-5">
        <form action={signInWithPassword} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="grid gap-2 text-sm font-medium">
            {copy.email}
            <input
              className="focus-ring rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
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
            <button className="focus-ring rounded-md bg-[var(--foreground)] px-4 py-3 font-semibold text-[var(--background)]">
              {copy.login}
            </button>
            <button
              formAction={signUpWithPassword}
              className="focus-ring rounded-md border border-[var(--border)] px-4 py-3 font-semibold"
            >
              Create
            </button>
          </div>
        </form>
        <form action={signInWithGoogle} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <button className="focus-ring w-full rounded-md border border-[var(--border)] px-4 py-3 font-semibold">
            Continue with Google
          </button>
        </form>
      </div>
    </section>
  );
}
