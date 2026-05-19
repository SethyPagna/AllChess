export type AuthErrorCode = "invalid-credentials" | "invalid-account" | "account-exists" | "auth-error";

export function errorCodeForSignInFailure() {
  return "invalid-credentials" satisfies AuthErrorCode;
}

export function errorCodeForSignUpFailure(error: string) {
  if (/already exists/i.test(error)) return "account-exists" satisfies AuthErrorCode;
  return "auth-error" satisfies AuthErrorCode;
}
