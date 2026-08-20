import { test } from "node:test";
import assert from "node:assert/strict";
import { CHANNELS_BY_TYPE, buildActionLinkHtml, type NotificationType } from "./notify";

test("모든 알림 타입은 최소 email 채널을 포함한다", () => {
  const types = Object.keys(CHANNELS_BY_TYPE) as NotificationType[];
  assert.ok(types.length > 0);
  for (const type of types) {
    assert.ok(CHANNELS_BY_TYPE[type].includes("email"), `${type}에 email이 없음`);
  }
});

test("payment_failed와 child_chat_flagged만 sms를 포함한다 — 자가 해결 가능하고 시급한 이벤트만 SMS로 감(2026-08-20 결정)", () => {
  const types = Object.keys(CHANNELS_BY_TYPE) as NotificationType[];
  for (const type of types) {
    const hasSms = CHANNELS_BY_TYPE[type].includes("sms");
    const shouldHaveSms = type === "payment_failed" || type === "child_chat_flagged";
    assert.equal(hasSms, shouldHaveSms, `${type}의 sms 포함 여부가 예상과 다름 — 의도한 변경이면 이 테스트도 갱신할 것`);
  }
});

test("email만 있는 타입은 채널이 정확히 1개다", () => {
  const emailOnlyTypes: NotificationType[] = [
    "payment_success",
    "payment_activation_failed",
    "subscription_canceled",
    "family_member_added",
    "family_member_removed",
  ];
  for (const type of emailOnlyTypes) {
    assert.deepEqual(CHANNELS_BY_TYPE[type], ["email"]);
  }
});

test("actionUrl이 없으면 링크 HTML도 빈 문자열", () => {
  assert.equal(buildActionLinkHtml(undefined, "https://makerstudio.example"), "");
});

test("상대 경로 actionUrl은 appUrl을 앞에 붙인다", () => {
  const html = buildActionLinkHtml("/mypage/billing", "https://makerstudio.example");
  assert.ok(html.includes('href="https://makerstudio.example/mypage/billing"'));
});

test("절대 URL(http로 시작)이면 appUrl을 무시하고 그대로 쓴다", () => {
  const html = buildActionLinkHtml("https://other.example/x", "https://makerstudio.example");
  assert.ok(html.includes('href="https://other.example/x"'));
  assert.ok(!html.includes("makerstudio.example"));
});

test("appUrl이 설정 안 되어 있으면(undefined) 상대 경로만 그대로 남는다", () => {
  const html = buildActionLinkHtml("/mypage/billing", undefined);
  assert.ok(html.includes('href="/mypage/billing"'));
});
