import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "../src/validators/user";

describe("changePasswordSchema", () => {
  it("accepts a current password and a matching replacement password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpassword123",
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.newPassword).toBe("newpassword123");
    }
  });

  it("rejects mismatched new passwords", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpassword123",
      newPassword: "newpassword123",
      confirmPassword: "differentpassword123",
    });

    expect(result.success).toBe(false);
  });
});
