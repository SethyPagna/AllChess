export type AuthErrorCode = "invalid-credentials" | "invalid-account" | "account-exists" | "auth-error";
export type LoginErrorCode = AuthErrorCode | "google-oauth-not-configured";

const loginErrorMessages: Record<LoginErrorCode, string> = {
  "google-oauth-not-configured": "Google sign-in is not configured yet. Use email/password or continue as guest.",
  "invalid-credentials": "Enter a valid email and a password with at least 6 characters.",
  "invalid-account": "Create an account with a valid email and a password with at least 6 characters.",
  "account-exists": "An account already exists for this email. Sign in instead or continue as guest.",
  "auth-error": "We could not complete sign-in. Try again or continue as guest."
};

export function errorCodeForSignInFailure() {
  return "invalid-credentials" satisfies AuthErrorCode;
}

export function errorCodeForSignUpFailure(error: string) {
  if (/already exists/i.test(error)) return "account-exists" satisfies AuthErrorCode;
  return "auth-error" satisfies AuthErrorCode;
}

export function isLoginErrorCode(value: string | null): value is LoginErrorCode {
  return Boolean(value && value in loginErrorMessages);
}

export function messageForLoginError(value: string | null) {
  return isLoginErrorCode(value) ? loginErrorMessages[value] : null;
}
