import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * 관리자 대시보드 — 매출·구독자·이탈률 집계. 전부 supabase/migrations/0033의 뷰에서 원시
 * 카운트만 가져오고, 비율·이탈률 계산은 여기 한 곳에서만 한다(검증하기 쉽게, 정확성 우선).
 *
 * ⚠️ 0033의 뷰들은 authenticated/anon에 GRANT가 없다(view가 소유자 권한으로 실행되어 RLS를
 * 우회하기 때문 — 마이그레이션 파일 주석 참고) — 반드시 이 라우트처럼 admin 확인 후
 * service_role로만 조회할 것.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();

  const [revenueRes, customersRes, churnRes] = await Promise.all([
    supabase
      .from("admin_monthly_revenue")
      .select("month, revenue, payment_count")
      .gte("month", new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString())
      .order("month", { ascending: true }),
    supabase.from("admin_plan_customers").select("plan, customer_count"),
    supabase.from("admin_plan_churn").select("plan, active_count, canceled_this_period"),
  ]);

  if (revenueRes.error || customersRes.error || churnRes.error) {
    return NextResponse.json(
      { error: "server_error", message: "집계 데이터를 불러오지 못했어요." },
      { status: 500 }
    );
  }

  const revenueTrend = (revenueRes.data ?? []).map((r) => ({
    month: r.month,
    revenue: r.revenue,
    paymentCount: r.payment_count,
  }));

  const customerByPlan = new Map((customersRes.data ?? []).map((c) => [c.plan, c.customer_count]));
  const churnByPlan = new Map(
    (churnRes.data ?? []).map((c) => [c.plan, { active: c.active_count, canceled: c.canceled_this_period }])
  );

  const totalCustomers = [...customerByPlan.values()].reduce((sum, n) => sum + n, 0);

  function churnRate(plan: string): number {
    const c = churnByPlan.get(plan);
    if (!c) return 0;
    const base = c.active + c.canceled;
    return base === 0 ? 0 : c.canceled / base;
  }

  const byPlan = ["premium", "family"].map((plan) => {
    const customerCount = customerByPlan.get(plan) ?? 0;
    return {
      plan,
      customerCount,
      sharePct: totalCustomers === 0 ? 0 : (customerCount / totalCustomers) * 100,
      churnRate: churnRate(plan),
    };
  });

  const totalActive = [...churnByPlan.values()].reduce((sum, c) => sum + c.active, 0);
  const totalCanceledThisPeriod = [...churnByPlan.values()].reduce((sum, c) => sum + c.canceled, 0);
  const overallChurnRate =
    totalActive + totalCanceledThisPeriod === 0
      ? 0
      : totalCanceledThisPeriod / (totalActive + totalCanceledThisPeriod);

  // DB(date_trunc)는 UTC 기준으로 월을 끊으므로, 여기서도 로컬 타임존이 아니라 UTC로
  // "이번 달"을 계산해야 서버 실행 위치와 무관하게 정확히 같은 달을 가리킨다.
  const now = new Date();
  const thisMonthUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const thisMonth = revenueTrend.find((r) => new Date(r.month).getTime() === thisMonthUtc);

  return NextResponse.json({
    summary: {
      monthRevenue: thisMonth?.revenue ?? 0,
      payingCustomers: totalCustomers,
      churnRate: overallChurnRate,
      newPaymentsThisMonth: thisMonth?.paymentCount ?? 0,
    },
    byPlan,
    revenueTrend,
  });
});
