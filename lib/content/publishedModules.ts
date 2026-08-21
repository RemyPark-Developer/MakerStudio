import { ExampleSchema, type Example } from "@/lib/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * content_modules 테이블의 한 행 (관리자 검수 파이프라인 산출물).
 * app/api/content/generate/route.ts가 upsert하는 컬럼과 1:1 대응.
 */
type ContentModuleRow = {
  id: string;
  board: string;
  icon: string | null;
  label_ko: string;
  difficulty: number;
  estimated_minutes: number;
  pin: string | null;
  intro_ko: string;
  parts: string[];
  code: string;
  explain_ko: string;
  mission_ko: string;
  quiz: {
    question?: { ko?: string };
    options?: string[];
    answer?: number;
    explain?: { ko?: string };
  } | null;
  source_example: string | null;
  is_premium: boolean;
};

/**
 * content_modules 행을 content/examples/*.json과 같은 Example 모양으로 변환한다.
 * is_premium은 관리자가 검수 승인 시점에 결정한 값을 그대로 반영한다(2026-08-21,
 * content_modules.is_premium 컬럼 추가 — 그 전엔 전부 false로 하드코딩돼 있었음).
 */
function mapRowToExample(row: ContentModuleRow): Example | null {
  const candidate = {
    id: row.id,
    icon: row.icon ?? "🔧",
    label: row.label_ko,
    board: row.board,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimated_minutes,
    pin: row.pin ?? "",
    intro: row.intro_ko,
    parts: row.parts ?? [],
    code: row.code,
    codeFilename: `${row.id}.ino`,
    explain: row.explain_ko,
    mission: row.mission_ko,
    quiz: {
      question: row.quiz?.question?.ko ?? "",
      options: row.quiz?.options ?? [],
      answer: row.quiz?.answer ?? 0,
      explain: row.quiz?.explain?.ko ?? "",
    },
    sourceExample: row.source_example ?? undefined,
    isPremium: row.is_premium,
  };

  const result = ExampleSchema.safeParse(candidate);
  if (!result.success) {
    console.error(`published content_modules 행 매핑 실패 (id=${row.id}):`, result.error.issues);
    return null;
  }
  return result.data;
}

/** 관리자가 승인(status='published')한 DB 콘텐츠 전체. 조회 실패 시 빈 배열(화면 전체를 막지 않음). */
export async function getPublishedModules(): Promise<Example[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("content_modules").select("*").eq("status", "published");

    if (error || !data) {
      if (error) console.error("getPublishedModules 조회 실패:", error);
      return [];
    }

    return data
      .map((row) => mapRowToExample(row as ContentModuleRow))
      .filter((e): e is Example => e !== null);
  } catch (err) {
    console.error("getPublishedModules 내부 오류:", err);
    return [];
  }
}

/** id로 published 상태의 DB 콘텐츠 하나를 조회한다. 없거나 실패하면 null. */
export async function getPublishedModuleById(id: string): Promise<Example | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_modules")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();

    if (error || !data) return null;
    return mapRowToExample(data as ContentModuleRow);
  } catch (err) {
    console.error("getPublishedModuleById 내부 오류:", err);
    return null;
  }
}
