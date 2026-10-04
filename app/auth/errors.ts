/**
 * Fixed sign-in error codes for `/login?error=<code>`. The login page only renders these
 * messages, so a crafted link can't put arbitrary text on the real site.
 */
export const LOGIN_ERRORS = {
  link_invalid: "That sign-in link is invalid or has expired. Request a new one below.",
  link_incomplete: "That sign-in link is incomplete. Request a new one below.",
  unavailable: "Sign-in is unavailable right now. Please try again shortly.",
} as const;
export type LoginErrorCode = keyof typeof LOGIN_ERRORS;

export function loginErrorMessage(code: string | undefined): string | undefined {
  return code && Object.hasOwn(LOGIN_ERRORS, code) ? LOGIN_ERRORS[code as LoginErrorCode] : undefined;
}
