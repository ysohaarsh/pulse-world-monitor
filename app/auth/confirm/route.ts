import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type LoginErrorCode } from "../errors";
import { safeNext } from "../safe-next";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isOtpType(v: string | null): v is EmailOtpType {
  return v !== null && (OTP_TYPES as readonly string[]).includes(v);
}

/**
 * Email link landing route.
 * - `?token_hash=…&type=…` (custom email templates) → verifyOtp
 * - `?code=…` (default PKCE links) → exchangeCodeForSession
 * Then redirects to `next` (same-origin relative paths only).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const fail = (code: LoginErrorCode, detail?: string) => {
    if (detail) console.warn("[auth/confirm]", code, detail);
    const url = new URL("/login", request.url);
    url.searchParams.set("error", code);
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  try {
    const supabase = await createClient();
    if (tokenHash && isOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) return fail("link_invalid", error.message);
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail("link_invalid", error.message);
    } else {
      // Supabase may append ?error_description=…; log it, never reflect it.
      return fail(searchParams.has("error") ? "link_invalid" : "link_incomplete", searchParams.get("error_description") ?? undefined);
    }
  } catch (err) {
    return fail("unavailable", err instanceof Error ? err.message : String(err));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
