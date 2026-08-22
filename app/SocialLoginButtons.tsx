"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * "Google로 시작하기" 등 소셜 로그인 버튼 모음. 로그인/가입 화면 양쪽에서 재사용.
 * 카카오는 대표님이 Supabase 대시보드에 Kakao 프로바이더(Client ID/Secret)를 등록하면,
 * 아래에 같은 패턴으로 `startOAuth("kakao")` 버튼 하나만 추가하면 된다.
 */
export function SocialLoginButtons() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startOAuth(provider: "google") {
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
      // 성공하면 브라우저가 곧바로 구글 동의 화면으로 이동하므로 별도 후처리 불필요.
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
      {error && <p className="formError">{error}</p>}
    </div>
  );
}
