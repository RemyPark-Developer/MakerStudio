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
  const [phone, setPhone] = useState("");

  async function handlePay() {
    if (!childId) {
      setErrorMsg("어느 자녀 계정을 구독할지 정보가 없어요. 보호자 대시보드에서 다시 시도해주세요.");
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
      if (!meRes.ok || !me?.email) {
        setErrorMsg(
          `결제자 이메일 정보를 확인하지 못했어요. (진단정보: status=${meRes.status}, body=${JSON.stringify(me)})`
        );
        setStatus("error");
        return;
      }

      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId,
        orderName: "MakerStudio Premium 구독",
        totalAmount: 9900,
        currency: "CURRENCY_KRW" as any,
        payMethod: "CARD" as any,
        // 이니시스 V2 일반결제는 구매자 이메일·휴대폰 번호가 모두 필수 — 실사용자 테스트 중 발견(2026-08-14).
        customer: { email: me.email, phoneNumber: phone.trim() },
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
          {status === "paying" ? "결제창 여는 중..." : status === "verifying" ? "결제 확인 중..." : "₩9,900 결제하기"}
        </button>
      </div>
    </main>
  );
}
