"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createExpiredSessionCookie, createSessionCookie } from "@/lib/auth/session";
import { createGuestSessionWithD1, signInWithD1, signUpWithD1 } from "@/lib/auth/d1";
import { errorCodeForSignInFailure, errorCodeForSignUpFailure } from "@/lib/auth/error-codes";
import { localeFromFormData, localeFromValue } from "@/lib/auth/form-locale";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  locale: z.string().default("en")
});

export async function signInWithPassword(formData: FormData) {
  const locale = localeFromFormData(formData);
  const parsed = authSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/${locale}/login?error=invalid-credentials`);
  }

  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    redirect(`/${locale}/lobby?demo=1`);
  }

  const result = await signInWithD1(env.ALLCHESS_D1, parsed.data.email, parsed.data.password);
  if (!result.ok) {
    redirect(`/${locale}/login?error=${errorCodeForSignInFailure()}`);
  }

  await setSessionCookie(result.sessionId, result.maxAge);
  revalidatePath(`/${locale}/lobby`);
  redirect(`/${locale}/lobby`);
}

export async function signUpWithPassword(formData: FormData) {
  const locale = localeFromFormData(formData);
  const parsed = authSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/${locale}/login?error=invalid-account`);
  }

  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    redirect(`/${locale}/lobby?demo=1`);
  }

  const result = await signUpWithD1(env.ALLCHESS_D1, parsed.data.email, parsed.data.password);
  if (!result.ok) {
    redirect(`/${locale}/login?error=${errorCodeForSignUpFailure(result.error)}`);
  }

  await setSessionCookie(result.sessionId, result.maxAge);
  revalidatePath(`/${locale}/lobby`);
  redirect(`/${locale}/lobby`);
}

export async function continueAsGuest(formData: FormData) {
  const locale = localeFromFormData(formData);
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) {
    redirect(`/${locale}/lobby?demo=1`);
  }

  const result = await createGuestSessionWithD1(env.ALLCHESS_D1);
  if (result.ok) {
    await setSessionCookie(result.sessionId, result.maxAge);
  }
  revalidatePath(`/${locale}/lobby`);
  redirect(`/${locale}/lobby`);
}

export async function signInWithGoogle(formData: FormData) {
  const locale = localeFromFormData(formData);
  const env = await getCloudflareRuntimeEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    redirect(`/${locale}/login?error=google-oauth-not-configured`);
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", locale);
  redirect(url.toString() as never);
}

export async function signOut(locale = "en") {
  const safeLocale = localeFromValue(locale);
  const cookie = createExpiredSessionCookie();
  const cookieStore = await cookies();
  cookieStore.set(cookie.name, cookie.value, cookie.options);
  revalidatePath(`/${safeLocale}`);
  redirect(`/${safeLocale}`);
}

async function setSessionCookie(sessionId: string, maxAge: number) {
  const cookie = createSessionCookie(sessionId, maxAge);
  const cookieStore = await cookies();
  cookieStore.set(cookie.name, cookie.value, cookie.options);
}
