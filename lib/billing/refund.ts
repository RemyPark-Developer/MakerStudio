/**
 * §4.5 계정삭제/구독해지 시 일할계산 환불액 계산.
 * 프로토타입 데모에서 검증했던 공식과 동일: 월구독료 × 잔여일수 / 전체주기일수
 * (예: ₩9,900 × 29/31 = ₩9,261)
 *
 * 순수 함수로 분리해서 결제 게이트웨이 연동 없이도 계산 로직 자체를 완전히 테스트할 수 있게 했다.
 */

export type RefundCalcInput = {
  monthlyAmount: number; // 원화, 정수
  periodStart: Date;
  periodEnd: Date;
  now: Date;
};

export type RefundCalcResult = {
  refundAmount: number; // 원화, 정수(원 단위 반올림)
  usedDays: number;
  totalDays: number;
  remainingDays: number;
};

export function calculateProratedRefund(input: RefundCalcInput): RefundCalcResult {
  const { monthlyAmount, periodStart, periodEnd, now } = input;

  if (monthlyAmount < 0) {
    throw new Error("monthlyAmount는 0 이상이어야 해요.");
  }
  if (periodEnd <= periodStart) {
    throw new Error("periodEnd는 periodStart보다 나중이어야 해요.");
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / msPerDay);

  // now가 주기 시작 전이면 0일 사용, 주기 끝 이후면 전체 사용으로 처리(환불 없음)
  const clampedNow = now < periodStart ? periodStart : now > periodEnd ? periodEnd : now;
  const usedDays = Math.round((clampedNow.getTime() - periodStart.getTime()) / msPerDay);
  const remainingDays = Math.max(0, totalDays - usedDays);

  const refundAmount = Math.round((monthlyAmount * remainingDays) / totalDays);

  return { refundAmount, usedDays, totalDays, remainingDays };
}

/**
 * 결제 시작일(periodStart)로부터 windowDays(기본 7일) 이내인지 — Family 요금제
 * "미사용 전액환불" 조건의 절반(나머지 절반은 이용 내역 확인, lib/billing/familyUsage.ts).
 * 2026-08-20 Family 환불 정책 확정으로 추가.
 */
export function isWithinFullRefundWindow(periodStart: Date, now: Date, windowDays = 7): boolean {
  const msPerDay = 1000 * 60 * 60 * 24;
  const elapsedDays = (now.getTime() - periodStart.getTime()) / msPerDay;
  return elapsedDays >= 0 && elapsedDays <= windowDays;
}
