import { z } from "zod";
export const thesisSchema = z.object({
  title: z.string().trim().min(10).max(300),
  abstract: z.string().trim().min(80).max(10000),
  keywords: z.string().max(300),
  faculty_id: z.uuid(),
  department_id: z.uuid(),
  academic_year: z.coerce
    .number()
    .int()
    .min(1990)
    .max(new Date().getFullYear() + 1),
  supervisor_id: z.union([z.uuid(), z.literal("")]).optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).default("DRAFT"),
  version_of: z.union([z.uuid(), z.literal("")]).optional(),
});
export const settingsSchema = z
  .object({
    similarity_warning_threshold: z.coerce.number().int().min(0).max(99),
    similarity_high_threshold: z.coerce.number().int().min(1).max(100),
    maximum_file_size: z.coerce.number().int().min(1).max(20),
    maximum_daily_scans: z.coerce.number().int().min(1).max(100),
    allow_student_resubmission: z.boolean(),
    external_search_enabled: z.boolean(),
    academic_search_enabled: z.boolean(),
  })
  .refine((x) => x.similarity_high_threshold > x.similarity_warning_threshold, {
    message: "High threshold must exceed warning threshold.",
  });
export const reviewSchema = z.object({
  decision: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  comment: z.string().trim().min(5).max(5000),
});
export const registerSchema = z
  .object({
    full_name: z.string().trim().min(3).max(100),
    email: z.email(),
    password: z.string().min(10).max(128),
    confirmPassword: z.string(),
    matric_number: z.string().trim().min(3).max(40),
    faculty_id: z.uuid(),
    department_id: z.uuid(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match.",
  });
