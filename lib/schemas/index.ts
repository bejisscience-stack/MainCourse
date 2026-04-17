import { z } from "zod";

export const paymentOrderSchema = z.object({
  paymentType: z.enum([
    "course_enrollment",
    "project_subscription",
    "bundle_enrollment",
    "project_budget",
  ]),
  referenceId: z.string().uuid(),
  keepzMethod: z.string().optional(),
  saveCard: z.boolean().optional(),
  savedCardId: z.string().uuid().optional(),
});

export const enrollmentRequestSchema = z.object({
  courseId: z.string().uuid(),
  referralCode: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9]*$/)
    .optional()
    .nullable(),
  isReEnrollment: z.boolean().optional(),
  payment_method: z.enum(["keepz", "bank_transfer"]).optional(),
});

export const bundleEnrollmentRequestSchema = z.object({
  bundleId: z.string().uuid(),
  referralCode: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9]*$/)
    .optional()
    .nullable(),
  payment_method: z.enum(["keepz", "bank_transfer"]).optional(),
});

export const completeProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/),
  role: z.enum(["student", "lecturer"]),
});

export const scraperRunSchema = z.object({
  project_id: z.string().uuid().optional().nullable(),
});

export const profileUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/)
      .optional(),
    avatar_url: z
      .string()
      .regex(/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\//)
      .nullable()
      .optional(),
  })
  .refine(
    (data) => data.username !== undefined || data.avatar_url !== undefined,
    { message: "No fields to update" },
  );
