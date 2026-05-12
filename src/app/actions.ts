"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  locale: z.string().default("en")
});

export async function signInWithPassword(formData: FormData) {
  const parsed = authSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/en/login?error=invalid-credentials");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect(`/${parsed.data.locale}/lobby?demo=1`);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    redirect(`/${parsed.data.locale}/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/${parsed.data.locale}/lobby`);
  redirect(`/${parsed.data.locale}/lobby`);
}

export async function signUpWithPassword(formData: FormData) {
  const parsed = authSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/en/login?error=invalid-account");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect(`/${parsed.data.locale}/lobby?demo=1`);
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    redirect(`/${parsed.data.locale}/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/${parsed.data.locale}/lobby`);
  redirect(`/${parsed.data.locale}/lobby`);
}

export async function signOut(locale = "en") {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  revalidatePath(`/${locale}`);
  redirect(`/${locale}`);
}
