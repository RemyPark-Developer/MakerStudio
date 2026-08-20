import { Resend } from "resend";

/**
 * 실제 이메일 발송 (Resend 연동).
 * 짝 문서: 2026-08-14 "회원가입 시 이메일 실제 소유 확인" 결정.
 *
 * lib/sms/solapi.ts와 동일한 원칙 — 설정이 안 되어 있으면 명확히 실패한다.
 * "인증 메일을 보냈어요"라고 화면에 말해놓고 실제로는 안 보내는 거짓 성공을 만들지 않는다.
 */

let _client: Resend | null = null;

function getClient(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY가 설정되지 않았어요. resend.com에서 발급받은 키를 .env.local에 넣어주세요."
    );
  }
  _client = new Resend(apiKey);
  return _client;
}

export async function sendVerificationEmail(to: string, confirmUrl: string): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL이 설정되지 않았어요. Resend에 등록한 발신 도메인 주소를 넣어주세요.");
  }

  const client = getClient();
  const { error } = await client.emails.send({
    from,
    to,
    subject: "[MakerStudio] 이메일 주소를 확인해주세요",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <h2>MakerStudio 가입을 환영해요!</h2>
        <p>아래 버튼을 눌러 이메일 주소를 확인해주세요. 확인 전까지는 로그인이 제한돼요.</p>
        <a href="${confirmUrl}" style="display:inline-block;background:#EE8B6A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">이메일 확인하기</a>
        <p style="color:#888;font-size:12px;margin-top:20px">본인이 가입하지 않으셨다면 이 메일을 무시해주세요.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`이메일 발송 실패: ${JSON.stringify(error)}`);
  }
}

/** notifications 도메인(lib/notifications/notify.ts)이 사용하는 범용 알림 메일. */
export async function sendNotificationEmail(to: string, subject: string, bodyHtml: string): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL이 설정되지 않았어요. Resend에 등록한 발신 도메인 주소를 넣어주세요.");
  }

  const client = getClient();
  const { error } = await client.emails.send({
    from,
    to,
    subject: `[MakerStudio] ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px">
        ${bodyHtml}
      </div>
    `,
  });

  if (error) {
    throw new Error(`이메일 발송 실패: ${JSON.stringify(error)}`);
  }
}
