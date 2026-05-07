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
  marketingEmailsConsent: z.boolean().optional().default(false),
});

const multilingualTextSchema = z.object({
  en: z.string().optional(),
  ge: z.string().optional(),
});

export const adminNotificationSendSchema = z.object({
  target_type: z.enum(["all", "role", "course", "specific"]).optional(),
  target_role: z.enum(["student", "lecturer", "admin"]).optional(),
  target_course_id: z.string().uuid().optional(),
  target_user_ids: z.array(z.string()).optional(),
  title: multilingualTextSchema,
  message: multilingualTextSchema.optional(),
  message_html: multilingualTextSchema.optional(),
  channel: z.enum(["in_app", "email", "both"]).optional(),
  language: z.enum(["en", "ge", "both"]).optional(),
  email_target: z
    .enum(["profiles", "coming_soon", "both", "specific"])
    .optional(),
  target_emails: z.array(z.string()).optional(),
  category: z
    .enum([
      "marketing",
      "transactional_security",
      "transactional_terms",
      "transactional_account",
    ])
    .optional(),
});

export const adminPaymentsActionSchema = z.object({
  paymentId: z.string().uuid(),
  action: z.literal("complete"),
});
