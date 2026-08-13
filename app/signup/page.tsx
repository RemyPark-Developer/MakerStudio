"use client";

import { useState } from "react";
import Link from "next/link";

type Branch = "teen" | "child";

export default function SignupPage() {
  const [branch, setBranch] = useState<Branch>("teen");

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

        {branch === "teen" ? <TeenSignupForm /> : <ChildSignupForm />}
      </div>
    </main>
  );
}

function TeenSignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      setDone(true);
    } catch {
      setError("서버에 연결할 수 없어요.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div>
        <p>🎉 가입이 완료됐어요! 이제 로그인해주세요.</p>
        <Link href="/login" className="btn btnCoral fullBtn">로그인하러 가기</Link>
      </div>
    );
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

function ChildSignupForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      setDone(true);
    } catch {
      setError("서버에 연결할 수 없어요.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div>
        <p>🎉 가입이 완료됐어요!</p>
        <Link href="/login" className="btn btnCoral fullBtn">로그인하러 가기</Link>
      </div>
    );
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
