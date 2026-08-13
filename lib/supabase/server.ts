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
