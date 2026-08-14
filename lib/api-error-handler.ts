import { NextRequest, NextResponse } from "next/server";

/**
 * 라우트 핸들러를 감싸서, 예상 못 한 예외(env 변수 누락, 네트워크 실패 등)가
 * 터져도 항상 JSON으로 응답하게 만든다.
 *
 * ⚠️ 이게 없으면: 예외가 그대로 새어나가 Next.js가 HTML 에러 페이지를 반환하고,
 * 클라이언트의 res.json()이 파싱에 실패해서 "서버에 연결할 수 없어요"라는
 * 엉뚱하고 오해를 주는 메시지가 뜬다 (2026-08-13, 실사용자 테스트 중 발견).
 * 지금은 개발 단계라 실제 에러 메시지를 그대로 노출한다 — 프로덕션 전환 시
 * 사용자에게 보이는 메시지는 일반화하고, 상세 내용은 서버 로그로만 남기도록
 * 재검토할 것 (NFR.md §3 보안 섹션과 연결).
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      console.error("[unhandled route error]", err);
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "server_error", message: `서버 내부 오류: ${message}` },
        { status: 500 }
      );
    }
  };
}
