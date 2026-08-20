import { getSupabaseServerClient } from "../supabase/server";
import { sendNotificationEmail } from "../email/resend";
import { sendNotificationSms } from "../sms/solapi";

export type NotificationType =
  | "payment_success"
  | "payment_activation_failed"
  | "payment_failed"
  | "subscription_canceled"
  | "family_member_added"
  | "family_member_removed"
  | "child_chat_flagged";

export type Channel = "email" | "sms";

/**
 * 이벤트 타입별 발송 채널(복수 가능). `payment_failed`/`child_chat_flagged`만 email+sms —
 * 자가 해결 가능하고(재시도, 대화 확인) 시간이 지날수록 아쉬운 이벤트라 SMS까지 보낸다.
 * 나머지는 guardian 본인이 방금 한 행동의 확인이거나(구독 해지, Family 멤버 변경) 급하지
 * 않은 완료 알림이라 email만으로 충분하다고 판단(2026-08-20 설계 결정).
 *
 * SMS는 guardian이 `app/mypage/settings`에서 전화번호를 직접 입력해야 나간다(0018
 * 마이그레이션 전에는 이 컬럼 자체가 없었음) — 안 채웠으면 delivery_status가 'skipped'로
 * 기록되고 email만 감.
 */
export const CHANNELS_BY_TYPE: Record<NotificationType, Channel[]> = {
  payment_success: ["email"],
  payment_activation_failed: ["email"],
  payment_failed: ["email", "sms"],
  subscription_canceled: ["email"],
  family_member_added: ["email"],
  family_member_removed: ["email"],
  child_chat_flagged: ["email", "sms"],
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

async function dispatchEmail(supabase: ReturnType<typeof getSupabaseServerClient>, notificationId: string, input: NotifyGuardianInput) {
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
      .eq("id", notificationId);
  } catch (err) {
    console.error("알림 이메일 발송 실패:", err);
    await supabase.from("notifications").update({ delivery_status: "failed" }).eq("id", notificationId);
  }
}

async function dispatchSms(supabase: ReturnType<typeof getSupabaseServerClient>, notificationId: string, input: NotifyGuardianInput) {
  const { data: profile } = await supabase.from("profiles").select("phone").eq("id", input.guardianId).maybeSingle();
  const phone = profile?.phone;

  if (!phone) {
    // 전화번호를 안 넣은 guardian — 발송 시도조차 안 함. '실패'가 아니라 '건너뜀'.
    await supabase.from("notifications").update({ delivery_status: "skipped" }).eq("id", notificationId);
    return;
  }

  try {
    // SMS는 90바이트 넘으면 LMS로 자동 전환돼 비용이 오르므로 링크 없이 message만 보낸다.
    await sendNotificationSms(phone, input.message);

    await supabase
      .from("notifications")
      .update({ delivery_status: "sent", delivered_at: new Date().toISOString() })
      .eq("id", notificationId);
  } catch (err) {
    console.error("알림 SMS 발송 실패:", err);
    await supabase.from("notifications").update({ delivery_status: "failed" }).eq("id", notificationId);
  }
}

/**
 * billing/family/learning 도메인이 직접 호출하는 notifications 도메인의 공개 함수.
 * 이 저장소엔 이벤트 버스가 없어서(activateSubscription/activateFamilyGroup도
 * 순수 함수 호출로 연결됨) 이것도 같은 패턴 — 호출부는 이 함수 내부(수신자 조회,
 * 발송 채널 결정, 실패 처리)를 몰라도 된다.
 *
 * `CHANNELS_BY_TYPE[type]`의 채널마다 `notifications` row를 하나씩 만든다(정규화된 별도
 * "발송 시도" 테이블 대신 기존 스키마를 재사용하는 의도적 단순화 — 2026-08-20 설계 결정,
 * dual-channel 이벤트가 2종뿐이라 인앱 알림함에 row가 살짝 중복되는 정도는 감수함).
 *
 * 채널 발송이 전부 실패해도 {ok:true}를 반환한다 — 이 함수를 부르는 시점엔 결제 활성화
 * 같은 도메인 로직이 이미 끝난 뒤라 여기서 실패했다고 그 결과를 되돌리면 안 된다(webhook이
 * activateSubscription 실패를 console.error만 하고 계속 진행하는 것과 동일한 층위).
 */
export async function notifyGuardian(input: NotifyGuardianInput): Promise<NotifyGuardianResult> {
  const supabase = getSupabaseServerClient();
  const channels = CHANNELS_BY_TYPE[input.type];

  const failures: string[] = [];

  for (const channel of channels) {
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
      failures.push(`notifications(${channel}) 저장 실패: ${insertError?.message}`);
      continue;
    }

    if (channel === "email") {
      await dispatchEmail(supabase, row.id, input);
    } else {
      await dispatchSms(supabase, row.id, input);
    }
  }

  if (failures.length === channels.length) {
    return { ok: false, reason: failures.join("; ") };
  }

  return { ok: true };
}
