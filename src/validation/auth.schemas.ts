import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z.object({
  fullName: z.string().min(1).max(200).trim(),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Username: letters, numbers, underscore only"),
  email: z.string().email().max(320).toLowerCase(),
  phone: z.string().max(40).optional().or(z.literal("")),
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().min(1).max(320),
  password: z.string().min(1).max(200),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(500),
});

export const forgotSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
});

export const adminPatchUserSchema = z.object({
  role: z.enum(["admin", "moderator", "validator", "standard", "support_agent"]).optional(),
  status: z.enum(["active", "suspended", "pending_verification"]).optional(),
});
