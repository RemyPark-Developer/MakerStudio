import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * 브라우저 전용 Supabase 클라이언트 (anon key).
 *
 * `lib/supabase/server.ts`의 `getSupabaseServerClient()`(service_role 싱글턴)와는 완전히
 * 다른 목적 — 그쪽은 세션을 바꾸는 메서드를 호출하면 안 되는 서버 싱글턴이지만, 이 클라이언트는
 * 브라우저에서 OAuth 리다이렉트(`signInWithOAuth`)와 그 결과 세션을 다루는 게 원래 용도라
 * 탭당 하나의 싱글턴이어도 안전하다. anon key는 공개돼도 안전하게 설계된 키라 브라우저에
 * 노출해도 된다(`.env.local.example` 참고).
 */
let _client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다. .env.local을 확인하세요."
    );
  }

  _client = createClient(url, anonKey, {
    auth: { flowType: "pkce", detectSessionInUrl: true },
  });
  return _client;
}
