/**
 * AI 튜터 사용량 제한 (design doc §4.2 "무료는 하루 N회, 유료는 무제한" 원칙의 실제 구현)
 *
 * ⚠️ 지금은 서버 메모리에 카운트를 저장하는 MVP 수준 구현입니다. 알려진 한계:
 *   1. 서버가 재시작되면(배포마다) 카운트가 초기화됩니다.
 *   2. 서버 인스턴스가 여러 대로 늘어나면(스케일 아웃) 인스턴스마다 카운트가 따로 돕니다.
 *   3. 지금은 로그인이 없어서 IP 주소로 사용자를 구분합니다 — 같은 학급/와이파이를 쓰는
 *      여러 학생이 같은 IP로 잡혀 서로의 사용량에 영향을 줄 수 있습니다.
 *
 * → Phase 3(로그인+DB, design doc §5.2)가 들어오면 반드시 다음으로 교체해야 합니다:
 *   - 카운트 키를 IP 대신 로그인된 user_id로 변경
 *   - 저장소를 메모리 대신 Redis(Upstash) 또는 Supabase 테이블로 변경
 * 지금 이 구현은 "AI 튜터가 완전히 무제한으로 새는" 심각한 문제를 막는 임시 안전장치입니다.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const FREE_DAILY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + DAY_MS };
    buckets.set(key, bucket);
  }

  if (bucket.count >= FREE_DAILY_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: FREE_DAILY_LIMIT - bucket.count,
    resetAt: bucket.resetAt,
  };
}

/** 테스트/디버그용 — 특정 키의 카운트를 초기화합니다. */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}
