"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type Me = { needsNickname: boolean; email: string | null; nickname: string | null; role?: string; phone?: string | null };

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }
    authedFetch("/api/identity/me")
      .then((res) => (res.status === 401 ? Promise.reject(401) : res.json()))
      .then((data) => {
        setMe(data);
        setNickname(data.nickname ?? "");
        setPhone(data.phone ?? "");
      })
      .catch(() => setNeedsLogin(true));
  }, []);

  async function handleSave() {
    if (!nickname.trim()) return;
    if (nickname.length > 10) {
      setSaveMsg("닉네임은 10자 이하로 입력해주세요.");
      return;
    }
    if (phone.trim() && !/^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone.trim())) {
      setSaveMsg("휴대폰번호 형식을 확인해주세요.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await authedFetch("/api/identity/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSaveMsg(body?.message ?? "저장에 실패했어요.");
        return;
      }
      setSaveMsg("저장했어요.");
    } catch {
      setSaveMsg("네트워크 오류로 저장하지 못했어요.");
    } finally {
      setSaving(false);
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

  if (!me) {
    return (
      <main className="wrap">
        <p className="muted">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="card">
        <div className="tab">계정 설정</div>
        <h2>내 정보</h2>
        <p className="muted" style={{ marginBottom: 16 }}>{me.email}</p>

        <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
          닉네임
        </label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={10}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--line-strong, #ddd)",
            marginBottom: 12,
          }}
        />

        {me.role === "guardian" && (
          <>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
              휴대폰 번호 (SMS 알림 수신용)
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--line-strong, #ddd)",
                marginBottom: 12,
              }}
            />
            <p className="muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 12 }}>
              결제 실패, 자녀 AI 튜터 안전 알림처럼 긴급한 알림만 문자로도 보내드려요. 비워두면 이메일로만 받아요.
            </p>
          </>
        )}

        <button onClick={handleSave} disabled={saving} className="btn btnCoral">
          {saving ? "저장 중..." : "저장하기"}
        </button>

        {saveMsg && <p className="muted" style={{ marginTop: 10 }}>{saveMsg}</p>}
      </div>
    </main>
  );
}