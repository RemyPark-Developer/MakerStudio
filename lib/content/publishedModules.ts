import { ExampleSchema, type Example } from "@/lib/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * content_modules 테이블의 한 행 (관리자 검수 파이프라인 산출물).
 * app/api/content/generate/route.ts가 upsert하는 컬럼과 1:1 대응.
 */
type ContentModuleRow = {
  id: string;
  slug: string;
  version: number;
  updated_at: string;
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
    // slug를 외부 식별자로 노출한다 — 버전이 바뀌어도(row.id가 'slug-v2'로 바뀌어도)
    // URL과 학습 진도는 항상 이 값을 기준으로 삼는다(§6.3-a).
    id: row.slug,
    icon: row.icon ?? "🔧",
    label: row.label_ko,
    board: row.board,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimated_minutes,
    pin: row.pin ?? "",
    intro: row.intro_ko,
    parts: row.parts ?? [],
    code: row.code,
    codeFilename: `${row.slug}.ino`,
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

/**
 * 관리자가 승인(status='published')한 DB 콘텐츠 전체 — **슬러그당 최신 버전만** 반환한다.
 * 카탈로그는 항상 신규 학습자 기준(§6.3-a) — 조회 실패 시 빈 배열(화면 전체를 막지 않음).
 */
export async function getPublishedModules(): Promise<Example[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("content_modules").select("*").eq("status", "published");

    if (error || !data) {
      if (error) console.error("getPublishedModules 조회 실패:", error);
      return [];
    }

    const rows = data as ContentModuleRow[];
    const latestBySlug = new Map<string, ContentModuleRow>();
    for (const row of rows) {
      const current = latestBySlug.get(row.slug);
      if (!current || row.version > current.version) latestBySlug.set(row.slug, row);
    }

    return [...latestBySlug.values()]
      .map((row) => mapRowToExample(row))
      .filter((e): e is Example => e !== null);
  } catch (err) {
    console.error("getPublishedModules 내부 오류:", err);
    return [];
  }
}

/** 특정 슬러그의 published 행 전부, 버전 내림차순(최신이 [0]). 없으면 빈 배열. */
async function getPublishedModuleVersionsBySlug(slug: string): Promise<ContentModuleRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_modules")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .order("version", { ascending: false });

  if (error || !data) return [];
  return data as ContentModuleRow[];
}

/**
 * §6.3-a 정책의 실제 판정 지점 — 슬러그로 DB 콘텐츠 하나를 조회하되, 어느 버전을 보여줄지는
 * 요청 사용자의 학습 여부에 따라 갈린다.
 *
 * - 비로그인 또는 진도 기록이 아예 없는 사용자(신규 학습자) → 항상 최신 버전.
 * - `learning_progress`에 이 슬러그로 된 행이 있는 사용자(이미 학습 중) → 그 진도가
 *   시작된 시점(`started_at`)에 이미 published였던 버전 중 가장 높은 버전으로 고정
 *   (App Store 업데이트 방식 — 자동 전환 없음). `content_modules.updated_at`을 "언제
 *   published로 승인됐는가"의 대리 지표로 쓴다 — 이 저장소엔 승인 후 재수정 기능이 없어서
 *   지금은 항상 성립하는 전제다(나중에 편집 기능이 생기면 재검토 필요, Project_Design §6.3-a 참고).
 */
export async function getPublishedModuleForUser(
  slug: string,
  userId: string | null
): Promise<Example | null> {
  try {
    const versions = await getPublishedModuleVersionsBySlug(slug);
    if (versions.length === 0) return null;

    const latest = versions[0];
    if (!userId) return mapRowToExample(latest);

    const supabase = getSupabaseServerClient();
    const { data: progress } = await supabase
      .from("learning_progress")
      .select("started_at")
      .eq("user_id", userId)
      .eq("module_id", slug)
      .maybeSingle();

    if (!progress) return mapRowToExample(latest); // 신규 학습자 → 최신 버전

    const pinned =
      versions.find((v) => v.updated_at <= progress.started_at) ?? versions[versions.length - 1];
    return mapRowToExample(pinned);
  } catch (err) {
    console.error("getPublishedModuleForUser 내부 오류:", err);
    return null;
  }
}
