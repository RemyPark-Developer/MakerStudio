import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function getClientKey(req: NextRequest): string {
  // TODO(Phase 3): 로그인 붙으면 IP 대신 인증된 user_id로 교체할 것 (lib/rate-limit.ts 상단 주석 참고)
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rl = checkRateLimit(clientKey);

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "오늘의 무료 AI 튜터 질문 횟수(10회)를 다 썼어요. Premium은 무제한이에요.",
        resetAt: rl.resetAt,
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const question: string | undefined = body?.question;
  const exampleLabel: string = body?.exampleLabel ?? "예제";
  const stepName: string = body?.stepName ?? "학습 중";

  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "bad_request", message: "질문(question)이 필요해요." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // 키가 없어도 서버가 죽지 않고 명확한 에러를 반환합니다 (개발 환경 배려).
    return NextResponse.json(
      {
        error: "server_misconfigured",
        message: "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요. .env.local을 확인해주세요.",
      },
      { status: 500 }
    );
  }

  const systemPrompt = `당신은 초중고생 및 입문자를 가르치는 MakerStudio의 Arduino AI 튜터입니다.
현재 학습자는 "${exampleLabel}" 예제를 배우고 있고, 현재 단계는 "${stepName}" 입니다.
규칙:
- 정답을 곧바로 다 알려주지 말고, 왜 그런지 원리를 설명하고 단계별로 안내하세요.
- 학습자가 직접 생각해볼 수 있도록 힌트를 우선 제공하세요.
- 흔한 실수의 원인을 짚어주세요.
- 답변은 한국어로, 3~5문장 이내로 간결하게 하세요.
- 초보자도 이해할 수 있는 쉬운 표현을 쓰세요.`;

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
        messages: [{ role: "user", content: question }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: "upstream_error", message: "AI 튜터 응답을 가져오지 못했어요. 잠시 후 다시 시도해주세요." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const textBlocks = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text);
    const answer = textBlocks.join("\n").trim() || "죄송해요, 답변을 생성하지 못했어요.";

    return NextResponse.json({ answer, remaining: rl.remaining });
  } catch (err) {
    console.error("Tutor route error:", err);
    return NextResponse.json(
      { error: "network_error", message: "AI 튜터 연결에 문제가 있어요. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }
}
