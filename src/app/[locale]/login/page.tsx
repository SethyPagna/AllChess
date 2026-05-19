import { AuthCard } from "@/components/auth-card";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

const authErrorMessages: Record<string, string> = {
  "google-oauth-not-configured": "Google sign-in is not configured yet. Use email/password or continue as guest.",
  "invalid-credentials": "Enter a valid email and a password with at least 6 characters.",
  "invalid-account": "Create an account with a valid email and a password with at least 6 characters."
};

export default async function LoginPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = searchParams ? await searchParams : {};
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const rawError = query.error ? decodeURIComponent(query.error) : null;
  const error = rawError ? authErrorMessages[rawError] ?? rawError : null;

  return (
    <AuthCard
      locale={locale}
      error={error}
      copy={{
        title: t("auth.title"),
        subtitle: t("auth.subtitle"),
        email: t("auth.email"),
        password: t("auth.password"),
        login: t("nav.login"),
        demo: t("auth.demo")
      }}
    />
  );
}
