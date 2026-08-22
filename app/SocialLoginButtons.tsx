"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * "Google로 시작하기" 등 소셜 로그인 버튼 모음. 로그인/가입 화면 양쪽에서 재사용.
 * 카카오 버튼은 추가돼 있고 Supabase 프로바이더 등록도 끝났지만, `account_email`
 * 스코프가 카카오 비즈니스 정보 심사 승인 후에만 열리는 구조라 2026-08-23 기준
 * 보류 상태 — 심사 통과 전까지는 정식 로그인 테스트를 진행하지 않는다(CLAUDE.md 참고).
 */
export function SocialLoginButtons() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startOAuth(provider: "google" | "kakao") {
    setError(null);
    setLoading(provider);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError("소셜 로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
        setLoading(null);
      }
      // 성공하면 브라우저가 곧바로 프로바이더 동의 화면으로 이동하므로 별도 후처리 불필요.
    } catch {
      setError("소셜 로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
      setLoading(null);
    }
  }

  return (
    <div style={{ margin: "14px 0" }}>
      <button
        type="button"
        onClick={() => startOAuth("google")}
        disabled={loading !== null}
        className="btn btnOutline fullBtn"
      >
        {loading === "google" ? "이동 중..." : "Google로 시작하기"}
      </button>
      <button
        type="button"
        onClick={() => startOAuth("kakao")}
        disabled={loading !== null}
        className="btn btnOutline fullBtn"
      >
        {loading === "kakao" ? "이동 중..." : "카카오로 시작하기"}
      </button>
      {error && <p className="formError">{error}</p>}
    </div>
  );
}
