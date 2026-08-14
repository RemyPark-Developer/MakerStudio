"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/identity/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "로그인에 실패했어요.");
        return;
      }
      // MVP: 토큰을 localStorage에 저장. Phase 3 이후 httpOnly 쿠키 전환 검토 (NFR.md §3 보안 섹션 참고).
      localStorage.setItem("ms_access_token", data.accessToken);
      window.location.href = "/mypage";
    } catch {
      setError("서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authWrap">
      <p><Link href="/">← 홈으로</Link></p>
      <div className="card">
        <div className="tab">로그인</div>
        <h2>다시 오셨네요</h2>

        {/* TODO: 소셜 로그인(카카오·구글)은 OAuth 프로바이더 등록 후 추가 — Dev_Sequence.md 2단계 잔여 항목 */}

        <form className="authForm" onSubmit={handleSubmit}>
          <label htmlFor="email">이메일</label>
          <input
            id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <label htmlFor="password">비밀번호</label>
          <input
            id="password" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />
          <p style={{ textAlign: "right", margin: "6px 0 0" }}>
            <Link href="/forgot-password" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              비밀번호를 잊으셨나요?
            </Link>
          </p>
          {error && <p className="formError">{error}</p>}
          <button type="submit" disabled={loading} className="btn btnCoral fullBtn">
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="formNote">
          계정이 없으신가요? <Link href="/signup">회원가입</Link>
        </p>
      </div>
    </main>
  );
}
