import { test } from "node:test";
import assert from "node:assert/strict";
import { gateExample } from "./gate";
import type { Example } from "../schema";

const freeExample: Example = {
  id: "blink",
  icon: "💡",
  label: "Blink",
  board: "Arduino UNO",
  difficulty: 1,
  estimatedMinutes: 20,
  pin: "D13",
  intro: "인트로",
  parts: ["Arduino UNO"],
  code: "void setup(){}",
  codeFilename: "blink.ino",
  explain: "설명",
  mission: "미션",
  quiz: { question: "q", options: ["a", "b"], answer: 0, explain: "e" },
  isPremium: false,
};

const premiumExample: Example = { ...freeExample, id: "ultrasonic", isPremium: true };

test("무료 콘텐츠는 로그인 안 해도 code/explain이 그대로 포함된다", async () => {
  const result = await gateExample(freeExample, null);
  assert.equal(result.locked, false);
  assert.ok("code" in result && result.code === freeExample.code);
});

test("Premium 콘텐츠는 로그인 안 하면 잠기고, code/explain/quiz 필드가 응답에 아예 없다", async () => {
  const result = await gateExample(premiumExample, null);
  assert.equal(result.locked, true);
  assert.ok(!("code" in result));
  assert.ok(!("explain" in result));
  assert.ok(!("quiz" in result), "quiz도 정답을 포함하므로 잠긴 콘텐츠에선 제거되어야 함");
});

test("Premium 콘텐츠는 로그인은 했지만 구독 확인이 안 되면(=Supabase 미연결) 잠긴다 — fail-closed", async () => {
  const fakeUser = { id: "test-user-id", role: "student_teen" as const, nickname: "테스트" };
  const result = await gateExample(premiumExample, fakeUser);
  // 지금 테스트 환경엔 SUPABASE_URL이 없으므로 hasPremiumAccess는 반드시 false를 반환해야 한다.
  assert.equal(result.locked, true);
  assert.ok(!("code" in result));
  assert.ok(!("quiz" in result));
});

test("잠긴 응답에도 intro/parts/mission 같은 미리보기 정보는 그대로 남아있다", async () => {
  const result = await gateExample(premiumExample, null);
  assert.equal(result.locked, true);
  assert.ok("intro" in result && result.intro === premiumExample.intro);
  assert.ok("mission" in result && result.mission === premiumExample.mission);
});
