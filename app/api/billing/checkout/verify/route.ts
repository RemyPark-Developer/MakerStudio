import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian } from "@/lib/supabase/auth-context";
import { verifyPayment } from "@/lib/billing/portone";
import { getPlanPrice } from "@/lib/billing/plans";
import { activateSubscription } from "@/lib/billing/activateSubscription";
import { activateFamilyGroup } from "@/lib/billing/activateFamilyGroup";
import { activateFamilySeatAddon } from "@/lib/billing/activateFamilySeatAddon";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * 브라우저에서 PortOne.requestPayment()가 끝난 뒤, 그 결과(paymentId)를 가지고
 * 이 라우트를 호출한다. 여기서 절대 클라이언트가 보낸 금액을 그대로 믿지 않고,
 * 포트원 서버에서 실제 결제 정보를 다시 조회해서 금액이 일치하는지 확인한다.
 *
 * ⚠️ 이 라우트만으로는 안정적이지 않다 — 브라우저가 결제 도중 닫히면 이 호출 자체가
 * 안 일어날 수 있다. 그래서 실제 운영에서는 웹훅(webhook/portone/route.ts)이 최종
 * 진실 공급원이고, 이 라우트는 "결제 직후 화면을 빠르게 갱신하기 위한" 보조 역할이다.
 * 구독 활성화 로직은 lib/billing/activateSubscription.ts로 공유해서, 이 라우트와
 * 웹훅이 같은 결제를 중복 처리하지 않도록(멱등성) 했다.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardian(user)) {
    return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const paymentId: string | undefined = body?.paymentId;
  const childId: string | undefined = body?.childId;
  const planId: string | undefined = body?.planId;
  const isFamily = planId === "family";
  const isSeatAddon = planId === "family_extra_seat";

  if (!paymentId || !planId || (!isFamily && !isSeatAddon && !childId)) {
    return NextResponse.json(
      { error: "invalid_request", message: "paymentId, planId가 필요해요 (개인 요금제는 childId도 필요)." },
      { status: 400 }
    );
  }

  const expectedAmount = getPlanPrice(planId);
  if (expectedAmount === null || expectedAmount === 0) {
    return NextResponse.json({ error: "invalid_request", message: "유효하지 않은 요금제예요." }, { status: 400 });
  }

  let verified;
  try {
    verified = await verifyPayment(paymentId);
  } catch (err) {
    console.error("포트원 결제 검증 실패:", err);
    return NextResponse.json(
      { error: "verification_failed", message: "결제 확인에 실패했어요. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }

  // ⚠️ 핵심 방어: 실제 결제된 금액이 이 요금제의 정확한 가격과 일치하는지 확인.
  // 다르면(위조 시도든 실수든) 절대 구독을 활성화하지 않는다.
  if (verified.status !== "PAID" || verified.amount !== expectedAmount) {
    console.error("결제 금액/상태 불일치:", { verified, expectedAmount, planId });
    return NextResponse.json(
      { error: "amount_mismatch", message: "결제 확인에 실패했어요. 금액이 일치하지 않아요." },
      { status: 400 }
    );
  }

  const result = isFamily
    ? await activateFamilyGroup({ ownerId: user.id, paymentId, amount: verified.amount })
    : isSeatAddon
    ? await activateFamilySeatAddon({ guardianId: user.id, paymentId, amount: verified.amount })
    : await activateSubscription({
        guardianId: user.id,
        childId: childId!,
        planId,
        paymentId,
        amount: verified.amount,
      });

  if (!result.ok) {
    console.error("구독 활성화 실패:", result.reason);
    return NextResponse.json(
      { error: "server_error", message: "결제는 확인됐지만 구독 활성화에 실패했어요. 문의해주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, plan: planId });
});
