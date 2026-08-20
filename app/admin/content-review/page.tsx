"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type ModuleRow = {
  id: string;
  label_ko: string;
  board: string;
  difficulty: number;
  estimated_minutes: number;
  status: string;
  retry_count: number;
  created_at: string;
  last_verified_at: string | null;
  reviewer_nickname: string | null;
  review_note: string | null;
  updated_at: string;
};

type Tab = "pending" | "published" | "withdrawn" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "검수 대기" },
  { key: "published", label: "게시됨" },
  { key: "withdrawn", label: "반려됨" },
  { key: "all", label: "전체" },
];

export default function ContentReviewListPage() {
  const [modules, setModules] = useState<ModuleRow[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }
    setModules(null);
    authedFetch(`/api/content/pending?status=${tab}`)
      .then((res) => {
        if (res.status === 401) { setForbidden(true); return Promise.reject(401); }
        return res.ok ? res.json() : Promise.reject(res.status);
      })
      .then((data) => setModules(data.modules))
      .catch(() => setModules((m) => m ?? []));
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
        <div className="card center">
          <h2>관리자만 접근할 수 있어요</h2>
        </div>
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
        <div className="tab">콘텐츠 검수</div>
        <h2>{TABS.find((t) => t.key === tab)?.label} 목록</h2>

        {modules === null ? (
          <p className="muted">불러오는 중...</p>
        ) : modules.length === 0 ? (
          <p className="muted">{TABS.find((t) => t.key === tab)?.label} 콘텐츠가 없어요.</p>
        ) : (
          modules.map((m) => (
            <Link
              key={m.id}
              href={`/admin/content-review/${m.id}`}
              style={{
                display: "block",
                padding: "12px 0",
                borderBottom: "1px solid var(--grid-line)",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <b>{m.label_ko}</b>
              <span
                className="muted"
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background:
                    m.status === "automation_stuck" ? "#fde2e2" :
                    m.status === "published" ? "#eef6f0" :
                    m.status === "withdrawn" ? "#f0f0f0" : "#eef6f0",
                  color:
                    m.status === "automation_stuck" ? "#c0392b" :
                    m.status === "published" ? "#3B8F63" :
                    m.status === "withdrawn" ? "#888" : "#3B8F63",
                }}
              >
                {m.status === "automation_stuck" ? "자동화 실패" :
                 m.status === "published" ? "게시됨" :
                 m.status === "withdrawn" ? "반려됨" :
                 m.status === "draft" ? "초안" : "검수 대기"}
              </span>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                {m.board} · 난이도 {m.difficulty} · {m.estimated_minutes}분 · 시도 {m.retry_count}회 ·{" "}
                {new Date(m.created_at).toLocaleString("ko-KR")}
              </div>
              {m.reviewer_nickname && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {m.reviewer_nickname}님이 {new Date(m.updated_at).toLocaleString("ko-KR")}에 처리
                  {m.review_note && ` · 메모: ${m.review_note}`}
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </main>
  );
}