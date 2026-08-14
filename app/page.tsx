import Link from "next/link";
import { NavAuthButtons } from "./NavAuthButtons";

export default function LandingPage() {
  return (
    <>
      <div className="landingNavWrap">
        <div className="landingNav">
          <div className="logo">
            <span className="dot" /> MAKERSTUDIO
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <NavAuthButtons />
          </div>
        </div>
      </div>

      <div className="landingHero">
        <div className="landingHeroGrid">
          <div className="landingHeroText">
            <span className="heroEyebrow">AI 기반 메이커 교육</span>
            <h1>
              혼자 헤매지 않아요
              <br />
              AI가 곁에서
              <br />
              가르쳐주는 코딩
            </h1>
            <p>
              Arduino부터 로봇까지 — 공식 예제로 검증된 코드와 실물 키트로 완성하는 진짜 메이커
              교육. 막히면 AI 튜터가 바로 힌트를 줘요.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              <Link href="/signup" className="btn btnCoral heroBtn">
                무료로 시작하기 →
              </Link>
              <Link href="/examples" className="btn btnOutline heroBtn">
                코스 둘러보기
              </Link>
            </div>
            <p className="heroSub">신용카드 필요 없음 · 첫 실습 완전 무료</p>
          </div>

          <div className="landingHeroDemo">
            <div className="demoFrame">
              <div className="demoFrameBar">
                <span /><span /><span />
              </div>
              <div className="demoFrameBody">
                <div className="demoLedRow">
                  <div className="demoLed">💡</div>
                  <div className="demoLedLabel">D13 · HIGH</div>
                </div>
                <svg viewBox="0 0 260 50" className="demoScope">
                  <polyline
                    points="0,40 20,40 20,10 60,10 60,40 100,40 100,10 140,10 140,40 180,40 180,10 220,10 220,40 260,40"
                    fill="none"
                    stroke="#4C9A72"
                    strokeWidth="2.5"
                  />
                </svg>
                <div className="demoCode">
                  {`digitalWrite(LED, HIGH);\ndelay(1000);\ndigitalWrite(LED, LOW);\ndelay(1000);`}
                </div>
              </div>
            </div>
            <p className="demoCaption">실제 학습 화면의 회로 시뮬레이션 미리보기</p>
          </div>
        </div>
      </div>

      <div className="landingTrustbar">
        <span>✅ 공식 예제 기반 코드</span>
        <span>🔒 아동 개인정보 보호 설계</span>
        <span>💳 다크패턴 없는 정직한 가격</span>
        <span>🤖 실제 Claude AI 튜터</span>
      </div>

      <main className="wrap" style={{ maxWidth: 1000 }}>
        <div className="landingArticle">
          <div>
            <div className="tab tabInline">왜 다른가 · 1</div>
            <h2>정답만 던져주지 않아요</h2>
            <p className="articleP">
              코드가 안 될 때 답만 보여주면 배우는 게 없어요. MakerStudio의 AI 튜터는 왜 안
              되는지, 어떻게 생각해야 하는지 단계별로 짚어줘요 — 실제 Claude API로 작동해요.
            </p>
          </div>
          <div className="articleVisual">
            <div className="mockTerminal">
              <div className="mockTerminalHead"><i /><i /><i /></div>
              <div className="mockTerminalBody">
                <div><span className="mockUser">나&gt;</span> LED가 왜 안 켜지죠?</div>
                <div>
                  <span className="mockAI">AI&gt;</span> 좋은 질문이에요! pinMode를 OUTPUT으로
                  설정했는지 먼저 확인해볼까요? 🤔
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="landingArticle reverse">
          <div>
            <div className="tab tabInline tabCoral">왜 다른가 · 2</div>
            <h2>AI가 지어낸 코드가 아니에요</h2>
            <p className="articleP">
              모든 코드는 Arduino 공식 예제를 기반으로, 실제 avr-gcc 컴파일러로 검증을 통과한
              것만 올라가요. &ldquo;그럴듯한 코드&rdquo;가 아니라 &ldquo;진짜 작동하는
              코드&rdquo;예요.
            </p>
          </div>
          <div className="articleVisual">
            <div className="mockBadgeCard">
              <div className="mockBadgeRow">✅ 스키마 검증 통과</div>
              <div className="mockBadgeRow">✅ 실제 컴파일 검증 통과</div>
              <div className="mockBadgeRow">✅ 사람 검수 완료</div>
            </div>
          </div>
        </div>

        <div className="landingArticle">
          <div>
            <div className="tab tabInline">왜 다른가 · 3</div>
            <h2>화면 안에서 끝나지 않아요</h2>
            <p className="articleP">
              시뮬레이션에서 배운 걸 진짜 부품으로 손에 쥐고 완성해요. 라인트레이서부터
              자율주행 로봇카까지, 모듈을 하나씩 배우면서 실물 키트로 확장돼요.
            </p>
          </div>
          <div className="articleVisual">
            <div className="mockKitCard">
              <div style={{ fontSize: 34 }}>🚙</div>
              <b>4WD 장애물회피 스마트카</b>
              <span className="muted">모듈 6개 · Arduino UNO</span>
            </div>
          </div>
        </div>

        <div className="card center landingFinalCta">
          <h2>지금 바로 시작해보세요</h2>
          <p className="muted">신용카드 필요 없이, 첫 실습은 완전 무료예요.</p>
          <Link href="/signup" className="btn btnCoral heroBtn">무료로 시작하기 →</Link>
        </div>

        <div className="landingFooter">
          <p>MakerStudio · 제작 VISION FOLLOWER</p>
          <p>이용약관 · 개인정보처리방침 · 문의하기</p>
        </div>
      </main>
    </>
  );
}
