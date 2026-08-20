/**
 * Family 요금제 재결제 시 seat_limit이 3으로 리셋됐는데 현재 멤버가 더 많으면
 * (좌석 추가로 4명 이상이었던 상태) 누구를 뺄지 정하는 순수 함수.
 *
 * 가장 최근에 추가된 아이부터 뺀다 — 원래 기본 3자리는 유지하고, 좌석 추가로
 * 들어온 "보너스" 자리부터 빠지는 게 guardian 입장에서 가장 직관적이다
 * (2026-08-20 좌석 추가/다운그레이드 설계).
 */
export function selectMembersToRemove(
  members: { childId: string; addedAt: string }[],
  newLimit: number
): string[] {
  if (members.length <= newLimit) return [];

  const overflowCount = members.length - newLimit;
  const sortedByNewestFirst = [...members].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  );

  return sortedByNewestFirst.slice(0, overflowCount).map((m) => m.childId);
}
