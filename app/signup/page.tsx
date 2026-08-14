"use client";

import { useState } from "react";
import Link from "next/link";

type Branch = "teen" | "child";

export default function SignupPage() {
  const [branch, setBranch] = useState<Branch>("teen");
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  // 가입이 끝나면, "누구신가요?" 선택 화면으로 되돌아가지 않고 완료 화면만 깔끔하게 보여준다.
  // (2026-08-14 수정 — 이전엔 가입 완료 메시지 위에 역할 선택 탭이 계속 남아있어서 혼란스러웠음)
  if (doneMessage) {
    return (
      <main className="authWrap">
        <div className="card center">
          <div className="tab">회원가입</div>
          <p style={{ fontSize: 15, margin: "16px 0" }}>{doneMessage}</p>
          <Link href="/login" className="btn btnCoral fullBtn">로그인하러 가기</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="authWrap">
      <p><Link href="/">← 홈으로</Link></p>
      <div className="card">
        <div className="tab">회원가입</div>
        <h2>누구신가요?</h2>

        <div style={{ display: "flex", gap: 8, margin: "12px 0 4px" }}>
          <button
            className={branch === "teen" ? "btn btnCoral" : "btn btnOutline"}
            onClick={() => setBranch("teen")}
            type="button"
          >
            중고등·성인
          </button>
          <button
            className={branch === "child" ? "btn btnCoral" : "btn btnOutline"}
            onClick={() => setBranch("child")}
            type="button"
          >
            초등학생
          </button>
        </div>

        {branch === "teen" ? (
          <TeenSignupForm onDone={() => setDoneMessage("📧 확인 메일을 보냈어요! 메일함에서 링크를 눌러야 로그인할 수 있어요.")} />
        ) : (
          <ChildSignupForm onDone={() => setDoneMessage("🎉 가입이 완료됐어요!")} />
        )}
      </div>
    </main>
  );
}

function TeenSignupForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/identity/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "가입에 실패했어요.");
        return;
      }
      onDone();
    } catch {
      setError("서버에 연결할 수 없어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="authForm" onSubmit={handleSubmit}>
      {/* TODO: 소셜 가입(카카오·구글)은 OAuth 연동 후 여기에 추가 */}
      <label htmlFor="nickname">닉네임</label>
      <input id="nickname" required maxLength={10} value={nickname} onChange={(e) => setNickname(e.target.value)} />
      <label htmlFor="email">이메일</label>
      <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">비밀번호</label>
      <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="formError">{error}</p>}
      <button type="submit" disabled={loading} className="btn btnCoral fullBtn">
        {loading ? "가입 중..." : "가입하기"}
      </button>
      <p className="formNote">만 14세 이상으로 간주하고 별도 보호자 동의 절차 없이 바로 이용 시작해요.</p>
    </form>
  );
}

function ChildSignupForm({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/identity/signup/child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, guardianPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "요청에 실패했어요.");
        return;
      }
      setVerifyToken(data.verifyToken);
      setStep(2);
    } catch {
      setError("서버에 연결할 수 없어요.");
    } finally {
      setLoading(false);
    }
  }

  async function finishVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/identity/signup/child/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifyToken, smsCode, agreeChildPrivacy: agree }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "인증에 실패했어요.");
        return;
      }
      onDone();
    } catch {
      setError("서버에 연결할 수 없어요.");
    } finally {
      setLoading(false);
    }
  }

  if (step === 1) {
    return (
      <form className="authForm" onSubmit={startVerify}>
        <label htmlFor="c-nickname">닉네임</label>
        <input id="c-nickname" required maxLength={10} value={nickname} onChange={(e) => setNickname(e.target.value)} />
        <label htmlFor="g-phone">보호자 휴대폰 번호</label>
        <input
          id="g-phone" required placeholder="010-0000-0000"
          value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)}
        />
        {error && <p className="formError">{error}</p>}
        <button type="submit" disabled={loading} className="btn btnCoral fullBtn">
          {loading ? "전송 중..." : "인증번호 받기"}
        </button>
      </form>
    );
  }

  return (
    <form className="authForm" onSubmit={finishVerify}>
      <p className="formNote">보호자님 번호로 인증번호를 보냈어요.</p>
      <label htmlFor="sms">인증번호 6자리</label>
      <input id="sms" required maxLength={6} value={smsCode} onChange={(e) => setSmsCode(e.target.value)} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13 }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: "auto" }} />
        (법정대리인 확인) 만 14세 미만 아동의 개인정보 수집·이용에 동의합니다.
      </label>
      {error && <p className="formError">{error}</p>}
      <button type="submit" disabled={loading} className="btn btnCoral fullBtn">
        {loading ? "확인 중..." : "인증 완료"}
      </button>
    </form>
  );
}
