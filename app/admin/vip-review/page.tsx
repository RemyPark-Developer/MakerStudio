"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type RequestRow = {
  id: string;
  student_nickname: string;
  status: string;
  flagged: boolean;
  created_at: string;
  reviewed_at: string | null;
};

type Tab = "pending" | "sent" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "검수 대기" },
  { key: "sent", label: "발송됨" },
  { key: "all", label: "전체" },
];

const STATUS_LABEL: Record<string, string> = {
  submitted: "제출됨",
  ai_drafted: "AI 초안 완료",
  approved: "승인됨",
  sent: "발송됨",
};

export default function VipReviewListPage() {
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }
    setRequests(null);
    authedFetch(`/api/learning/vip/admin?status=${tab}`)
      .then((res) => {
        if (res.status === 401) { setForbidden(true); return Promise.reject(401); }
        return res.ok ? res.json() : Promise.reject(res.status);
      })
      .then((data) => setRequests(data.requests))
      .catch(() => setRequests((r) => r ?? []));
  }, [tab]);

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
        <div className="card center"><h2>관리자만 접근할 수 있어요</h2></div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <p><Link href="/">← 홈으로</Link></p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="btn"
            style={{
              background: tab === t.key ? "var(--sage, #3B8F63)" : "transparent",
              color: tab === t.key ? "#fff" : "var(--ink-dim, #666)",
              border: "1px solid var(--line-strong, #ddd)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="tab">VIP 멘토링 검수</div>
        <h2>{TABS.find((t) => t.key === tab)?.label} 목록</h2>

        {requests === null ? (
          <p className="muted">불러오는 중...</p>
        ) : requests.length === 0 ? (
          <p className="muted">{TABS.find((t) => t.key === tab)?.label} 제출물이 없어요.</p>
        ) : (
          requests.map((r) => (
            <Link
              key={r.id}
              href={`/admin/vip-review/${r.id}`}
              style={{
                display: "block",
                padding: "12px 0",
                borderBottom: "1px solid var(--grid-line)",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <b>{r.student_nickname}</b>
              {r.flagged && (
                <span
                  className="muted"
                  style={{ marginLeft: 10, fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "#fde2e2", color: "#c0392b" }}
                >
                  ⚠ 안전필터 차단됨
                </span>
              )}
              <span
                className="muted"
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: r.status === "sent" ? "#eef6f0" : "#fff7e6",
                  color: r.status === "sent" ? "#3B8F63" : "#a06b00",
                }}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                {new Date(r.created_at).toLocaleString("ko-KR")}
                {r.reviewed_at && ` · ${new Date(r.reviewed_at).toLocaleString("ko-KR")}에 처리`}
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
