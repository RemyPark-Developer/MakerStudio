/**
 * 해지 후 30일 데이터 보관 정책 — 파기 스크립트 (준비 단계, 2026-08-22 0036).
 *
 * ⚠️ 이 스크립트는 아직 어떤 스케줄러(cron)에도 연결되어 있지 않다. 관리자가 직접
 * 실행해야만 동작한다 — 그냥 두면 아무 일도 일어나지 않는다. cron 인프라가 결정되면
 * 이 파일 경로를 그대로 스케줄링에 연결하면 된다.
 *
 * ⚠️ 이 정책(30일 기간, 계산 기준, 관련 고지 문구)은 초안이며 실제 법률 검토가 필요하다.
 *
 * 사용법:
 *   node --env-file=.env.local --import tsx scripts/purge-expired-data.ts           # dry-run(기본, 아무것도 안 지움)
 *   node --env-file=.env.local --import tsx scripts/purge-expired-data.ts --confirm # 실제 삭제
 *
 * 동작:
 *   1) subscriptions/family_groups에서 data_retention_until이 지난 행을 찾는다.
 *   2) 각 대상 아이가 "지금" 다른 경로로 활성 접근권이 있는지 재확인한다(안전장치 —
 *      예: Family는 해지했지만 개인 Premium/VIP가 별도로 살아있는 경우 등). 있으면 제외.
 *   3) 최종 확정된 아이들의 학습 데이터(lib/billing/dataRetention.ts의
 *      LEARNING_DATA_TABLES 6개 테이블)를 삭제한다.
 *   4) --confirm 없이 실행하면 위 1~2단계 결과만 콘솔에 출력하고 아무것도 안 지운다.
 */
import { getSupabaseServerClient } from "../lib/supabase/server";
import { hasPremiumAccess } from "../lib/content/gate";
import { LEARNING_DATA_TABLES } from "../lib/billing/dataRetention";
import type { AuthedUser } from "../lib/supabase/auth-context";

const CONFIRM = process.argv.includes("--confirm");

function asStudentUser(childId: string): AuthedUser {
  // hasPremiumAccess()는 user.id만 실제로 사용한다 — 나머지 필드는 타입을 맞추기 위한 최소값.
  return { id: childId, email: null, role: "student_child", nickname: null };
}

async function main() {
  const supabase = getSupabaseServerClient();

  const [{ data: expiredSubs, error: subsError }, { data: expiredGroups, error: groupsError }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, child_id, data_retention_until")
      .eq("status", "canceled")
      .not("data_retention_until", "is", null)
      .lt("data_retention_until", new Date().toISOString()),
    supabase
      .from("family_groups")
      .select("id, data_retention_until")
      .eq("status", "canceled")
      .not("data_retention_until", "is", null)
      .lt("data_retention_until", new Date().toISOString()),
  ]);

  if (subsError || groupsError) {
    console.error("대상 조회 실패:", subsError ?? groupsError);
    process.exit(1);
  }

  // 후보 아이 id 목록 — 개인 구독 대상 + Family 그룹 대상(그룹 안 모든 멤버)을 합친다.
  const candidateChildIds = new Set<string>();
  for (const sub of expiredSubs ?? []) candidateChildIds.add(sub.child_id);

  for (const group of expiredGroups ?? []) {
    const { data: members } = await supabase
      .from("family_group_members")
      .select("child_id")
      .eq("family_group_id", group.id);
    for (const m of members ?? []) candidateChildIds.add(m.child_id);
  }

  console.log(`후보(보관 기한 지남): 개인 구독 ${expiredSubs?.length ?? 0}건, Family 그룹 ${expiredGroups?.length ?? 0}건 → 아이 ${candidateChildIds.size}명`);

  // 안전장치 — 각 후보가 "지금" 다른 경로로 활성 접근권이 있는지 재확인(있으면 제외).
  const toPurge: string[] = [];
  const skipped: string[] = [];
  for (const childId of candidateChildIds) {
    const stillHasAccess = await hasPremiumAccess(asStudentUser(childId));
    if (stillHasAccess) skipped.push(childId);
    else toPurge.push(childId);
  }

  if (skipped.length > 0) {
    console.log(`제외됨(다른 경로로 아직 접근권 있음): ${skipped.length}명`, skipped);
  }
  console.log(`최종 파기 대상: ${toPurge.length}명`, toPurge);

  if (toPurge.length === 0) {
    console.log("파기 대상 없음 — 종료.");
    return;
  }

  if (!CONFIRM) {
    console.log("\n(dry-run) --confirm 없이 실행해서 아무것도 지우지 않았어요. 실제 삭제하려면 --confirm을 붙여서 다시 실행하세요.");
    return;
  }

  for (const { table, userIdColumn } of LEARNING_DATA_TABLES) {
    const { error, count } = await supabase.from(table).delete({ count: "exact" }).in(userIdColumn, toPurge);
    if (error) {
      console.error(`${table} 삭제 실패:`, error.message);
    } else {
      console.log(`${table}: ${count ?? 0}건 삭제`);
    }
  }

  console.log("\n파기 완료.");
}

main().catch((err) => {
  console.error("스크립트 실행 중 오류:", err);
  process.exit(1);
});
