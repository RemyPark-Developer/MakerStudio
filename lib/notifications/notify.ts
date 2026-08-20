import { getSupabaseServerClient } from "../supabase/server";
import { sendNotificationEmail } from "../email/resend";

export type NotificationType =
  | "payment_success"
  | "payment_activation_failed"
  | "payment_failed"
  | "subscription_canceled"
  | "family_member_added"
  | "family_member_removed"
  | "child_chat_flagged";

/**
 * 이벤트 타입별 발송 채널. 지금은 전부 email — SMS는 guardian 연락처가 DB에 영구
 * 저장되지 않아서(초등학생 가입 때 guardianPhone은 SMS 인증에만 쓰이고 버려짐) 이번
 * 범위에서 제외했다. profiles에 연락처 컬럼이 생기고 Solapi가 프로덕션 설정되면
 * 여기 값만 'sms'로 바꾸면 된다.
 */
export const CHANNEL_BY_TYPE: Record<NotificationType, "email" | "sms"> = {
  payment_success: "email",
  payment_activation_failed: "email",
  payment_failed: "email",
  subscription_canceled: "email",
  family_member_added: "email",
  family_member_removed: "email",
  child_chat_flagged: "email",
};

const SUBJECT_BY_TYPE: Record<NotificationType, string> = {
  payment_success: "결제가 완료됐어요",
  payment_activation_failed: "결제 처리 중 문제가 발생했어요",
  payment_failed: "결제에 실패했어요",
  subscription_canceled: "구독이 해지됐어요",
  family_member_added: "Family 그룹에 아이가 추가됐어요",
  family_member_removed: "Family 그룹에서 아이가 제거됐어요",
  child_chat_flagged: "자녀의 AI 튜터 대화에서 확인이 필요한 내용이 있어요",
};

export type NotifyGuardianInput = {
  guardianId: string;
  type: NotificationType;
  message: string;
  actionUrl?: string;
};

export type NotifyGuardianResult = { ok: true } | { ok: false; reason: string };

/**
 * actionUrl이 절대 URL(http로 시작)이면 그대로, 상대 경로면 appUrl을 붙여서 메일에 넣을
 * 링크 HTML을 만든다. actionUrl이 없으면 빈 문자열.
 */
export function buildActionLinkHtml(actionUrl: string | undefined, appUrl: string | undefined): string {
  if (!actionUrl) return "";
  const href = actionUrl.startsWith("http") ? actionUrl : `${appUrl ?? ""}${actionUrl}`;
  return `<p><a href="${href}">자세히 보기</a></p>`;
}

/**
 * billing/family 도메인이 직접 호출하는 notifications 도메인의 공개 함수.
 * 이 저장소엔 이벤트 버스가 없어서(activateSubscription/activateFamilyGroup도
 * 순수 함수 호출로 연결됨) 이것도 같은 패턴 — 호출부는 이 함수 내부(수신자 조회,
 * 발송 채널 결정, 실패 처리)를 몰라도 된다.
 *
 * 이메일 발송이 실패해도 {ok:true}를 반환한다 — 인앱 알림 row는 이미 만들어졌고,
 * 이 함수를 부르는 시점엔 결제 활성화 같은 도메인 로직이 이미 끝난 뒤라 여기서
 * 실패했다고 그 결과를 되돌리면 안 된다(webhook이 activateSubscription 실패를
 * console.error만 하고 계속 진행하는 것과 동일한 층위).
 */
export async function notifyGuardian(input: NotifyGuardianInput): Promise<NotifyGuardianResult> {
  const supabase = getSupabaseServerClient();
  const channel = CHANNEL_BY_TYPE[input.type];

  const { data: row, error: insertError } = await supabase
    .from("notifications")
    .insert({
      user_id: input.guardianId,
      type: input.type,
      message: input.message,
      action_url: input.actionUrl ?? null,
      channel,
      delivery_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return { ok: false, reason: `notifications 저장 실패: ${insertError?.message}` };
  }

  if (channel === "email") {
    try {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(input.guardianId);
      const email = userData?.user?.email;
      if (userError || !email) {
        throw new Error(`guardian 이메일 조회 실패: ${userError?.message ?? "이메일 없음"}`);
      }

      const link = buildActionLinkHtml(input.actionUrl, process.env.NEXT_PUBLIC_APP_URL);
      await sendNotificationEmail(email, SUBJECT_BY_TYPE[input.type], `<p>${input.message}</p>${link}`);

      await supabase
        .from("notifications")
        .update({ delivery_status: "sent", delivered_at: new Date().toISOString() })
        .eq("id", row.id);
    } catch (err) {
      console.error("알림 이메일 발송 실패:", err);
      await supabase.from("notifications").update({ delivery_status: "failed" }).eq("id", row.id);
    }
  }

  return { ok: true };
}
