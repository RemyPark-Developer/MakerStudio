"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type DashboardData = {
  summary: {
    monthRevenue: number;
    payingCustomers: number;
    churnRate: number;
    newPaymentsThisMonth: number;
  };
  byPlan: { plan: string; customerCount: number; sharePct: number; churnRate: number }[];
  revenueTrend: { month: string; revenue: number; paymentCount: number }[];
};

const PLAN_LABEL: Record<string, string> = { premium: "Premium", family: "Family" };

function formatWon(n: number): string {
  return `₩${n.toLocaleString()}`;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }
    authedFetch("/api/billing/dashboard")
      .then((res) => {
        if (res.status === 401) { setForbidden(true); return Promise.reject(401); }
        return res.ok ? res.json() : Promise.reject(res.status);
      })
      .then((body) => setData(body))
      .catch(() => setError("데이터를 불러오지 못했어요."));
  }, []);

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

  if (forbidden) {
    return (
      <main className="wrap">
        <div className="card center"><h2>관리자만 접근할 수 있어요</h2></div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="wrap">
        <div className="card center"><h2>{error}</h2></div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="wrap">
        <p className="muted">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <p><Link href="/">← 홈으로</Link></p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="card">
          <div className="tab">이번달 매출</div>
          <h2>{formatWon(data.summary.monthRevenue)}</h2>
        </div>
        <div className="card">
          <div className="tab">유료 구독자 수</div>
          <h2>{data.summary.payingCustomers.toLocaleString()}명</h2>
        </div>
        <div className="card">
          <div className="tab">이탈률 (이번 달)</div>
          <h2>{formatPct(data.summary.churnRate)}</h2>
        </div>
        <div className="card">
          <div className="tab">이번달 신규 결제</div>
          <h2>{data.summary.newPaymentsThisMonth.toLocaleString()}건</h2>
        </div>
      </div>

      <div className="card">
        <div className="tab">요금제별 현황</div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--grid-line)" }}>
              <th style={{ padding: "6px 4px" }}>요금제</th>
              <th style={{ padding: "6px 4px" }}>고객 수</th>
              <th style={{ padding: "6px 4px" }}>비율</th>
              <th style={{ padding: "6px 4px" }}>이탈률 (이번 달)</th>
            </tr>
          </thead>
          <tbody>
            {data.byPlan.map((row) => (
              <tr key={row.plan} style={{ borderBottom: "1px solid var(--grid-line)" }}>
                <td style={{ padding: "6px 4px" }}>{PLAN_LABEL[row.plan] ?? row.plan}</td>
                <td style={{ padding: "6px 4px" }}>{row.customerCount.toLocaleString()}명</td>
                <td style={{ padding: "6px 4px" }}>{row.sharePct.toFixed(1)}%</td>
                <td style={{ padding: "6px 4px" }}>{formatPct(row.churnRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="tab">최근 6개월 매출 추이</div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--grid-line)" }}>
              <th style={{ padding: "6px 4px" }}>월</th>
              <th style={{ padding: "6px 4px" }}>매출</th>
              <th style={{ padding: "6px 4px" }}>결제 건수</th>
            </tr>
          </thead>
          <tbody>
            {data.revenueTrend.length === 0 ? (
              <tr><td colSpan={3} className="muted" style={{ padding: "10px 4px" }}>결제 내역이 없어요.</td></tr>
            ) : (
              data.revenueTrend.map((row) => (
                <tr key={row.month} style={{ borderBottom: "1px solid var(--grid-line)" }}>
                  <td style={{ padding: "6px 4px" }}>{formatMonth(row.month)}</td>
                  <td style={{ padding: "6px 4px" }}>{formatWon(row.revenue)}</td>
                  <td style={{ padding: "6px 4px" }}>{row.paymentCount.toLocaleString()}건</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
