import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "@portone/server-sdk";
import { verifyPayment } from "@/lib/billing/portone";
import { getPlanPrice } from "@/lib/billing/plans";
import { activateSubscription } from "@/lib/billing/activateSubscription";
import { activateFamilyGroup } from "@/lib/billing/activateFamilyGroup";
import { notifyGuardian } from "@/lib/notifications/notify";

/**
 * 포트원이 결제 완료/실패/취소 시 비동기로 호출하는 웹훅.
 * §9.2(모니터링) 원칙과 연결 — 클라이언트 verify 호출이 안 일어나도(브라우저가
 * 결제 도중 닫히는 경우 등) 이 웹훅이 최종적으로 구독을 활성화하는 진실 공급원이다.
 *
 * ⚠️ 서명 검증이 반드시 필요하다 — 이게 없으면 누구나 이 URL에 가짜 "결제 완료"
 * 요청을 보내서 무료로 구독을 활성화시킬 수 있다.
 *
 * 결제를 시작할 때(app/checkout/page.tsx) customData에 {guardianId, childId, planId}를
 * 반드시 실어 보내야, 이 웹훅이 어느 보호자/자녀/요금제인지 알 수 있다.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("PORTONE_WEBHOOK_SECRET이 설정되지 않았어요.");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // ⚠️ 반드시 파싱 전 원문 문자열로 검증해야 한다 — JSON.parse 후 다시 문자열로
  // 바꾸면 필드 순서/공백 차이로 서명이 안 맞을 수 있다.
  const rawBody = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
  };

  let webhook;
  try {
    webhook = await Webhook.verify(secret, rawBody, headers);
  } catch (err) {
    console.error("웹훅 서명 검증 실패 — 위조된 요청일 수 있음:", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (webhook.type !== "Transaction.Paid" && webhook.type !== "Transaction.Failed") {
    // 다른 이벤트 타입(취소, 가상계좌발급 등)은 지금 범위 밖 — 일단 확인만 하고 넘어간다.
    return NextResponse.json({ received: true });
  }

  const paymentId = (webhook.data as any)?.paymentId;
  if (!paymentId) {
    return NextResponse.json({ received: true });
  }

  try {
    const verified = await verifyPayment(paymentId);
    const customData =
      typeof verified.customData === "string"
        ? JSON.parse(verified.customData)
        : (verified.customData as { guardianId?: string; childId?: string; planId?: string } | null);

    if (!customData?.guardianId) {
      console.error("웹훅: customData에 guardianId가 없어서 누구에게도 알릴 수 없음", { paymentId, customData });
      return NextResponse.json({ received: true });
    }

    if (webhook.type === "Transaction.Failed") {
      const notifyResult = await notifyGuardian({
        guardianId: customData.guardianId,
        type: "payment_failed",
        message: "결제가 실패했어요. 다시 시도해주세요.",
        actionUrl: "/checkout",
      });
      if (!notifyResult.ok) {
        console.error("결제 실패 알림 실패:", notifyResult.reason);
      }
      return NextResponse.json({ received: true });
    }

    const isFamily = customData.planId === "family";

    // ⚠️ guardianId가 checkout/page.tsx에서 빠져있던 버그를 2026-08-20에 고쳤다 — 그 전까지는
    // 이 조건이 개인 구독에 대해서도 항상 참이라 웹훅이 매번 조용히 스킵됐다(fail-closed 원칙 위반,
    // verify/route.ts가 살아있어서 겉으로는 문제없어 보였을 뿐).
    if (!customData.planId || (!isFamily && !customData.childId)) {
      console.error("웹훅: customData 누락으로 어느 구독인지 알 수 없음", { paymentId, customData });
      return NextResponse.json({ received: true });
    }

    const expectedAmount = getPlanPrice(customData.planId);
    if (verified.status !== "PAID" || verified.amount !== expectedAmount) {
      console.error("웹훅: 금액/상태 불일치, 활성화 안 함", { paymentId, verified, expectedAmount });
      return NextResponse.json({ received: true });
    }

    const result = isFamily
      ? await activateFamilyGroup({ ownerId: customData.guardianId, paymentId, amount: verified.amount })
      : await activateSubscription({
          guardianId: customData.guardianId,
          childId: customData.childId!,
          planId: customData.planId,
          paymentId,
          amount: verified.amount,
        });

    if (!result.ok) {
      console.error("웹훅: 구독 활성화 실패", result.reason);
      const notifyResult = await notifyGuardian({
        guardianId: customData.guardianId,
        type: "payment_activation_failed",
        message: "결제는 확인됐지만 처리 중 문제가 발생했어요. 확인 후 조치할게요.",
        actionUrl: "/mypage/billing",
      });
      if (!notifyResult.ok) {
        console.error("결제 활성화 실패 알림도 실패:", notifyResult.reason);
      }
    }
  } catch (err) {
    console.error("웹훅 처리 중 오류:", err);
  }

  return NextResponse.json({ received: true });
}
