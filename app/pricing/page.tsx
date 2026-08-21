import Link from "next/link";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { WaitlistForm } from "./WaitlistForm";

export const metadata = {
  title: "가격 정책 | MakerStudio",
};

// Family는 처음부터 최대 3명이 기본 캡(0014_family_groups.sql의 seat_limit default 3) —
// "자녀 3명 기준" 절약액은 실제 PLAN_PRICES에서 계산한 값이라 가격이 바뀌어도 항상 정확하다.
// 가짜 정가를 만들어 취소선을 긋는 것이 아니라, 실제 두 요금제 가격을 그대로 비교한 것.
const FAMILY_MAX_MEMBERS = 3;
const individualCostForFamilySize = PLAN_PRICES.premium * FAMILY_MAX_MEMBERS;
const familySavings = individualCostForFamilySize - PLAN_PRICES.family;
const familySavingsPct = Math.round((familySavings / individualCostForFamilySize) * 100);

export default function PricingPage() {
  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <p><Link href="/">← 홈으로</Link></p>

      <div style={{ textAlign: "center", margin: "24px 0 32px" }}>
        <h1>가격 정책</h1>
        <p className="muted">
          가짜 정가도, 사전 체크된 옵션도, 긴급성 카피도 없어요 — 원화(₩)로 있는 그대로
          보여드려요.
        </p>
      </div>

      <p className="muted center" style={{ marginBottom: 20 }}>
        Free로도 진짜 배울 수 있어요 — 신용카드 없이 지금 바로 시작 가능(AI 튜터 하루 10회
        포함, ₩{PLAN_PRICES.free.toLocaleString()}).
      </p>

      {/* Premium — 메인 요금제 */}
      <div className="card" style={{ borderColor: "var(--coral)", borderWidth: 2 }}>
        <div className="tab coral">Premium 개인</div>
        <h2>₩{PLAN_PRICES.premium.toLocaleString()} / 월</h2>
        <p className="muted" style={{ fontSize: 13 }}>자녀 1명 또는 성인 개인 계정 기준</p>
        <ul style={{ marginTop: 14, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
          <li>모든 콘텐츠 잠금 해제</li>
          <li>AI 튜터 무제한 질문</li>
          <li>진도·배지 저장</li>
        </ul>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          언제든 해지할 수 있고, 해지해도 남은 기간은 계속 이용할 수 있어요.
        </p>
        <Link href="/signup" className="btn btnCoral" style={{ marginTop: 14, display: "inline-block" }}>
          무료로 시작하기 →
        </Link>
      </div>

      {/* Family — 보조 요금제 */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="tab">Family (최대 {FAMILY_MAX_MEMBERS}명)</div>
        <h2>₩{PLAN_PRICES.family.toLocaleString()} / 월</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          자녀 {FAMILY_MAX_MEMBERS}명까지 한 가격 — 인원수별 계단 요금 없음
        </p>
        <p style={{ fontSize: 13.5, marginTop: 10 }}>
          자녀 {FAMILY_MAX_MEMBERS}명을 각자 Premium으로 구독하면 ₩
          {individualCostForFamilySize.toLocaleString()}/월인데, Family는 ₩
          {PLAN_PRICES.family.toLocaleString()}/월 — 월 ₩{familySavings.toLocaleString()}
          (약 {familySavingsPct}%) 절약돼요.
        </p>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          자녀별 진도·배지는 완전히 분리돼요. 언제든 해지할 수 있고, 해지해도 남은 기간은
          계속 이용할 수 있어요.
        </p>
        <Link href="/checkout?plan=family" className="btn btnOutline" style={{ marginTop: 14, display: "inline-block" }}>
          Family 시작하기
        </Link>
      </div>

      {/* 출시 알림 신청 — 결제 CTA와 명확히 분리 */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="tab">출시 알림 신청</div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          앞으로 새로운 요금제나 콘텐츠 소식이 생기면 이메일로 알려드릴게요. 결제와는 무관해요.
        </p>
        <WaitlistForm />
      </div>
    </main>
  );
}
