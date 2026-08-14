import { z } from "zod";

/**
 * 콘텐츠 스키마 (MakerStudio_Project_Design_v2.md §6.2 기준)
 * content/examples/*.json 이 이 스키마를 통과해야만 사이트에 노출됩니다.
 * 새 예제를 추가하려면: 이 스키마에 맞는 JSON 파일 하나를
 * content/examples/ 에 추가하기만 하면 됩니다 (코드 수정 불필요).
 */
export const QuizSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  answer: z.number().int().nonnegative(),
  explain: z.string().min(1),
});

export const ExampleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id는 소문자/숫자/하이픈만 사용"),
  icon: z.string().min(1),
  label: z.string().min(1),
  board: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  estimatedMinutes: z.number().int().positive(),
  pin: z.string().min(1),
  intro: z.string().min(1),
  parts: z.array(z.string().min(1)).min(1),
  code: z.string().min(1),
  codeFilename: z.string().min(1),
  explain: z.string().min(1),
  mission: z.string().min(1),
  quiz: QuizSchema,
  sourceExample: z
    .string()
    .optional()
    .describe("이 모듈의 코드가 어느 공식 예제에서 왔는지 (§6.5 소싱 전략)"),
  isPremium: z
    .boolean()
    .default(false)
    .describe(
      "true면 code/explain은 구독자에게만 서버가 내려줌 (Design.md §7.2, 절대 SSG 금지)"
    ),
});

export type Example = z.infer<typeof ExampleSchema>;

/** §6.5 의 course(코스) 스키마 — 여러 모듈을 순서대로 묶는 목차 */
export const CourseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.literal("course"),
  label: z.string().min(1),
  kitSku: z.string().min(1),
  modules: z.array(z.string()).min(1),
  finalProject: z.string().optional(),
});

export type Course = z.infer<typeof CourseSchema>;
