import { NextRequest, NextResponse } from "next/server";
import { startChildSignup } from "@/lib/identity/childSignup";
import { sendVerificationSms } from "@/lib/sms/solapi";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nickname: string | undefined = body?.nickname?.trim();
  const guardianPhone: string | undefined = body?.guardianPhone?.trim();

  if (!nickname || nickname.length > 10) {
    return NextResponse.json(
      { error: "invalid_request", message: "닉네임은 1~10자로 입력해주세요.", field: "nickname" },
      { status: 400 }
    );
  }
  if (!guardianPhone || !/^01[0-9]-?\d{3,4}-?\d{4}$/.test(guardianPhone)) {
    return NextResponse.json(
      { error: "invalid_request", message: "보호자 휴대폰번호 형식을 확인해주세요.", field: "guardianPhone" },
      { status: 400 }
    );
  }

  const { verifyToken, smsCode } = startChildSignup(nickname, guardianPhone);

  // ⚠️ 실제로 문자를 보내고, 실패하면 성공한 척하지 않는다 (2026-08-13 정정).
  try {
    await sendVerificationSms(guardianPhone, smsCode);
  } catch (err) {
    console.error("SMS 발송 실패:", err);
    return NextResponse.json(
      {
        error: "sms_send_failed",
        message: "인증번호 발송에 실패했어요. 번호를 확인하거나 잠시 후 다시 시도해주세요.",
      },
      { status: 502 } // 502: 우리 서버가 의존하는 외부 서비스(Solapi)가 실패했다는 뜻
    );
  }

  return NextResponse.json({ verifyToken });
}
