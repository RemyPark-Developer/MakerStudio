"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Status = "loading" | "error" | "needs-nickname" | "done";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      const session = data?.session;

      if (error || !session) {
        setStatus("error");
        return;
      }

      // Auth_Flow.md §2.1/2.2 — Supabase 세션의 토큰을 우리 자체 인증 체계
      // (lib/client-auth.ts가 읽는 localStorage 키)로 그대로 옮겨서, 이후엔 기존
      // authedFetch/authedFetch 기반 화면을 전혀 안 건드리고 재사용한다.
      localStorage.setItem("ms_access_token", session.access_token);
      localStorage.setItem("ms_refresh_token", session.refresh_token);
      setAccessToken(session.access_token);

      try {
        const res = await fetch("/api/identity/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const me = await res.json();
        if (me?.needsNickname) {
          setStatus("needs-nickname");
        } else {
          window.location.href = "/mypage";
        }
      } catch {
        setStatus("error");
      }
    })();
  }, []);

  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/identity/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        // §3.3 — 소셜 로그인은 만 14세 이상으로 간주해 role을 student_teen으로 확정.
        body: JSON.stringify({ nickname, role: "student_teen" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSaveError(body?.message ?? "저장에 실패했어요.");
        return;
      }
      window.location.href = "/mypage";
    } catch {
      setSaveError("서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="authWrap">
        <div className="card center">
          <p className="muted">로그인 처리 중...</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="authWrap">
        <div className="card center">
          <h2>로그인에 실패했어요</h2>
          <Link href="/login" className="btn btnCoral fullBtn">다시 로그인하기</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="authWrap">
      <div className="card">
        <div className="tab">회원가입</div>
        <h2>닉네임을 알려주세요</h2>
        <form className="authForm" onSubmit={handleOnboardingSubmit}>
          <label htmlFor="nickname">닉네임</label>
          <input
            id="nickname" required maxLength={10} value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          {saveError && <p className="formError">{saveError}</p>}
          <button type="submit" disabled={saving} className="btn btnCoral fullBtn">
            {saving ? "저장 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </main>
  );
}
