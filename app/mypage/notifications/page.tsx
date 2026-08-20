"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type Notification = {
  id: string;
  type: string;
  message: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  payment_success: "결제 완료",
  payment_activation_failed: "결제 처리 문제",
  payment_failed: "결제 실패",
  subscription_canceled: "구독 해지",
  family_member_added: "Family 멤버 추가",
  family_member_removed: "Family 멤버 제거",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }

    authedFetch("/api/notifications")
      .then((res) => (res.status === 401 ? Promise.reject(401) : res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => setNeedsLogin(true));
  }, []);

  function markRead(id: string) {
    authedFetch(`/api/notifications/${id}/read`, { method: "PATCH" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(() => {
        setNotifications((prev) =>
          (prev ?? []).map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
        );
      })
      .catch(() => {});
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

  return (
    <main className="wrap">
      <div className="card">
        <div className="tab">알림함</div>
        <h2>내 알림</h2>
        {notifications === null ? (
          <p className="muted">불러오는 중...</p>
        ) : notifications.length === 0 ? (
          <p className="muted">아직 받은 알림이 없어요.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read_at && markRead(n.id)}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid var(--grid-line)",
                cursor: n.read_at ? "default" : "pointer",
                opacity: n.read_at ? 0.6 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!n.read_at && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--coral, #EE8B6A)", flexShrink: 0 }} />
                )}
                <b style={{ fontSize: 13 }}>{TYPE_LABELS[n.type] ?? n.type}</b>
                <span className="muted" style={{ fontSize: 12 }}>
                  {new Date(n.created_at).toLocaleString("ko-KR")}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13.5 }}>{n.message}</p>
              {n.action_url && (
                <Link
                  href={n.action_url}
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 12.5 }}
                >
                  자세히 보기 →
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
