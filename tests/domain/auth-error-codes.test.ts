import { describe, expect, test } from "vitest";

import { errorCodeForSignInFailure, errorCodeForSignUpFailure, isLoginErrorCode, messageForLoginError } from "@/lib/auth/error-codes";

describe("auth error codes", () => {
  test("uses stable public codes for sign-in failures", () => {
    expect(errorCodeForSignInFailure()).toBe("invalid-credentials");
  });

  test("maps duplicate signup failures without exposing D1 helper text", () => {
    expect(errorCodeForSignUpFailure("An account already exists for this email.")).toBe("account-exists");
    expect(errorCodeForSignUpFailure("Unexpected D1 failure with internal details")).toBe("auth-error");
  });

  test("keeps login error messages on known public codes only", () => {
    expect(isLoginErrorCode("google-oauth-not-configured")).toBe(true);
    expect(isLoginErrorCode("bad()")).toBe(false);
    expect(messageForLoginError("auth-error")).toContain("We could not complete sign-in.");
    expect(messageForLoginError("bad()")).toBeNull();
  });
});
