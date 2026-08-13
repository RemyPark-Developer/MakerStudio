"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/identity/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // 존재 여부와 무관하게 항상 같은 성공 화면을 보여준다 (계정 탐색 방지, Auth_Flow.md §2.5)
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authWrap">
      <p><Link href="/login">← 로그인으로</Link></p>
      <div className="card">
        <div className="tab">비밀번호 찾기</div>
        {sent ? (
          <>
            <h2>메일함을 확인해주세요</h2>
            <p className="muted">
              {email} 주소로 재설정 링크를 보냈어요 (계정이 있는 경우). 이메일이 안 보이면
              스팸함도 확인해주세요.
            </p>
          </>
        ) : (
          <>
            <h2>가입하신 이메일을 입력해주세요</h2>
            <form className="authForm" onSubmit={handleSubmit}>
              <label htmlFor="email">이메일</label>
              <input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
              <button type="submit" disabled={loading} className="btn btnCoral fullBtn">
                {loading ? "전송 중..." : "재설정 링크 보내기"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
