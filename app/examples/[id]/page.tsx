"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QuizBlock } from "./QuizBlock";
import { AiTutorPanel } from "./AiTutorPanel";

type GatedExample = {
  id: string;
  icon: string;
  label: string;
  board: string;
  difficulty: number;
  estimatedMinutes: number;
  pin: string;
  intro: string;
  parts: string[];
  mission: string;
  quiz?: { question: string; options: string[]; answer: number; explain: string };
  sourceExample?: string;
  isPremium: boolean;
  locked: boolean;
  code?: string;
  codeHtml?: string;
  codeFilename?: string;
  explain?: string;
};

export default function ExamplePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<GatedExample | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  // "Premium 구독하기" 버튼이 왜 못 나가는지 구분해서 보여주기 위한 상태(2026-08-22 버그
  // 수정 — 예전엔 childId 없으면 이유 설명 없이 무조건 /mypage로 조용히 보냈음).
  const [hasToken, setHasToken] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("ms_access_token") : null;
    if (!token) return;
    setHasToken(true);
    fetch("/api/identity/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (me?.childId) setChildId(me.childId);
        if (me?.role) setRole(me.role);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("ms_access_token") : null;
    fetch(`/api/content/examples/${params.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        setData(await res.json());
      })
      .catch(() => setNotFound(true));
  }, [params.id]);

  if (notFound) return <main className="wrap"><p>콘텐츠를 찾을 수 없어요.</p></main>;
  if (!data) return <main className="wrap"><p>불러오는 중...</p></main>;

  return (
    <main className="wrap">
      <p><Link href="/examples">← 목록으로</Link></p>

      <div className="card">
        <div className="tab">U3 · 프로젝트 소개</div>
        <h1>{data.icon} {data.label}</h1>
        <span className="pill">난이도 {"★".repeat(data.difficulty)}</span>
        <span className="pill">예상시간 {data.estimatedMinutes}분</span>
        <span className="pill">{data.board}</span>
        {data.isPremium && (
          <span className="pill" style={{ background: "var(--sage-pale)", color: "var(--sage-dark)", fontWeight: 700 }}>
            🔒 Premium
          </span>
        )}
        <p style={{ marginTop: 12 }}>{data.intro}</p>
      </div>

      <div className="card">
        <div className="tab">R1 · 준비물</div>
        <h3>부품</h3>
        <ul className="partlist">
          {data.parts.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </div>

      <div className="card">
        <div className="tab">C1 · 회로 핀</div>
        <h3>연결 핀</h3>
        <p>{data.pin}</p>
      </div>

      {data.locked ? (
        <div className="card" style={{ borderColor: "var(--coral)" }}>
          <div className="tab coral">🔒 Premium 콘텐츠</div>
          <h3>전체 코드와 설명은 구독자에게만 제공돼요</h3>
          <p className="muted">
            이 모듈은 Premium 콘텐츠예요. 구독하시면 전체 코드, 코드 설명, AI 튜터까지 모두
            이용하실 수 있어요.
          </p>
          {childId ? (
            <Link href={`/checkout?childId=${childId}&plan=premium`} className="btn btnCoral fullBtn">
              Premium 구독하기
            </Link>
          ) : !hasToken ? (
            <Link href="/login" className="btn btnCoral fullBtn">
              로그인하고 구독하기
            </Link>
          ) : role === "guardian" ? (
            <>
              <p className="muted" style={{ marginBottom: 8 }}>
                연결된 자녀가 없어요. 마이페이지에서 자녀를 먼저 연결해주세요.
              </p>
              <Link href="/mypage/billing" className="btn btnOutline">마이페이지로</Link>
            </>
          ) : role === "admin" ? (
            <p className="muted">관리자 계정은 구독을 만들 수 없어요.</p>
          ) : (
            <p className="muted">구독은 보호자 계정에서만 가능해요.</p>
          )}
        </div>
      ) : (
        <>
          <div className="card">
            <div className="tab">Q1 · 전체 코드</div>
            <h3>{data.codeFilename}</h3>
            {data.codeHtml ? (
              <div className="codebox" dangerouslySetInnerHTML={{ __html: data.codeHtml }} />
            ) : (
              <div className="codebox">{data.code}</div>
            )}
            {data.sourceExample && <div className="sourcebadge">소스: {data.sourceExample}</div>}
          </div>

          <div className="card">
            <div className="tab">Q2 · 코드 설명</div>
            <h3>설명</h3>
            <p>{data.explain}</p>
          </div>
        </>
      )}

      <div className="card">
        <div className="tab coral">M1 · 응용 미션</div>
        <h3>미션</h3>
        <p>{data.mission}</p>
      </div>

      {!data.locked && data.quiz && (
        <div className="card">
          <div className="tab coral">Z1 · Quiz</div>
          <QuizBlock quiz={data.quiz} exampleId={params.id} />
        </div>
      )}

      {!data.locked && (
        <div className="card">
          <div className="tab">AI · TUTOR</div>
          <AiTutorPanel exampleId={params.id} exampleLabel={data.label} stepName="학습 중" />
        </div>
      )}
    </main>
  );
}
