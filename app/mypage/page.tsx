"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type ProgressRow = { example_id: string; step: number; updated_at: string };
type CodeRow = { id: string; example_id: string; code: string; saved_at: string };

export default function MyPage() {
  const [progress, setProgress] = useState<ProgressRow[] | null>(null);
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }

    // authedFetch가 만료된 토큰이면 자동으로 갱신 후 재시도한다 (2026-08-13 수정).
    authedFetch("/api/learning/progress")
      .then((res) => {
        if (res.status === 401) { setNeedsLogin(true); return Promise.reject(401); }
        return res.ok ? res.json() : Promise.reject(res.status);
      })
      .then((data) => setProgress(data.progress))
      .catch(() => setProgress((p) => p ?? []));

    authedFetch("/api/learning/code")
      .then((res) => {
        if (res.status === 401) { setNeedsLogin(true); return Promise.reject(401); }
        return res.ok ? res.json() : Promise.reject(res.status);
      })
      .then((data) => setCodes(data.codes))
      .catch(() => setCodes((c) => c ?? []));
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

  return (
    <main className="wrap">
      <p><Link href="/">← 홈으로</Link></p>

      <div className="card">
        <div className="tab">학습 진행</div>
        <h2>내 진도</h2>
        {progress === null ? (
          <p className="muted">불러오는 중...</p>
        ) : progress.length === 0 ? (
          <p className="muted">아직 진행 중인 학습이 없어요. <Link href="/examples">예제 둘러보기 →</Link></p>
        ) : (
          progress.map((p) => (
            <div key={p.example_id} style={{ padding: "10px 0", borderBottom: "1px solid var(--grid-line)" }}>
              <Link href={`/examples/${p.example_id}`}>{p.example_id}</Link>
              <span className="muted" style={{ marginLeft: 10, fontSize: 12.5 }}>
                {p.step}단계 · {new Date(p.updated_at).toLocaleDateString("ko-KR")}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="tab">내 코드</div>
        <h2>저장한 코드</h2>
        {codes === null ? (
          <p className="muted">불러오는 중...</p>
        ) : codes.length === 0 ? (
          <p className="muted">아직 저장한 코드가 없어요.</p>
        ) : (
          codes.map((c) => (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--grid-line)" }}>
              <b>{c.example_id}</b>
              <span className="muted" style={{ marginLeft: 10, fontSize: 12.5 }}>
                {new Date(c.saved_at).toLocaleDateString("ko-KR")}
              </span>
              <div className="codebox" style={{ marginTop: 6, fontSize: 12 }}>{c.code}</div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
