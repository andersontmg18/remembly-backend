import { describe, expect, it } from "vitest";
import { registerUserSchema } from "../src/validators/user";

describe("registerUserSchema", () => {
  it("accepts first and last name for registration", () => {
    const result = registerUserSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      firstName: "Ada",
      lastName: "Lovelace",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.firstName).toBe("Ada");
      expect(result.data.lastName).toBe("Lovelace");
    }
  });
});
