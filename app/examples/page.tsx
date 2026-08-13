import Link from "next/link";
import { getAllExamples } from "@/lib/content";

export default function ExamplesPage() {
  const examples = getAllExamples();

  return (
    <main className="wrap">
      <p><Link href="/">← 홈으로</Link></p>
      <h1>학습 콘텐츠</h1>
      <p style={{ color: "var(--ink-dim)" }}>
        아래 목록은 코드에 하드코딩된 게 아니라{" "}
        <code>content/examples/*.json</code> 폴더를 읽어서 자동으로 만들어집니다.
        이 폴더에 스키마에 맞는 JSON 파일을 하나 추가하면, 새로고침만으로 예제가 하나 늘어납니다.
      </p>

      {examples.map((ex) => (
        <Link key={ex.id} href={`/examples/${ex.id}`} className="examplelink">
          <div className="card">
            <div className="tab">U1 · {ex.board}</div>
            <h2>
              {ex.icon} {ex.label}
            </h2>
            <span className="pill">난이도 {"★".repeat(ex.difficulty)}</span>
            <span className="pill">예상시간 {ex.estimatedMinutes}분</span>
            <p style={{ marginTop: 10 }}>{ex.intro}</p>
          </div>
        </Link>
      ))}
    </main>
  );
}
