"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

export async function setLocale(formData: FormData): Promise<never> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) throw new Error("Unsupported locale");

  const rawReturnTo = formData.get("returnTo");
  const returnTo =
    typeof rawReturnTo === "string" && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/";

  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // The cookie localizes this browser. Persist the preference too so crons and
  // notification emails can speak the owner's language when no browser exists.
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { userId } = await auth();
      if (userId) {
        const member = await db.member.findUnique({
          where: { clerkUserId: userId },
          select: { businessId: true },
        });
        if (member) {
          await db.business.update({ where: { id: member.businessId }, data: { locale } });
        }
      }
    } catch {
      // Locale switching must never strand the UI during a transient auth/DB
      // failure. The secure cookie still completes the requested switch.
    }
  }

  redirect(returnTo);
}
