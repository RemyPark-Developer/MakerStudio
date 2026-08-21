import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * /pricing 하단 "출시 알림 신청". 로그인 불필요 — 비로그인 방문자가 주 대상.
 * marketingConsent는 정보통신망법 제50조 마케팅 정보 수신 별도 동의 — 기본 false,
 * 프론트엔드도 이 체크박스를 절대 사전 체크하지 않는다(다크패턴 금지 원칙).
 */
const BodySchema = z.object({
  email: z.string().email(),
  marketingConsent: z.boolean().optional().default(false),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "올바른 이메일 주소를 입력해주세요." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  // 재제출은 에러가 아니라 갱신으로 처리 — 마케팅 동의를 나중에 바꿔 다시 제출해도 자연스럽다.
  const { error } = await supabase.from("waitlist_emails").upsert(
    {
      email: parsed.data.email,
      marketing_consent: parsed.data.marketingConsent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );

  if (error) {
    return NextResponse.json(
      { error: "server_error", message: "신청에 실패했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
});
