import { NextRequest, NextResponse } from "next/server";
import { startChildSignup } from "@/lib/identity/childSignup";

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

  // TODO(Phase 3 실연동): 실제 SMS 발송 서비스(예: 알리고, NHN Cloud, Twilio)로 교체.
  // 지금은 개발 편의를 위해 서버 로그로만 남김 — smsCode를 응답 바디에 절대 포함하지 않는다.
  console.log(`[SMS 발송 예정 — 실제 연동 전] ${guardianPhone} -> 인증코드: ${smsCode}`);

  return NextResponse.json({ verifyToken });
}
