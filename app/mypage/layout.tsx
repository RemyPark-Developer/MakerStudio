"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authedFetch } from "@/lib/client-auth";

type Role = "student_teen" | "student_child" | "guardian" | "admin";

const TABS: { href: string; label: string; roles: Role[] | null }[] = [
  { href: "/mypage", label: "개요", roles: null },
  { href: "/mypage/settings", label: "설정", roles: null },
  { href: "/mypage/billing", label: "결제", roles: ["guardian", "admin"] },
];

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) return;
    authedFetch("/api/identity/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.needsNickname) setRole(data.role ?? null);
      })
      .catch(() => {});
  }, []);

  const visibleTabs = TABS.filter((t) => !t.roles || (role !== null && t.roles.includes(role)));

  return (
    <>
      <div style={{ padding: "12px 0" }}>
        <Link href="/">← 홈으로</Link>
      </div>
      <nav
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 0",
          borderBottom: "1px solid var(--grid-line)",
          marginBottom: 16,
        }}
      >
        {visibleTabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="btn"
            style={{
              background: pathname === t.href ? "var(--sage, #3B8F63)" : "transparent",
              color: pathname === t.href ? "#fff" : "var(--ink-dim, #666)",
              border: "1px solid var(--line-strong, #ddd)",
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {visibleTabs.find((t) => t.href === pathname) && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 16 }}>
          마이페이지 &gt; {visibleTabs.find((t) => t.href === pathname)?.label}
        </p>
      )}
      {children}
    </>
  );
}