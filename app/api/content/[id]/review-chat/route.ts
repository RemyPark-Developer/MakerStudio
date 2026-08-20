import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { checkReviewChatUsage } from "@/lib/rate-limit-db";

export const GET = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("content_review_messages")
    .select("id, role, content, created_at")
    .eq("module_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "대화 기록을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
});

export const POST = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const question: string | undefined = body?.question;

  if (!question) {
    return NextResponse.json({ error: "invalid_request", message: "question이 필요해요." }, { status: 400 });
  }

  const rl = await checkReviewChatUsage(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "오늘의 검수 AI 질문 횟수(50회)를 다 썼어요. 내일 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfigured", message: "ANTHROPIC_API_KEY가 설정되지 않았어요." },
      { status: 500 }
    );
  }

  const supabase = getSupabaseServerClient();

  // 검수 대상 콘텐츠 전체를 컨텍스트로 불러온다
  const { data: module, error: moduleError } = await supabase
    .from("content_modules")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (moduleError || !module) {
    return NextResponse.json({ error: "not_found", message: "콘텐츠를 찾을 수 없어요." }, { status: 404 });
  }

  // 이전 대화 맥락도 같이 불러온다 (연속 대화가 되도록)
  const { data: history } = await supabase
    .from("content_review_messages")
    .select("role, content")
    .eq("module_id", id)
    .order("created_at", { ascending: true })
    .limit(20);

  const systemPrompt = `당신은 MakerStudio 커리큘럼 관리자의 검수를 돕는 AI 어시스턴트입니다.
아래는 검수 대상 학습 모듈의 전체 데이터입니다:

제목: ${module.label_ko}
난이도: ${module.difficulty}
소요시간: ${module.estimated_minutes}분
준비물: ${JSON.stringify(module.parts)}
회로: ${JSON.stringify(module.circuit)}
소개: ${module.intro_ko}
코드:
\`\`\`
${module.code}
\`\`\`
설명: ${module.explain_ko}
미션: ${module.mission_ko}
퀴즈: ${JSON.stringify(module.quiz)}

관리자의 질문에 대해, 이 콘텐츠의 정확성(핀 배정, 코드 로직, 난이도 적절성, 초보자 이해도 등)을 기준으로
객관적이고 구체적으로 답변하세요. 문제가 있다면 명확히 지적하고, 없다면 그것도 명확히 말해주세요.
답변은 한국어로, 간결하게 하세요.`;

  const messages = [
    ...(history ?? []).map((m) => ({
      role: m.role === "admin" ? "user" : "assistant",
      content: m.content,
    })),
    { role: "user", content: question },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return NextResponse.json({ error: "upstream_error", message: "AI 응답을 가져오지 못했어요." }, { status: 502 });
    }

    const data = await response.json();
    const textBlocks = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text);
    const answer = textBlocks.join("\n").trim() || "답변을 생성하지 못했어요.";

    await supabase.from("content_review_messages").insert([
      { module_id: id, admin_id: user.id, role: "admin", content: question },
      { module_id: id, admin_id: user.id, role: "assistant", content: answer },
    ]);

    return NextResponse.json({ answer, remaining: rl.remaining });
  } catch (err) {
    console.error("Review chat error:", err);
    return NextResponse.json({ error: "network_error", message: "AI 연결에 문제가 있어요." }, { status: 502 });
  }
});