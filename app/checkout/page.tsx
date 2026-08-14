"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

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

  const [status, setStatus] = useState<"idle" | "paying" | "verifying" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePay() {
    if (!childId) {
      setErrorMsg("어느 자녀 계정을 구독할지 정보가 없어요. 보호자 대시보드에서 다시 시도해주세요.");
      setStatus("error");
      return;
    }

    setStatus("paying");
    setErrorMsg(null);

    try {
      // @portone/browser-sdk는 클라이언트에서만 동작하므로 여기서 동적 import.
      const PortOne = (await import("@portone/browser-sdk/v2")).default;

      const paymentId = `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId,
        orderName: "MakerStudio Premium 구독",
        totalAmount: 9900,
        currency: "CURRENCY_KRW" as any,
        payMethod: "CARD" as any,
        // 웹훅이 나중에 비동기로 도착했을 때, 이 결제가 누구의 어떤 구독인지 알 수 있게
        // customData에 실어 보낸다 (webhook/portone/route.ts에서 이 값을 읽음).
        customData: { childId, planId },
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
        body: JSON.stringify({ paymentId, childId, planId }),
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
      setErrorMsg("결제 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <main className="authWrap">
        <div className="card center">
          <div className="tab">결제 완료</div>
          <p style={{ fontSize: 15, margin: "16px 0" }}>🎉 Premium 구독이 시작됐어요!</p>
          <Link href="/mypage" className="btn btnCoral fullBtn">마이페이지로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="authWrap">
      <p><Link href="/mypage">← 마이페이지로</Link></p>
      <div className="card">
        <div className="tab">Premium 구독</div>
        <h2>Premium 개인 — ₩9,900/월</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          AI 튜터 무제한, 모든 Premium 콘텐츠 이용 가능. 언제든 해지할 수 있고, 해지해도 남은 기간은 계속 이용할 수 있어요.
        </p>
        {errorMsg && <p className="formError">{errorMsg}</p>}
        <button
          className="btn btnCoral fullBtn"
          onClick={handlePay}
          disabled={status === "paying" || status === "verifying"}
        >
          {status === "paying" ? "결제창 여는 중..." : status === "verifying" ? "결제 확인 중..." : "₩9,900 결제하기"}
        </button>
      </div>
    </main>
  );
}
