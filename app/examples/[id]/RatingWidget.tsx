"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

export function RatingWidget({
  exampleId,
  avgRating,
  ratingCount,
}: {
  exampleId: string;
  avgRating: number | null;
  ratingCount: number;
}) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !localStorage.getItem("ms_access_token")) return;
    setLoggedIn(true);
    authedFetch(`/api/learning/rating?moduleId=${encodeURIComponent(exampleId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.rating) setMyRating(data.rating);
      })
      .catch(() => {});
  }, [exampleId]);

  async function submitRating(rating: number) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await authedFetch("/api/learning/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: exampleId, rating }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMsg(body?.message ?? "평점 저장에 실패했어요.");
        return;
      }
      setMyRating(rating);
      setMsg("저장했어요.");
    } catch {
      setMsg("네트워크 오류로 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 8 }}>
        {avgRating !== null ? `⭐ ${avgRating.toFixed(1)} (${ratingCount}명 평가)` : "아직 평가가 없어요"}
      </p>

      {!loggedIn ? (
        <p className="muted" style={{ fontSize: 12.5 }}>
          <Link href="/login">로그인하고 평가하기</Link>
        </p>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hoverRating ?? myRating ?? 0) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={saving}
                  onClick={() => submitRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(null)}
                  aria-label={`${n}점`}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: saving ? "not-allowed" : "pointer",
                    fontSize: 20,
                    padding: 2,
                    opacity: active ? 1 : 0.35,
                  }}
                >
                  ⭐
                </button>
              );
            })}
          </div>
          {myRating !== null && (
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              내 평점: {myRating}점 (다시 클릭하면 수정돼요)
            </p>
          )}
          {msg && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
