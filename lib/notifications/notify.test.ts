import { test } from "node:test";
import assert from "node:assert/strict";
import { CHANNEL_BY_TYPE, buildActionLinkHtml, type NotificationType } from "./notify";

test("모든 알림 타입은 지금 전부 email 채널이다 — guardian 연락처(휴대폰)가 DB에 없어서 SMS는 아직 못 씀", () => {
  const types = Object.keys(CHANNEL_BY_TYPE) as NotificationType[];
  assert.ok(types.length > 0);
  for (const type of types) {
    assert.equal(CHANNEL_BY_TYPE[type], "email", `${type}이 email이 아님 — 의도한 변경이면 이 테스트도 갱신할 것`);
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
