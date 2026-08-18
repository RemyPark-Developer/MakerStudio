/**
 * 인증이 필요한 API를 호출하는 공용 함수.
 * 액세스 토큰이 만료돼 401이 오면, 저장해둔 refreshToken으로 자동 갱신 후 한 번 재시도한다.
 * 2026-08-13 실사용자 테스트 중 발견된 "로그인했는데 1시간 뒤 로그인 필요하다고 뜨는" 문제의 수정.
 *
 * ⚠️ 2026-08-13 추가 수정: 같은 화면에서 여러 요청이 동시에 401을 받으면(예: 마이페이지가
 * 진도+저장코드를 동시에 요청), 각자 따로 갱신을 시도하다가 서로의 결과를 덮어써서
 * "방금 성공한 갱신이 곧바로 무효화되는" 경쟁 조건이 있었다. 진행 중인 갱신이 있으면
 * 새로 시작하지 않고 그 결과를 같이 기다리는 방식(단일 진행 중 프라미스 공유)으로 고쳤다.
 */

let refreshInFlight: Promise<string | null> | null = null;

export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = localStorage.getItem("ms_access_token");

  const doFetch = (token: string | null) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  if (!accessToken) {
    // 토큰 자체가 없으면 굳이 요청 안 보내고 바로 401 흉내 — 호출부가 로그인 유도 UI를 보여줄 수 있게.
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch(refreshed);
    }
  }

  return res;
}

function tryRefresh(): Promise<string | null> {
  // 이미 갱신이 진행 중이면, 새로 요청하지 않고 그 결과를 같이 기다린다.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem("ms_refresh_token");
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/identity/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      // 리프레시 토큰마저 만료됐으면 로그인 정보를 지워서 다음에 확실히 로그인 화면으로 가게 한다.
      localStorage.removeItem("ms_access_token");
      localStorage.removeItem("ms_refresh_token");
      return null;
    }
    const data = await res.json();
    localStorage.setItem("ms_access_token", data.accessToken);
    localStorage.setItem("ms_refresh_token", data.refreshToken);
    return data.accessToken as string;
  } catch {
    // 네트워크 에러 등으로 refresh 자체가 실패해도 무효 토큰을 남겨두면 login↔mypage 무한루프가 생긴다.
    localStorage.removeItem("ms_access_token");
    localStorage.removeItem("ms_refresh_token");
    return null;
  }
}
