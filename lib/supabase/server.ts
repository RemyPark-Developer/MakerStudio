import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트.
 * SUPABASE_SERVICE_ROLE_KEY는 RLS를 우회하는 강력한 키라 서버 코드에서만 쓰고,
 * 절대 클라이언트(브라우저)로 내려보내지 않습니다.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. .env.local을 확인하세요."
    );
  }

  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

/**
 * ⚠️ 매 호출마다 새 인스턴스를 만든다 — 절대 싱글턴으로 캐싱하지 말 것.
 *
 * `signInWithPassword`/`refreshSession`/`updateUser`/`verifyOtp`처럼 클라이언트
 * 인스턴스의 세션 상태를 바꾸는 인증 메서드는 `getSupabaseServerClient()`(service_role
 * 싱글턴)에서 절대 호출하면 안 된다 — `persistSession: false`여도 메모리상 현재
 * 세션은 그대로 바뀌어서, 그 순간부터 이 서버 프로세스가 살아있는 동안 그 사용자의
 * 권한으로 영구히 고정된다(2026-08-21 발견: 로그인 한 번 이후 RLS가 서비스 권한이
 * 아니라 그 사용자 권한으로 걸려서 이후 모든 요청에서 콘텐츠가 안 보이는 버그로
 * 드러남 — `app/api/identity/login`, `refresh`, `password/reset`, `password/forgot`
 * 4개 라우트가 이 함수를 대신 써야 함).
 *
 * 이 클라이언트는 anon key로 만든다 — 로그인/토큰갱신/비밀번호변경은 원래 브라우저가
 * anon key로 직접 하는 작업이라 service_role 권한이 필요 없고, 최소 권한 원칙에도 맞다.
 */
export function createSupabaseAuthClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_ANON_KEY가 설정되지 않았습니다. .env.local을 확인하세요."
    );
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
