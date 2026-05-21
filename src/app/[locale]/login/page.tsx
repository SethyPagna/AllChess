import { AuthCard } from "@/components/auth/auth-card";
import { isLoginErrorCode, messageForLoginError } from "@/lib/auth/error-codes";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { safeDecodeQueryValue } from "@/lib/routing/params";
import { redirect } from "next/navigation";

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
  const rawError = safeDecodeQueryValue(query.error, { malformedFallback: "unknown" });
  if (rawError && !isLoginErrorCode(rawError)) {
    redirect(`/${locale}/login?error=auth-error`);
  }
  const error = messageForLoginError(rawError);

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
