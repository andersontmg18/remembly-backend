import { z } from "zod";

export const registerUserSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(2, "First name must be at least 2 characters").trim(),
  lastName: z.string().min(2, "Last name must be at least 2 characters").trim(),
});

export type RegisterUserRequest = z.infer<typeof registerUserSchema>;

export const loginUserSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type LoginUserRequest = z.infer<typeof loginUserSchema>;

export const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password confirmation must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type SetPasswordRequest = z.infer<typeof setPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password confirmation must be at least 8 characters"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export const userResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  isEmailVerified: z.boolean(),
  role: z.enum(["USER", "ADMIN"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
