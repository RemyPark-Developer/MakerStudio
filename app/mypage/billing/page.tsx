"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type Plan = { id: string; name: string; price: number; interval: string | null };
type Payment = { id: string; subscription_id: string; amount: number; status: string; paid_at: string };
type Me = { role: string; childId: string | null; needsNickname: boolean };
type FamilyChild = { childId: string; nickname: string };
type FamilyGroup = { status: "active" | "canceled"; seatLimit: number; currentPeriodEnd: string } | null;
type Notification = { id: string; type: string; message: string; action_url: string | null; read_at: string | null };

const FAILED_PAYMENT_TYPES = new Set(["payment_failed", "payment_activation_failed"]);

export default function BillingPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [failedPaymentNotification, setFailedPaymentNotification] = useState<Notification | null>(null);
  const [dismissingNotification, setDismissingNotification] = useState(false);

  const [familyGroup, setFamilyGroup] = useState<FamilyGroup>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyChild[] | null>(null);
  const [eligibleChildren, setEligibleChildren] = useState<FamilyChild[] | null>(null);
  const [linkedChildren, setLinkedChildren] = useState<FamilyChild[] | null>(null);
  const [familyMsg, setFamilyMsg] = useState<string | null>(null);
  const [familyBusy, setFamilyBusy] = useState(false);
  const [familyCancelMsg, setFamilyCancelMsg] = useState<string | null>(null);
  const [familyCanceling, setFamilyCanceling] = useState(false);

  function loadFamily() {
    authedFetch("/api/billing/family/members")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setFamilyGroup(data.familyGroup ?? null);
        setFamilyMembers(data.members ?? []);
        setEligibleChildren(data.eligibleChildren ?? []);
        setLinkedChildren(data.linkedChildren ?? []);
      })
      .catch(() => {
        setFamilyGroup(null);
        setFamilyMembers([]);
        setEligibleChildren([]);
        setLinkedChildren([]);
      });
  }

  async function handleAddFamilyMember(childId: string) {
    setFamilyBusy(true);
    setFamilyMsg(null);
    try {
      const res = await authedFetch("/api/billing/family/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFamilyMsg(body?.message ?? "추가에 실패했어요.");
        return;
      }
      loadFamily();
    } catch {
      setFamilyMsg("네트워크 오류로 처리하지 못했어요.");
    } finally {
      setFamilyBusy(false);
    }
  }

  async function handleRemoveFamilyMember(childId: string) {
    if (!confirm("이 아이를 가족 그룹에서 제거할까요? (보호자-자녀 등록 자체는 그대로 유지돼요)")) return;
    setFamilyBusy(true);
    setFamilyMsg(null);
    try {
      const res = await authedFetch(`/api/billing/family/members/${childId}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFamilyMsg(body?.message ?? "제거에 실패했어요.");
        return;
      }
      loadFamily();
    } catch {
      setFamilyMsg("네트워크 오류로 처리하지 못했어요.");
    } finally {
      setFamilyBusy(false);
    }
  }

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
        loadFamily();
        // ⚠️ 이 fetch를 return하지 않는다 — 여기서 실패해도(예: 403) 위쪽 .catch()로
        // 흘러가서 "로그인이 필요해요" 화면이 잘못 뜨면 안 된다(2026-08-22 버그 수정,
        // 401 진짜 미로그인과 403 권한없음을 구분 못 하고 뭉뚱그리던 문제).
        authedFetch("/api/billing/history")
          .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
          .then((data) => setPayments(data.payments ?? []))
          .catch(() => {
            setPayments([]);
            setPaymentsError("결제 내역을 불러오지 못했어요.");
          });

        // 결제 재시도(2026-08-23) — 서버가 대신 재결제할 방법이 없는 구조(포트원 브라우저
        // 결제창을 매번 새로 여는 일회성 결제)라, 전용 API 대신 이미 쌓이고 있는
        // payment_failed/payment_activation_failed 알림(action_url에 정확한 재시도 링크
        // 포함)을 그대로 재사용해서 배너로 보여준다.
        authedFetch("/api/notifications")
          .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
          .then((data: { notifications?: Notification[] }) => {
            const failed = (data.notifications ?? []).find(
              (n) => FAILED_PAYMENT_TYPES.has(n.type) && n.read_at === null
            );
            setFailedPaymentNotification(failed ?? null);
          })
          .catch(() => setFailedPaymentNotification(null));
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
    // 해지 후 30일 데이터 보관 정책 고지(준비 단계, 2026-08-22 0036) —
    // ⚠️ 이 문구는 초안이며 실제 법률 검토가 필요하다.
    if (
      !confirm(
        "정말 구독을 해지하시겠어요? 현재 결제 기간이 끝날 때까지는 계속 이용하실 수 있어요. 해지 후 30일간은 학습 데이터가 보관되며, 재구독하면 그대로 복원돼요."
      )
    ) {
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

  async function handleCancelFamily() {
    // 해지 후 30일 데이터 보관 정책 고지(준비 단계, 2026-08-22 0036) —
    // ⚠️ 이 문구는 초안이며 실제 법률 검토가 필요하다.
    if (
      !confirm(
        "정말 Family 구독을 해지하시겠어요? 현재 결제 기간이 끝날 때까지는 계속 이용하실 수 있어요. 해지 후 30일간은 학습 데이터가 보관되며, 재구독하면 그대로 복원돼요."
      )
    ) {
      return;
    }

    setFamilyCanceling(true);
    setFamilyCancelMsg(null);
    try {
      const res = await authedFetch("/api/billing/family/cancel", { method: "POST" });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setFamilyCancelMsg(body?.message ?? "Family 해지에 실패했어요.");
        return;
      }
      setFamilyCancelMsg(body?.message ?? "해지 처리됐어요.");
      loadFamily();
    } catch {
      setFamilyCancelMsg("네트워크 오류로 처리하지 못했어요.");
    } finally {
      setFamilyCanceling(false);
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

  async function handleDismissFailedPayment() {
    if (!failedPaymentNotification) return;
    setDismissingNotification(true);
    try {
      await authedFetch(`/api/notifications/${failedPaymentNotification.id}/read`, { method: "PATCH" });
      setFailedPaymentNotification(null);
    } catch {
      // 무시해도 됨 — 못 지워지면 새로고침 시 배너가 다시 뜨는 정도라 치명적이지 않음.
    } finally {
      setDismissingNotification(false);
    }
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
      {failedPaymentNotification && (
        <div className="card" style={{ borderColor: "var(--coral, #e05a4c)" }}>
          <div className="tab coral">결제 실패</div>
          <p style={{ margin: "6px 0 12px" }}>⚠️ {failedPaymentNotification.message}</p>
          <div style={{ display: "flex", gap: 8 }}>
            {failedPaymentNotification.action_url && (
              <Link href={failedPaymentNotification.action_url} className="btn btnCoral">
                다시 시도하기
              </Link>
            )}
            <button onClick={handleDismissFailedPayment} disabled={dismissingNotification} className="btn btnOutline">
              {dismissingNotification ? "처리 중..." : "확인했어요"}
            </button>
          </div>
        </div>
      )}

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
        ) : paymentsError ? (
          <p className="muted">{paymentsError}</p>
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

      <div className="card">
        <div className="tab">Family 요금제</div>
        {familyGroup === null ? (
          <>
            <h2>가족과 함께 이용해보세요</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              최대 3명의 자녀 계정이 함께 Premium을 이용할 수 있어요 (₩19,900/월).
            </p>
            <Link href="/checkout?plan=family" className="btn btnCoral fullBtn">
              Family 요금제 시작하기
            </Link>
          </>
        ) : (
          <>
            <h2>내 가족 그룹 ({familyMembers?.length ?? 0}/{familyGroup.seatLimit}명)</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              {familyGroup.status === "canceled" ? "해지됨 · " : ""}
              {new Date(familyGroup.currentPeriodEnd).toLocaleDateString("ko-KR")}까지 이용 가능해요.
            </p>

            {familyGroup.status === "active" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <Link href="/checkout?plan=family_extra_seat" className="btn btnOutline" style={{ fontSize: 12.5 }}>
                  좌석 추가 구매 (₩4,900, 이번 주기만)
                </Link>
                <button onClick={handleCancelFamily} disabled={familyCanceling} className="btn btnOutline" style={{ fontSize: 12.5 }}>
                  {familyCanceling ? "처리 중..." : "Family 해지"}
                </button>
              </div>
            )}
            {familyCancelMsg && <p className="muted" style={{ marginBottom: 12 }}>{familyCancelMsg}</p>}

            <h3 style={{ fontSize: 13.5, margin: "12px 0 6px" }}>현재 멤버</h3>
            {familyMembers === null ? (
              <p className="muted">불러오는 중...</p>
            ) : familyMembers.length === 0 ? (
              <p className="muted">아직 추가된 자녀가 없어요.</p>
            ) : (
              familyMembers.map((c) => (
                <div key={c.childId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--grid-line)" }}>
                  <span>{c.nickname}</span>
                  <button
                    onClick={() => handleRemoveFamilyMember(c.childId)}
                    disabled={familyBusy}
                    className="btn btnOutline"
                    style={{ padding: "4px 10px", fontSize: 12.5 }}
                  >
                    제거
                  </button>
                </div>
              ))
            )}

            <h3 style={{ fontSize: 13.5, margin: "16px 0 6px" }}>추가 가능한 자녀</h3>
            {eligibleChildren === null ? (
              <p className="muted">불러오는 중...</p>
            ) : eligibleChildren.length === 0 ? (
              <p className="muted">
                추가할 수 있는 자녀가 없어요. 보호자 인증을 마친 자녀만 가족 그룹에 추가할 수 있어요.
              </p>
            ) : (
              eligibleChildren.map((c) => (
                <div key={c.childId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--grid-line)" }}>
                  <span>{c.nickname}</span>
                  <button
                    onClick={() => handleAddFamilyMember(c.childId)}
                    disabled={familyBusy || familyGroup.status !== "active" || (familyMembers?.length ?? 0) >= familyGroup.seatLimit}
                    className="btn btnCoral"
                    style={{ padding: "4px 10px", fontSize: 12.5 }}
                  >
                    추가
                  </button>
                </div>
              ))
            )}
          </>
        )}
        {familyMsg && <p className="muted" style={{ marginTop: 10 }}>{familyMsg}</p>}
      </div>

      <div className="card">
        <div className="tab coral">Premium VIP</div>
        <h2>비동기 프로젝트 멘토링 (₩100,000/월)</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          일반 Premium 콘텐츠 전체 이용 + 월 4회, 제출한 프로젝트/코드에 대해 전문 검수자가
          직접 확인·수정한 피드백을 받아요(AI 초안을 사람이 검토 후 전달 — AI가 혼자 답하지
          않아요). 자녀별로 개별 구독해요.
        </p>
        {linkedChildren === null ? (
          <p className="muted">불러오는 중...</p>
        ) : linkedChildren.length === 0 ? (
          <p className="muted">보호자 인증을 마친 자녀가 없어요.</p>
        ) : (
          linkedChildren.map((c) => (
            <div
              key={c.childId}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--grid-line)" }}
            >
              <span>{c.nickname}</span>
              <Link
                href={`/checkout?childId=${c.childId}&plan=premium_vip`}
                className="btn btnCoral"
                style={{ padding: "4px 10px", fontSize: 12.5 }}
              >
                VIP 시작하기
              </Link>
            </div>
          ))
        )}
      </div>
    </main>
  );
}