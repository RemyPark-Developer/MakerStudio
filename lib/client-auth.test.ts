import { test } from "node:test";
import assert from "node:assert/strict";
import { authedFetch } from "./client-auth";

// authedFetch/lib/client-auth.ts는 브라우저 전역(localStorage, fetch)을 그대로 참조하므로,
// Node 테스트 환경에서 그 전역을 흉내내서 주입한다.

function makeMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    _dump: () => Object.fromEntries(store),
  };
}

test("동시에 여러 요청이 401을 받아도, 토큰 갱신 API는 딱 한 번만 호출된다 (경쟁조건 회귀 테스트)", async () => {
  const storage = makeMockStorage();
  storage.setItem("ms_access_token", "old-token");
  storage.setItem("ms_refresh_token", "valid-refresh-token");
  (global as any).localStorage = storage;

  let refreshCallCount = 0;

  (global as any).fetch = async (url: string, opts: any) => {
    if (url === "/api/identity/refresh") {
      refreshCallCount++;
      // 실제 네트워크처럼 약간의 지연을 줘서, 동시 호출이 겹칠 여지를 일부러 만든다.
      await new Promise((r) => setTimeout(r, 20));
      return new Response(
        JSON.stringify({ accessToken: "new-token", refreshToken: "new-refresh-token" }),
        { status: 200 }
      );
    }

    // 보호된 엔드포인트: "new-token"으로 인증했을 때만 성공, 그 외(old-token 등)는 401.
    const auth = opts?.headers?.Authorization ?? "";
    if (auth === "Bearer new-token") {
      return new Response(JSON.stringify({ ok: true, endpoint: url }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  };

  // 마이페이지가 하는 것과 동일하게, 두 개의 보호된 엔드포인트를 "동시에" 호출한다.
  const [resA, resB] = await Promise.all([
    authedFetch("/api/learning/progress"),
    authedFetch("/api/learning/code"),
  ]);

  assert.equal(resA.status, 200, "요청 A는 결국 성공해야 함 (갱신된 토큰으로 재시도)");
  assert.equal(resB.status, 200, "요청 B도 결국 성공해야 함 (갱신된 토큰으로 재시도)");
  assert.equal(refreshCallCount, 1, "동시에 두 요청이 401을 받아도 갱신 API 호출은 1번만 일어나야 함");
  assert.equal(storage.getItem("ms_access_token"), "new-token", "새 토큰이 저장되어 있어야 함(지워지면 안 됨)");
});
