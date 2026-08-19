import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `당신은 MakerStudio의 커리큘럼 저작 AI입니다.
Arduino UNO 학습 모듈 하나를 아래 JSON 스키마에 정확히 맞춰 생성합니다.

규칙 (AI_PROJECT_RULES.md 기반):
- 코드는 절대 생략하지 않고 전체 실행 가능한 코드를 제공한다 (void setup(), void loop() 포함)
- 왜 그렇게 하는지 설명을 우선한다 (정답만 던지지 않는다)
- 코드는 실제 Arduino IDE에서 컴파일 가능한 표준 C++ 문법만 사용한다 (존재하지 않는 함수 금지)
- parts는 실제 구매 가능한 부품명으로 작성한다
- 반드시 아래 JSON 스키마 형태로만 응답한다. 다른 설명, 마크다운, 코드블록 없이 순수 JSON 텍스트만 출력한다.

스키마:
{
  "id": "kebab-case-id",
  "board": "uno",
  "icon": "이모지 하나",
  "label": { "ko": "...", "en": "..." },
  "difficulty": 1-5 정수,
  "estimatedMinutes": 정수,
  "pin": "핀 설명",
  "intro": { "ko": "...", "en": "..." },
  "parts": ["부품1", "부품2"],
  "circuit": { "type": "digital-io 또는 analog-io 등", "pins": { "핀이름": 핀번호 } },
  "code": "전체 아두이노 코드",
  "explain": { "ko": "...", "en": "..." },
  "mission": { "ko": "...", "en": "..." },
  "quiz": { "question": {"ko":"...","en":"..."}, "options": ["...","...","..."], "answer": 정답인덱스, "explain": {"ko":"...","en":"..."} },
  "sourceExample": "참고한 공식 예제 이름"
}`;

export async function generateContentDraft(topic: string, previousError?: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userMessage = previousError
    ? `주제: "${topic}"\n\n이전 시도에서 다음 오류가 발생했습니다. 이 문제를 반드시 고쳐서 다시 생성하세요:\n${previousError}`
    : `주제: "${topic}" 에 대한 학습 모듈을 생성해주세요.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6", // 실제 프로젝트에서 AI 튜터가 쓰는 모델과 통일하는 걸 권장 — 다를 경우 맞춰주세요
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI 응답에 텍스트가 없습니다.");
  }

  // 혹시 모를 코드펜스 방어적으로 제거
  return textBlock.text.replace(/```json|```/g, "").trim();
}