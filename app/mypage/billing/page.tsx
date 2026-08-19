"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type Plan = { id: string; name: string; price: number; interval: string | null };
type Payment = { id: string; subscription_id: string; amount: number; status: string; paid_at: string };
type Me = { role: string; childId: string | null; needsNickname: boolean };

export default function BillingPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }

    authedFetch("/api/identity/me")
      .then((res) => (res.status === 401 ? Promise.reject(401) : res.json()))
      .then((data: Me) => {
        setMe(data);
        if (data.role !== "guardian" && data.role !== "admin") {
          setForbidden(true);
          return;
        }
        return authedFetch("/api/billing/history")
          .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
          .then((data) => setPayments(data.payments ?? []));
      })
      .catch(() => setNeedsLogin(true));

    fetch("/api/billing/plans")
      .then((res) => res.json())
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => setPlans([]));
  }, []);

  async function handleCancel() {
    if (!me?.childId) {
      setCancelMsg("연결된 자녀 계정을 찾을 수 없어요.");
      return;
    }
    if (!confirm("정말 구독을 해지하시겠어요? 현재 결제 기간이 끝날 때까지는 계속 이용하실 수 있어요.")) {
      return;
    }

    setCanceling(true);
    setCancelMsg(null);
    try {
      const res = await authedFetch("/api/billing/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: me.childId }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setCancelMsg(body?.message ?? "구독 해지에 실패했어요.");
        return;
      }
      setCancelMsg(body?.message ?? "해지 처리됐어요.");
    } catch {
      setCancelMsg("네트워크 오류로 처리하지 못했어요.");
    } finally {
      setCanceling(false);
    }
  }

  if (needsLogin) {
    return (
      <main className="wrap">
        <div className="card center">
          <h2>로그인이 필요해요</h2>
          <Link href="/login" className="btn btnCoral fullBtn">로그인하러 가기</Link>
        </div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="wrap">
        <div className="card center">
          <h2>보호자만 이용할 수 있어요</h2>
          <p className="muted">결제 관련 정보는 보호자 계정에서만 확인할 수 있어요.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="card">
        <div className="tab">요금제</div>
        <h2>이용 가능한 요금제</h2>
        {plans === null ? (
          <p className="muted">불러오는 중...</p>
        ) : (
          plans.map((p) => (
            <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--grid-line)" }}>
              <b>{p.name}</b>
              <span className="muted" style={{ marginLeft: 10, fontSize: 12.5 }}>
                {p.price === 0 ? "무료" : `${p.price.toLocaleString()}원${p.interval ? ` / ${p.interval}` : ""}`}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="tab">결제 내역</div>
        <h2>내 결제 내역</h2>
        {payments === null ? (
          <p className="muted">불러오는 중...</p>
        ) : payments.length === 0 ? (
          <p className="muted">결제 내역이 없어요.</p>
        ) : (
          payments.map((pay) => (
            <div key={pay.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--grid-line)" }}>
              <b>{pay.amount.toLocaleString()}원</b>
              <span className="muted" style={{ marginLeft: 10, fontSize: 12.5 }}>
                {pay.status} · {new Date(pay.paid_at).toLocaleDateString("ko-KR")}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="tab">구독 관리</div>
        <h2>구독 해지</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          해지해도 현재 결제 기간이 끝날 때까지는 계속 이용하실 수 있어요.
        </p>
        <button onClick={handleCancel} disabled={canceling} className="btn btnOutline">
          {canceling ? "처리 중..." : "구독 해지하기"}
        </button>
        {cancelMsg && <p className="muted" style={{ marginTop: 10 }}>{cancelMsg}</p>}
      </div>
    </main>
  );
}