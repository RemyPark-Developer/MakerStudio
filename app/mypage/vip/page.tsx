"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type VipRequest = {
  id: string;
  submissionContent: string;
  finalFeedback: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
};

type Child = { childId: string; nickname: string };

const STATUS_LABEL: Record<string, string> = {
  submitted: "검토 대기 중",
  ai_drafted: "검토 대기 중",
  approved: "검토 대기 중",
  sent: "피드백 도착",
};

function RequestList({ requests }: { requests: VipRequest[] }) {
  if (requests.length === 0) {
    return <p className="muted">아직 제출한 내역이 없어요.</p>;
  }
  return (
    <>
      {requests.map((r) => (
        <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--grid-line)" }}>
          <span
            className="muted"
            style={{
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
            {new Date(r.createdAt).toLocaleString("ko-KR")} 제출
          </div>
          <p style={{ marginTop: 8, fontSize: 13.5, whiteSpace: "pre-wrap" }}>{r.submissionContent}</p>
          {r.status === "sent" && r.finalFeedback && (
            <div style={{ marginTop: 10, padding: 10, background: "var(--sage-pale, #eef6f0)", borderRadius: 8 }}>
              <b style={{ fontSize: 12.5 }}>멘토 피드백</b>
              <p style={{ marginTop: 6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>{r.finalFeedback}</p>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default function VipPage() {
  const [role, setRole] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  // 학생용
  const [submissionText, setSubmissionText] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [requests, setRequests] = useState<VipRequest[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // 보호자용
  const [children, setChildren] = useState<Child[] | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  function loadMyRequests(childId?: string) {
    const url = childId ? `/api/learning/vip/my-requests?childId=${childId}` : "/api/learning/vip/my-requests";
    authedFetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setRequests(data.requests ?? []);
        setRemaining(data.remainingSubmissions ?? null);
      })
      .catch(() => setRequests([]));
  }

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }
    authedFetch("/api/identity/me")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setRole(data.role);
        if (data.role === "student_child" || data.role === "student_teen") {
          loadMyRequests();
        } else if (data.role === "guardian") {
          authedFetch("/api/billing/family/members")
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((d) => setChildren(d.linkedChildren ?? []))
            .catch(() => setChildren([]));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedChildId) loadMyRequests(selectedChildId);
  }, [selectedChildId]);

  async function handleSubmit() {
    if (!submissionText.trim()) {
      setSubmitMsg("제출할 내용을 입력해주세요.");
      return;
    }
    setSubmitBusy(true);
    setSubmitMsg(null);
    try {
      const res = await authedFetch("/api/learning/vip/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionContent: submissionText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMsg(data.message ?? "제출에 실패했어요.");
        return;
      }
      setSubmitMsg(data.message ?? (data.blocked ? "제출이 차단됐어요." : "제출됐어요."));
      if (!data.blocked) {
        setSubmissionText("");
        loadMyRequests();
      }
    } catch {
      setSubmitMsg("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitBusy(false);
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

  if (role === null) {
    return (
      <main className="wrap">
        <p className="muted">불러오는 중...</p>
      </main>
    );
  }

  if (role !== "student_child" && role !== "student_teen" && role !== "guardian") {
    return (
      <main className="wrap">
        <div className="card center"><h2>학생/보호자 전용 화면이에요</h2></div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <p><Link href="/mypage">← 마이페이지로</Link></p>

      {(role === "student_child" || role === "student_teen") && (
        <div className="card">
          <div className="tab coral">VIP 멘토링 제출</div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            {remaining !== null && `이번 달 남은 제출 횟수: ${remaining}회`}
          </p>
          <textarea
            value={submissionText}
            onChange={(e) => setSubmissionText(e.target.value)}
            placeholder="프로젝트 설명이나 코드를 붙여넣어주세요."
            style={{
              width: "100%",
              minHeight: 160,
              padding: 10,
              borderRadius: 8,
              border: "1px solid var(--line-strong)",
              fontSize: 13.5,
            }}
          />
          <button onClick={handleSubmit} disabled={submitBusy} className="btn btnCoral" style={{ marginTop: 10 }}>
            {submitBusy ? "제출 중..." : "제출하기"}
          </button>
          {submitMsg && <p className="muted" style={{ marginTop: 10 }}>{submitMsg}</p>}
        </div>
      )}

      {role === "guardian" && (
        <div className="card">
          <div className="tab">자녀 선택</div>
          {children === null ? (
            <p className="muted">불러오는 중...</p>
          ) : children.length === 0 ? (
            <p className="muted">연결된 자녀가 없어요.</p>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {children.map((c) => (
                <button
                  key={c.childId}
                  onClick={() => setSelectedChildId(c.childId)}
                  className="btn"
                  style={{
                    background: selectedChildId === c.childId ? "var(--sage, #3B8F63)" : "transparent",
                    color: selectedChildId === c.childId ? "#fff" : "var(--ink-dim, #666)",
                    border: "1px solid var(--line-strong, #ddd)",
                  }}
                >
                  {c.nickname}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="tab">제출 이력</div>
        {requests === null ? (
          <p className="muted">{role === "guardian" ? "자녀를 선택해주세요." : "불러오는 중..."}</p>
        ) : (
          <RequestList requests={requests} />
        )}
      </div>
    </main>
  );
}
