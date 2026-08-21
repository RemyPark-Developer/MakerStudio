/**
 * 해지 후 30일 데이터 보관 정책 — 준비 단계(스키마+계산 로직+수동 스크립트)만.
 * 실제 자동 삭제(cron)는 이번 범위 밖(2026-08-22, 0036_data_retention.sql).
 *
 * ⚠️ 이 정책(30일이라는 기간, 계산 기준, 관련 고지 문구)은 초안이며 실제 법률 검토가
 * 필요하다 — 확정된 정책으로 취급하지 말 것.
 *
 * 계산 기준은 canceled_at이 아니라 current_period_end(실제 접근이 끊기는 시점)다 —
 * §4.3 "해지해도 잔여기간까지는 이용 가능" 원칙과 일관되게, 해지 버튼을 누른 시점이
 * 아니라 실제로 서비스를 못 쓰게 되는 시점부터 30일 유예를 준다.
 */

export const RETENTION_DAYS = 30;

export function calculateRetentionUntil(currentPeriodEnd: Date): Date {
  const result = new Date(currentPeriodEnd);
  result.setDate(result.getDate() + RETENTION_DAYS);
  return result;
}

/**
 * "학습 데이터"의 범위 — Family 환불 정책(2026-08-20, lib/billing/familyUsage.ts)에서
 * 이미 "이용 내역"으로 확정한 5개 테이블 + VIP 멘토링(2026-08-21, vip_mentor_requests).
 * 같은 개념을 두 곳에서 다르게 정의하지 않기 위해 이 배열이 유일한 소스 — 파기 스크립트와
 * 문서가 전부 이걸 참조한다.
 *
 * userIdColumn: 이 테이블에서 사용자를 가리키는 컬럼명(테이블마다 user_id/child_id로
 * 이름이 다름 — checkFamilyGroupUsedInPeriod()에서 이미 확인된 사실).
 */
export const LEARNING_DATA_TABLES: { table: string; userIdColumn: string }[] = [
  { table: "learning_progress", userIdColumn: "user_id" },
  { table: "quiz_attempts", userIdColumn: "user_id" },
  { table: "tutor_messages", userIdColumn: "user_id" },
  { table: "progress", userIdColumn: "user_id" },
  { table: "saved_codes", userIdColumn: "user_id" },
  { table: "vip_mentor_requests", userIdColumn: "user_id" },
];
