import { AuthCard } from "@/components/auth-card";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <AuthCard
      locale={locale}
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
