/**
 * content/examples/*.json 전체를 스키마로 검증합니다.
 * 하나라도 실패하면 종료 코드 1을 반환 — GitHub Actions에서 이 스크립트가
 * 실패하면 해당 PR은 사람 검수 단계로 넘어가지 못하고 자동으로 막힙니다.
 * (design doc §6.3 "2단계 자동 검증"에 해당하는 부분. 실제 서비스에서는
 *  여기에 arduino-cli 컴파일 테스트를 추가로 붙이는 걸 권장합니다.)
 */
import { getAllExamples } from "../lib/content";

try {
  const examples = getAllExamples();
  console.log(`✅ 콘텐츠 검증 통과: 예제 ${examples.length}개`);
  examples.forEach((e) => console.log(`   - ${e.icon} ${e.label} (${e.id})`));
  process.exit(0);
} catch (err) {
  console.error("❌ 콘텐츠 검증 실패");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
