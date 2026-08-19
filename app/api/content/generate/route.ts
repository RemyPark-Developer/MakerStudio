import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { generateContentDraft } from "@/lib/content/generate-draft";
import { ContentModuleSchema } from "@/lib/content/schema";
import { validateArduinoCompile } from "@/lib/content/validate-arduino";

const MAX_RETRIES = 3;

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const topic: string | undefined = body?.topic;
  const board: string = body?.board ?? "uno";

  if (!topic) {
    return NextResponse.json({ error: "invalid_request", message: "topic이 필요해요." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  let lastError: string | undefined;
  let attempt = 0;
  let parsed: any = null;
  let moduleId: string | null = null;

  while (attempt < MAX_RETRIES) {
    attempt++;

    // 1) AI 생성
    let raw: string;
    try {
      raw = await generateContentDraft(topic, lastError);
    } catch (err: any) {
      lastError = `AI 생성 실패: ${err.message}`;
      await logAttempt(supabase, moduleId ?? `topic:${topic}`, attempt, "ai_generate", false, lastError);
      continue;
    }

    // 2) JSON 파싱 + 스키마 검증
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      lastError = `AI가 유효한 JSON을 반환하지 않았습니다. 원본 앞부분: ${raw.slice(0, 300)}`;
      await logAttempt(supabase, moduleId ?? `topic:${topic}`, attempt, "schema_validate", false, lastError);
      continue;
    }

    const result = ContentModuleSchema.safeParse(json);
    if (!result.success) {
      lastError = `스키마 검증 실패: ${JSON.stringify(result.error.flatten())}`;
      moduleId = json?.id ?? moduleId;
      await logAttempt(supabase, moduleId ?? `topic:${topic}`, attempt, "schema_validate", false, lastError);
      continue;
    }

    parsed = result.data;
    moduleId = parsed.id;
    const currentModuleId: string = parsed.id; // 이 시점부터는 확실히 string (null 아님)
    await logAttempt(supabase, currentModuleId, attempt, "schema_validate", true, "ok");

    // 3) 실제 컴파일 검증
    const compileResult = await validateArduinoCompile(currentModuleId, parsed.code);
    await logAttempt(supabase, currentModuleId, attempt, "compile_validate", compileResult.passed, compileResult.detail);

    if (compileResult.passed) {
      // 통과 → DB에 PENDING_REVIEW로 저장
      const { error: upsertError } = await supabase.from("content_modules").upsert({
        id: parsed.id,
        board,
        icon: parsed.icon,
        label_ko: parsed.label.ko,
        label_en: parsed.label.en,
        difficulty: parsed.difficulty,
        estimated_minutes: parsed.estimatedMinutes,
        pin: parsed.pin,
        intro_ko: parsed.intro.ko,
        intro_en: parsed.intro.en,
        parts: parsed.parts,
        circuit: parsed.circuit,
        code: parsed.code,
        explain_ko: parsed.explain.ko,
        explain_en: parsed.explain.en,
        mission_ko: parsed.mission.ko,
        mission_en: parsed.mission.en,
        quiz: parsed.quiz,
        source_example: parsed.sourceExample,
        status: "pending_review",
        retry_count: attempt,
        last_error: null,
        last_verified_at: new Date().toISOString(),
        created_by: user.id,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        return NextResponse.json({ error: "server_error", message: "DB 저장 실패: " + upsertError.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        status: "pending_review",
        moduleId: parsed.id,
        attempts: attempt,
      });
    }

    lastError = `컴파일 실패: ${compileResult.detail}`;
  }

  // MAX_RETRIES 다 소진 → automation_stuck
  if (moduleId && parsed) {
    await supabase.from("content_modules").upsert({
      id: moduleId,
      board,
      label_ko: parsed?.label?.ko ?? topic,
      code: parsed?.code ?? "",
      status: "automation_stuck",
      retry_count: attempt,
      last_error: lastError,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    { ok: false, status: "automation_stuck", error: lastError, attempts: attempt },
    { status: 422 }
  );
});

async function logAttempt(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  moduleId: string,
  attemptNumber: number,
  stage: "ai_generate" | "schema_validate" | "compile_validate",
  passed: boolean,
  detail: string
) {
  // content_modules에 아직 행이 없는 초기 실패 케이스는 FK 제약 때문에 로그를 못 남길 수 있어
  // 실패해도 조용히 넘어가도록 처리 (로그는 best-effort)
    async function logAttempt(
    supabase: ReturnType<typeof getSupabaseServerClient>,
    moduleId: string,
    attemptNumber: number,
    stage: "ai_generate" | "schema_validate" | "compile_validate",
    passed: boolean,
    detail: string
    ) {
    try {
        await supabase.from("content_generation_log").insert({
        module_id: moduleId,
        attempt_number: attemptNumber,
        stage,
        passed,
        detail: detail.slice(0, 2000),
        });
    } catch {
        // 로그는 best-effort — 실패해도 본 파이프라인 흐름은 막지 않는다
    }
    }
}