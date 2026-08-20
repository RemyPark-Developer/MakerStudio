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
};

export default function ContentReviewListPage() {
  const [modules, setModules] = useState<ModuleRow[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }
    authedFetch("/api/content/pending")
      .then((res) => {
        if (res.status === 401) { setForbidden(true); return Promise.reject(401); }
        return res.ok ? res.json() : Promise.reject(res.status);
      })
      .then((data) => setModules(data.modules))
      .catch(() => setModules((m) => m ?? []));
  }, []);

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

      <div className="card">
        <div className="tab">콘텐츠 검수</div>
        <h2>검수 대기 목록</h2>

        {modules === null ? (
          <p className="muted">불러오는 중...</p>
        ) : modules.length === 0 ? (
          <p className="muted">검수 대기 중인 콘텐츠가 없어요.</p>
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
                  background: m.status === "automation_stuck" ? "#fde2e2" : "#eef6f0",
                  color: m.status === "automation_stuck" ? "#c0392b" : "#3B8F63",
                }}
              >
                {m.status === "automation_stuck" ? "자동화 실패" : "검수 대기"}
              </span>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                {m.board} · 난이도 {m.difficulty} · {m.estimated_minutes}분 · 시도 {m.retry_count}회 ·{" "}
                {new Date(m.created_at).toLocaleString("ko-KR")}
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}