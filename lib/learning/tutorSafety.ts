/**
 * AI 튜터(app/api/tutor/route.ts)에 들어오는/나가는 텍스트에 대한 최소 안전 필터.
 * "완벽한 콘텐츠 모더레이션"이 아니라 "아동이 안전하게 AI 튜터를 쓸 수 있는 최소
 * 안전장치"가 목표다(2026-08-20 설계 결정) — 정교한 우회(초성 분리, leetspeak) 방어나
 * 주소 같은 자유형식 PII 감지는 이번 범위에서 의도적으로 제외했다.
 */

export type SafetyCheckResult =
  | { ok: true }
  | { ok: false; reason: "profanity" | "pii"; redactedText: string };

// 흔한 한국어 욕설 소규모 목록. 완전한 목록이 아니며, 회피 수법(초성 분리 등) 방어도 없다.
const BANNED_WORDS = [
  "씨발",
  "씨팔",
  "시발",
  "개새끼",
  "개새기",
  "병신",
  "지랄",
  "좆",
  "존나",
  "존니",
  "미친놈",
  "미친년",
  "닥쳐",
  "꺼져",
  "걸레",
  "썅",
];

// 휴대폰번호 (010-1234-5678, 01012345678 등)
const PHONE_REGEX = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g;
// 주민등록번호 (123456-1234567, 1234561234567)
const RESIDENT_ID_REGEX = /\d{6}[-\s]?[1-4]\d{6}/g;

function normalize(text: string): string {
  return text.replace(/\s+/g, "");
}

function findBannedWord(text: string): string | null {
  const normalized = normalize(text);
  return BANNED_WORDS.find((word) => normalized.includes(word)) ?? null;
}

function redactProfanity(text: string): string {
  let result = text;
  for (const word of BANNED_WORDS) {
    result = result.split(word).join("*".repeat(word.length));
  }
  return result;
}

/** PII 패턴이 있으면 치환된 텍스트를, 없으면 null을 반환한다. 입력/출력 양쪽에서 재사용. */
export function redactPii(text: string): string | null {
  let found = false;
  let result = text.replace(PHONE_REGEX, () => {
    found = true;
    return "●●●●●●●●●●●●";
  });
  result = result.replace(RESIDENT_ID_REGEX, () => {
    found = true;
    return "●●●●●●●●●●●●●";
  });
  return found ? result : null;
}

/**
 * 아이가 입력한 질문(question)을 Anthropic에 보내기 전에 통과시킨다.
 * 욕설이 있으면 profanity, 개인정보(휴대폰번호/주민등록번호)가 있으면 pii로 막는다.
 * 주제 이탈은 여기서 걸러내지 않는다 — 시스템 프롬프트 지시에 맡긴다(설계 문서 참고).
 */
export function checkInputSafety(text: string): SafetyCheckResult {
  const bannedWord = findBannedWord(text);
  if (bannedWord) {
    return { ok: false, reason: "profanity", redactedText: redactProfanity(text) };
  }

  const piiRedacted = redactPii(text);
  if (piiRedacted !== null) {
    return { ok: false, reason: "pii", redactedText: piiRedacted };
  }

  return { ok: true };
}
