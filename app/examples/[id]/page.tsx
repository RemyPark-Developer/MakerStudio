import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllExamples, getExampleById } from "@/lib/content";
import { QuizBlock } from "./QuizBlock";
import { AiTutorPanel } from "./AiTutorPanel";

export function generateStaticParams() {
  return getAllExamples().map((ex) => ({ id: ex.id }));
}

export default async function ExamplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ex = getExampleById(id);
  if (!ex) return notFound();

  return (
    <main className="wrap">
      <p>
        <Link href="/">← 목록으로</Link>
      </p>

      <div className="card">
        <div className="tab">U3 · 프로젝트 소개</div>
        <h1>
          {ex.icon} {ex.label}
        </h1>
        <span className="pill">난이도 {"★".repeat(ex.difficulty)}</span>
        <span className="pill">예상시간 {ex.estimatedMinutes}분</span>
        <span className="pill">{ex.board}</span>
        <p style={{ marginTop: 12 }}>{ex.intro}</p>
      </div>

      <div className="card">
        <div className="tab">R1 · 준비물</div>
        <h3>부품</h3>
        <ul className="partlist">
          {ex.parts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="tab">C1 · 회로 핀</div>
        <h3>연결 핀</h3>
        <p>{ex.pin}</p>
      </div>

      <div className="card">
        <div className="tab">Q1 · 전체 코드</div>
        <h3>{ex.codeFilename}</h3>
        <div className="codebox">{ex.code}</div>
        {ex.sourceExample && (
          <div className="sourcebadge">소스: {ex.sourceExample}</div>
        )}
      </div>

      <div className="card">
        <div className="tab">Q2 · 코드 설명</div>
        <h3>설명</h3>
        <p>{ex.explain}</p>
      </div>

      <div className="card">
        <div className="tab coral">M1 · 응용 미션</div>
        <h3>미션</h3>
        <p>{ex.mission}</p>
      </div>

      <div className="card">
        <div className="tab coral">Z1 · Quiz</div>
        <QuizBlock quiz={ex.quiz} />
      </div>

      <div className="card">
        <div className="tab">AI · TUTOR</div>
        <AiTutorPanel exampleLabel={ex.label} stepName="학습 중" />
      </div>
    </main>
  );
}
