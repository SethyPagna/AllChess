import { describe, expect, test } from "vitest";

import { errorCodeForSignInFailure, errorCodeForSignUpFailure } from "@/lib/auth/error-codes";

describe("auth error codes", () => {
  test("uses stable public codes for sign-in failures", () => {
    expect(errorCodeForSignInFailure()).toBe("invalid-credentials");
  });

  test("maps duplicate signup failures without exposing D1 helper text", () => {
    expect(errorCodeForSignUpFailure("An account already exists for this email.")).toBe("account-exists");
    expect(errorCodeForSignUpFailure("Unexpected D1 failure with internal details")).toBe("auth-error");
  });
});
