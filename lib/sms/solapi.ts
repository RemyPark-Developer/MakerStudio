import { SolapiMessageService } from "solapi";

/**
 * 실제 문자 발송 (Solapi 연동).
 * 짝 문서: docs/MakerStudio_Auth_Flow_v1.0.md §2.3
 *
 * ⚠️ 이전 버전은 콘솔 로그만 찍고 "보냈다"고 화면에 알려주는 거짓 성공이었음
 * (2026-08-13 발견·수정). 지금은 설정이 안 되어 있으면 명확히 에러를 던져서,
 * 호출부가 사용자에게 "발송 실패"를 정직하게 알리도록 강제한다.
 */

let _service: SolapiMessageService | null = null;

function getService(): SolapiMessageService {
  if (_service) return _service;

  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "SOLAPI_API_KEY / SOLAPI_API_SECRET이 설정되지 않았어요. " +
        ".env.local에 Solapi 콘솔(solapi.com)에서 발급받은 키를 넣어주세요."
    );
  }

  _service = new SolapiMessageService(apiKey, apiSecret);
  return _service;
}

export async function sendVerificationSms(to: string, code: string): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  if (!senderNumber) {
    throw new Error(
      "SOLAPI_SENDER_NUMBER가 설정되지 않았어요. Solapi에 등록된 발신번호를 .env.local에 넣어주세요."
    );
  }

  const service = getService();
  const result = await service.send({
    to: to.replace(/-/g, ""), // Solapi는 하이픈 없는 형식을 요구
    from: senderNumber,
    text: `[MakerStudio] 보호자 인증번호는 [${code}]입니다. 10분 안에 입력해주세요.`,
  });

  // Solapi는 그룹 단위 응답을 반환 — 실패 건수가 있으면 성공으로 취급하지 않는다.
  const failed = (result as any)?.failedMessageList ?? [];
  if (Array.isArray(failed) && failed.length > 0) {
    throw new Error(`SMS 발송 실패: ${JSON.stringify(failed[0])}`);
  }
}
