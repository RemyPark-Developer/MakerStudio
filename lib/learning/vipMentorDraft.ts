import Anthropic from "@anthropic-ai/sdk";

/**
 * Premium VIP 멘토링의 AI "초안" 생성 — 절대 학생/보호자에게 직접 나가지 않는다.
 * app/api/learning/vip/admin/[id]/approve-and-send/route.ts에서 관리자가 검토·수정한
 * 뒤에만 최종 발송된다(0035 설계 원칙, 표시광고법 허위광고 리스크 방지).
 *
 * lib/content/generate-draft.ts와 동일한 SDK 클라이언트 패턴 재사용, 모델도 통일.
 */
const SYSTEM_PROMPT = `당신은 MakerStudio Premium VIP 멘토링의 AI 초안 작성 도우미입니다.
초중고생이 제출한 Arduino/코딩 프로젝트에 대해 멘토 피드백 초안을 작성합니다.

규칙:
- 잘한 점을 먼저 구체적으로 짚어주고, 개선하면 좋을 점을 이어서 제시하세요.
- 코드가 포함되어 있으면 실제 동작 원리·잠재적 버그·더 나은 관례(네이밍, 구조 등)를 짚으세요.
- 정답만 알려주지 말고 "왜 그런지"와 "다음에 시도해볼 만한 방향"을 함께 제시하세요.
- 학생을 존중하는 격려하는 어조를 쓰되, 과장된 칭찬만 늘어놓지 마세요.
- 한국어로, 3~6문단 정도로 작성하세요.
- 이 텍스트는 초안입니다 — 사람 검토자가 반드시 수정할 수 있으니, 애매하면 추측보다는
  "제출물에서 확인이 필요해 보이는 부분"으로 명확히 표시하세요.`;

export async function generateVipDraftFeedback(submissionContent: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: submissionContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI 응답에 텍스트가 없습니다.");
  }

  return textBlock.text.trim();
}
