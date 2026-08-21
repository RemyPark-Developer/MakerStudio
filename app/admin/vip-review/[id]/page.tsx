"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authedFetch } from "@/lib/client-auth";

type VipRequest = {
  id: string;
  student_nickname: string;
  submission_content: string;
  ai_draft_feedback: string | null;
  final_feedback: string | null;
  status: string;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
};

export default function VipReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [request, setRequest] = useState<VipRequest | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [feedbackText, setFeedbackText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    authedFetch(`/api/learning/vip/admin/${params.id}`)
      .then((res) => {
        if (res.status === 401) { setForbidden(true); return Promise.reject(401); }
        if (res.status === 404) { setNotFound(true); return Promise.reject(404); }
        return res.ok ? res.json() : Promise.reject(res.status);
      })
      .then((data) => {
        setRequest(data.request);
        // AI 초안이 있으면 그걸 시작점으로, 없으면(플래그됨/생성 실패) 빈 칸에서 관리자가 직접 작성.
        setFeedbackText(data.request.ai_draft_feedback ?? data.request.final_feedback ?? "");
      })
      .catch(() => {});
  }, [params.id]);

  async function handleApproveAndSend() {
    if (!feedbackText.trim()) {
      setActionMsg("발송할 피드백 내용을 입력해주세요.");
      return;
    }
    if (!confirm("이 내용을 학생/보호자에게 최종 발송할까요? 발송 후에는 수정할 수 없어요.")) return;

    setBusy(true);
    setActionMsg(null);
    try {
      const res = await authedFetch(`/api/learning/vip/admin/${params.id}/approve-and-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalFeedback: feedbackText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.message ?? "처리에 실패했어요.");
        return;
      }
      setActionMsg("승인 후 발송됐어요.");
      setTimeout(() => router.push("/admin/vip-review"), 1200);
    } catch {
      setActionMsg("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <main className="wrap">
        <div className="card center"><h2>관리자만 접근할 수 있어요</h2></div>
      </main>
    );
  }
  if (notFound) {
    return (
      <main className="wrap">
        <div className="card center"><h2>제출물을 찾을 수 없어요</h2></div>
      </main>
    );
  }
  if (!request) {
    return (
      <main className="wrap">
        <p className="muted">불러오는 중...</p>
      </main>
    );
  }

  const alreadySent = request.status === "sent";

  return (
    <main className="wrap">
      <p><Link href="/admin/vip-review">← 목록으로</Link></p>

      <div className="card">
        <div className="tab">제출 정보</div>
        <h2>{request.student_nickname}</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          {new Date(request.created_at).toLocaleString("ko-KR")} 제출
        </p>
        {request.flagged && (
          <p style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>
            ⚠ 안전필터에 걸려 AI 초안이 생성되지 않았어요(사유: {request.flag_reason}). 아래 내용은
            제출 시점에 이미 치환된 상태예요 — 필요하면 학생에게 직접 확인 후 안내해주세요.
          </p>
        )}
      </div>

      <div className="card">
        <div className="tab">제출 내용</div>
        <pre
          style={{
            background: "#152420",
            color: "#dff0e6",
            padding: 12,
            borderRadius: 8,
            fontSize: 12.5,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {request.submission_content}
        </pre>
      </div>

      <div className="card">
        <div className="tab">{alreadySent ? "발송된 피드백" : "피드백 (AI 초안 — 검토·수정 후 발송)"}</div>
        {alreadySent ? (
          <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{request.final_feedback}</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
              AI가 작성한 초안이에요 — 내용을 확인하고 자유롭게 수정한 뒤 발송해주세요. 이
              텍스트가 그대로 발송되기 전까지는 학생/보호자에게 어떤 내용도 노출되지 않아요.
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              style={{
                width: "100%",
                minHeight: 220,
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--line-strong)",
                fontSize: 13.5,
                lineHeight: 1.6,
              }}
            />
            <button onClick={handleApproveAndSend} disabled={busy} className="btn btnCoral" style={{ marginTop: 12 }}>
              {busy ? "처리 중..." : "승인 후 발송"}
            </button>
            {actionMsg && <p className="muted" style={{ marginTop: 10 }}>{actionMsg}</p>}
          </>
        )}
      </div>
    </main>
  );
}
