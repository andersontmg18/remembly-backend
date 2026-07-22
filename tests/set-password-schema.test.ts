import { describe, expect, it } from "vitest";
import { setPasswordSchema } from "../src/validators/user";

describe("setPasswordSchema", () => {
  it("accepts a strong password for a Google-only account", () => {
    const result = setPasswordSchema.safeParse({
      password: "StrongPassword123",
      confirmPassword: "StrongPassword123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects mismatched confirmation passwords", () => {
    const result = setPasswordSchema.safeParse({
      password: "StrongPassword123",
      confirmPassword: "DifferentPassword123",
    });

    expect(result.success).toBe(false);
  });
});
