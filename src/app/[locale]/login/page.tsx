import { AuthCard } from "@/components/auth/auth-card";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { redirect } from "next/navigation";

const authErrorMessages: Record<string, string> = {
  "google-oauth-not-configured": "Google sign-in is not configured yet. Use email/password or continue as guest.",
  "invalid-credentials": "Enter a valid email and a password with at least 6 characters.",
  "invalid-account": "Create an account with a valid email and a password with at least 6 characters.",
  "account-exists": "An account already exists for this email. Sign in instead or continue as guest.",
  "auth-error": "We could not complete sign-in. Try again or continue as guest."
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
  const rawError = safeDecode(query.error);
  if (rawError && !authErrorMessages[rawError]) {
    redirect(`/${locale}/login?error=auth-error`);
  }
  const error = rawError ? authErrorMessages[rawError] : null;

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

function safeDecode(value?: string) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return "unknown";
  }
}
