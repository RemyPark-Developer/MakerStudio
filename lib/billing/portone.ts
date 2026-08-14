import { PaymentClient } from "@portone/server-sdk";

/**
 * 포트원 V2는 "서버가 결제 세션을 만드는" 구조가 아니라, "브라우저에서 결제창을 직접 띄우고
 * 서버는 그 결과를 검증만 하는" 구조다 (2026-08-14, 정확한 아키텍처 재조사 후 확정).
 *
 * 그래서 서버가 할 일은 결제 생성이 아니라 "클라이언트가 결제됐다고 주장하는 금액이 진짜
 * 포트원 서버에 기록된 금액과 일치하는지" 확인하는 것. 클라이언트가 보낸 금액을 그대로
 * 믿으면 위조된 결제 금액으로 무료 이용을 시도하는 공격이 가능해진다.
 */

let _client: ReturnType<typeof PaymentClient> | null = null;

function getClient() {
  if (_client) return _client;
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) {
    throw new Error("PORTONE_API_SECRET이 설정되지 않았어요. 포트원 콘솔에서 발급받은 V2 API Secret을 .env.local에 넣어주세요.");
  }
  _client = PaymentClient({ secret });
  return _client;
}

export type VerifiedPayment = {
  status: string;
  amount: number;
  currency: string;
  customData: unknown;
};

/**
 * paymentId로 포트원 서버에서 실제 결제 정보를 조회한다.
 * ⚠️ 절대 클라이언트가 보낸 금액을 그대로 신뢰하지 말고, 항상 이 함수로 재확인할 것.
 */
export async function verifyPayment(paymentId: string): Promise<VerifiedPayment> {
  const client = getClient();
  const payment = await client.getPayment({ paymentId });

  if (!payment || payment.status === undefined) {
    throw new Error("포트원에서 결제 정보를 찾지 못했어요.");
  }

  const amount = (payment as any).amount?.total ?? 0;
  const currency = (payment as any).currency ?? "KRW";
  const customData = (payment as any).customData ?? null;

  return { status: (payment as any).status, amount, currency, customData };
}
