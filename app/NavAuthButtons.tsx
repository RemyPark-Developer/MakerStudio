"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

export function NavAuthButtons() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("ms_access_token"));
  }, []);

  async function handleLogout() {
    try {
      await authedFetch("/api/identity/logout", { method: "POST" });
    } catch {
      // 로그아웃 API가 실패해도, 로컬 토큰은 어차피 지워서 클라이언트 쪽에선 확실히 로그아웃되게 한다.
    }
    localStorage.removeItem("ms_access_token");
    localStorage.removeItem("ms_refresh_token");
    window.location.href = "/";
  }

  // 로그인 여부를 아직 확인 중일 땐(최초 렌더 직후) 깜빡임 방지를 위해 아무 것도 안 보여준다.
  if (loggedIn === null) {
    return <div style={{ width: 160, height: 38 }} />;
  }

  if (loggedIn) {
    return (
      <>
        <Link href="/mypage" className="btn btnOutline">마이페이지</Link>
        <button onClick={handleLogout} className="btn btnCoral">로그아웃</button>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="btn btnOutline">로그인</Link>
      <Link href="/signup" className="btn btnCoral">무료로 시작하기</Link>
    </>
  );
}
