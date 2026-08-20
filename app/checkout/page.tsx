"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";
import { PLAN_PRICES } from "@/lib/billing/plans";

const PLAN_COPY: Record<string, { orderName: string; title: string; description: string }> = {
  premium: {
    orderName: "MakerStudio Premium 구독",
    title: `Premium 개인 — ₩${PLAN_PRICES.premium.toLocaleString()}/월`,
    description:
      "AI 튜터 무제한, 모든 Premium 콘텐츠 이용 가능. 언제든 해지할 수 있고, 해지해도 남은 기간은 계속 이용할 수 있어요.",
  },
  family: {
    orderName: "MakerStudio Family 구독",
    title: `Family — ₩${PLAN_PRICES.family.toLocaleString()}/월 (최대 3명)`,
    description:
      "최대 3명의 자녀 계정이 함께 Premium을 이용할 수 있어요. 결제 후 마이페이지에서 자녀를 추가/제거할 수 있어요.",
  },
  family_extra_seat: {
    orderName: "MakerStudio Family 좌석 추가",
    title: `Family 좌석 추가 — ₩${PLAN_PRICES.family_extra_seat.toLocaleString()}`,
    description:
      "이번 결제 주기 동안만 자녀 1명을 더 추가할 수 있어요. 다음 Family 재결제 때는 다시 3명으로 돌아가요.",
  },
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const searchParams = useSearchParams();
  const childId = searchParams.get("childId") ?? "";
  const planId = searchParams.get("plan") ?? "premium";
  const isFamily = planId === "family";
  const isSeatAddon = planId === "family_extra_seat";
  const noChildIdRequired = isFamily || isSeatAddon;
  const copy = PLAN_COPY[planId] ?? PLAN_COPY.premium;
  const price = PLAN_PRICES[planId] ?? PLAN_PRICES.premium;

  const [status, setStatus] = useState<"idle" | "paying" | "verifying" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [phone, setPhone] = useState("");

  async function handlePay() {
    // Family/좌석 추가는 특정 자녀가 아니라 보호자 본인이 결제 주체라 childId가 필요 없다.
    if (!noChildIdRequired && !childId) {
      setErrorMsg("어느 자녀 계정을 구독할지 정보가 없어요. 보호자 대시보드에서 다시 시도해주세요.");
      setStatus("error");
      return;
    }
    if (!buyerName.trim()) {
      setErrorMsg("결제자 이름을 입력해주세요.");
      setStatus("error");
      return;
    }
    if (!phone.trim()) {
      setErrorMsg("결제자 휴대폰 번호를 입력해주세요.");
      setStatus("error");
      return;
    }

    setStatus("paying");
    setErrorMsg(null);

    try {
      // @portone/browser-sdk는 클라이언트에서만 동작하므로 여기서 동적 import.
      const PortOne = (await import("@portone/browser-sdk/v2")).default;

      const paymentId = `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const meRes = await authedFetch("/api/identity/me");
      const me = await meRes.json().catch(() => null);
      if (!meRes.ok || !me?.email || !me?.id) {
        setErrorMsg(
          `결제자 정보를 확인하지 못했어요. (진단정보: status=${meRes.status}, body=${JSON.stringify(me)})`
        );
        setStatus("error");
        return;
      }

      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId,
        orderName: copy.orderName,
        totalAmount: price,
        currency: "CURRENCY_KRW" as any,
        payMethod: "CARD" as any,
        // 이니시스 V2 일반결제는 구매자 이름·이메일·휴대폰 번호가 모두 필수
        // — 실사용자 테스트 중 발견(2026-08-14 이메일/전화번호, 2026-08-20 이름 누락 추가 발견).
        customer: { fullName: buyerName.trim(), email: me.email, phoneNumber: phone.trim() },
        // 웹훅이 나중에 비동기로 도착했을 때, 이 결제가 누구의 어떤 구독인지 알 수 있게
        // customData에 실어 보낸다 (webhook/portone/route.ts에서 이 값을 읽음).
        // ⚠️ guardianId가 빠져있던 버그를 여기서 고쳤다(2026-08-20) — 이게 없으면 웹훅이
        // "진짜 최종 진실 공급원" 역할을 못 하고 조용히 스킵된다(fail-closed 원칙 위반).
        customData: noChildIdRequired ? { guardianId: me.id, planId } : { guardianId: me.id, childId, planId },
      });

      if (response?.code !== undefined) {
        setErrorMsg(response.message ?? "결제가 취소됐어요.");
        setStatus("error");
        return;
      }

      setStatus("verifying");

      const verifyRes = await authedFetch("/api/billing/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noChildIdRequired ? { paymentId, planId } : { paymentId, childId, planId }),
      });
      const data = await verifyRes.json();

      if (!verifyRes.ok) {
        setErrorMsg(data.message ?? "결제 확인에 실패했어요.");
        setStatus("error");
        return;
      }

      setStatus("done");
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      setErrorMsg(`결제 중 문제가 발생했어요. (진단정보: ${detail})`);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <main className="authWrap">
        <div className="card center">
          <div className="tab">결제 완료</div>
          <p style={{ fontSize: 15, margin: "16px 0" }}>
            🎉 {isSeatAddon ? "Family 좌석이 추가됐어요!" : `${isFamily ? "Family" : "Premium"} 구독이 시작됐어요!`}
          </p>
          <Link href="/mypage/billing" className="btn btnCoral fullBtn">마이페이지로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="authWrap">
      <p><Link href="/mypage">← 마이페이지로</Link></p>
      <div className="card">
        <div className="tab">{isSeatAddon ? "Family 좌석 추가" : isFamily ? "Family 구독" : "Premium 구독"}</div>
        <h2>{copy.title}</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          {copy.description}
        </p>
        <label htmlFor="buyerName" style={{ display: "block", fontSize: 13, fontWeight: 700, margin: "14px 0 6px", color: "var(--ink-dim)" }}>
          결제자 이름
        </label>
        <input
          id="buyerName"
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          placeholder="홍길동"
          style={{ width: "100%", padding: "11px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 14, marginBottom: 10 }}
        />
        <label htmlFor="phone" style={{ display: "block", fontSize: 13, fontWeight: 700, margin: "14px 0 6px", color: "var(--ink-dim)" }}>
          결제자 휴대폰 번호
        </label>
        <input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          style={{ width: "100%", padding: "11px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 14, marginBottom: 10 }}
        />
        {errorMsg && <p className="formError">{errorMsg}</p>}
        <button
          className="btn btnCoral fullBtn"
          onClick={handlePay}
          disabled={status === "paying" || status === "verifying"}
        >
          {status === "paying"
            ? "결제창 여는 중..."
            : status === "verifying"
            ? "결제 확인 중..."
            : `₩${price.toLocaleString()} 결제하기`}
        </button>
      </div>
    </main>
  );
}
