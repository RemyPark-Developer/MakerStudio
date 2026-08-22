/**
 * 초등학생 개인가입(보호자 SMS 인증) 핵심 로직.
 * 짝 문서: docs/MakerStudio_Auth_Flow_v1.2.md §2.3
 *
 * ⚠️ 이 파일이 CLAUDE.md의 "절대 원칙 4번"(서버가 반드시 재검증)의 실제 구현입니다.
 * 외부 I/O(실제 SMS 발송, Supabase 호출)와 분리해뒀습니다 — 그래야
 * 라이브 자격증명 없이도 이 핵심 규칙 자체를 단위 테스트할 수 있습니다.
 *
 * ⚠️ MVP 수준 구현: 인메모리 저장이라 서버 재시작하면 진행 중이던 인증이 초기화됩니다.
 * lib/rate-limit.ts와 같은 패턴 — Phase 3에서 DB(예: password_reset_tokens와 유사한
 * verify_tokens 테이블)로 전환해야 합니다.
 */

type PendingVerification = {
  nickname: string;
  guardianPhone: string;
  smsCode: string;
  expiresAt: number;
};

const pending = new Map<string, PendingVerification>();
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10분 (Auth_Flow.md §2.3-3)

function randomToken(): string {
  return crypto.randomUUID();
}

function randomSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function startChildSignup(
  nickname: string,
  guardianPhone: string
): { verifyToken: string; smsCode: string } {
  const verifyToken = randomToken();
  const smsCode = randomSixDigitCode();
  pending.set(verifyToken, {
    nickname,
    guardianPhone,
    smsCode,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  // smsCode는 호출부가 실제 SMS 발송에 쓰고, 응답으로는 절대 내려보내지 않을 것.
  return { verifyToken, smsCode };
}

export type VerifyResult =
  | { ok: true; nickname: string; guardianPhone: string }
  | { ok: false; status: 403; reason: "consent_required" }
  | { ok: false; status: 401; reason: "invalid_or_expired_token" }
  | { ok: false; status: 401; reason: "code_mismatch" };

/**
 * §2.3-7의 필수 검증 지점.
 * agreeChildPrivacy를 클라이언트가 뭐라고 보냈든, 여기서 다시 확인합니다.
 */
export function verifyChildSignup(input: {
  verifyToken: string;
  smsCode: string;
  agreeChildPrivacy: boolean;
}): VerifyResult {
  // 순서 중요: 동의 여부를 코드 확인보다 먼저 본다 —
  // 동의 안 했으면 코드가 맞아도 절대 진행하지 않는다는 걸 명확히 하기 위함.
  if (input.agreeChildPrivacy !== true) {
    return { ok: false, status: 403, reason: "consent_required" };
  }

  const record = pending.get(input.verifyToken);
  if (!record || record.expiresAt < Date.now()) {
    return { ok: false, status: 401, reason: "invalid_or_expired_token" };
  }

  if (record.smsCode !== input.smsCode) {
    return { ok: false, status: 401, reason: "code_mismatch" };
  }

  pending.delete(input.verifyToken); // 1회용 — 재사용 방지
  return { ok: true, nickname: record.nickname, guardianPhone: record.guardianPhone };
}

/** 테스트/디버그용 */
export function _resetPendingForTest() {
  pending.clear();
}
export function _getPendingCodeForTest(verifyToken: string): string | undefined {
  return pending.get(verifyToken)?.smsCode;
}
