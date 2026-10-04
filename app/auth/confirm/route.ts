import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  const fail = (message: string) => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", message.slice(0, 200));
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  try {
    const supabase = await createClient();
    if (tokenHash && isOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) return fail(error.message);
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail(error.message);
    } else {
      const description = searchParams.get("error_description");
      return fail(description ?? "That sign-in link is invalid or incomplete.");
    }
  } catch {
    return fail("Sign-in is unavailable right now.");
  }

  return NextResponse.redirect(new URL(next, request.url));
}
