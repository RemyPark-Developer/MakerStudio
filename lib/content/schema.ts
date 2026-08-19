import { z } from "zod";

export const ContentModuleSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "id는 소문자/숫자/하이픈만 허용"),
  board: z.string().default("uno"),
  icon: z.string().optional(),
  label: z.object({ ko: z.string().min(1), en: z.string().optional() }),
  difficulty: z.number().int().min(1).max(5),
  estimatedMinutes: z.number().int().min(1),
  pin: z.string().optional(),
  intro: z.object({ ko: z.string().min(1), en: z.string().optional() }),
  parts: z.array(z.string()).min(1),
  circuit: z.object({
    type: z.string(),
    pins: z.record(z.string(), z.union([z.number(), z.string()])),
  }),
  code: z.string().min(1),
  explain: z.object({ ko: z.string().min(1), en: z.string().optional() }),
  mission: z.object({ ko: z.string().min(1), en: z.string().optional() }),
  quiz: z.object({
    question: z.object({ ko: z.string().min(1), en: z.string().optional() }),
    options: z.array(z.string()).min(2),
    answer: z.number().int().min(0),
    explain: z.object({ ko: z.string().min(1), en: z.string().optional() }),
  }),
  sourceExample: z.string().optional(),
});

export type ContentModuleDraft = z.infer<typeof ContentModuleSchema>;