import fs from "node:fs";
import path from "node:path";
import { ExampleSchema, type Example } from "./schema";

const EXAMPLES_DIR = path.join(process.cwd(), "content", "examples");

/**
 * content/examples/ 안의 모든 *.json 파일을 읽어 스키마 검증 후 반환합니다.
 * 이 함수가 곧 "플러그인 로더"입니다 — 파일을 추가/삭제하는 것만으로
 * 사이트에 노출되는 예제 목록이 자동으로 바뀝니다.
 */
export function getAllExamples(): Example[] {
  if (!fs.existsSync(EXAMPLES_DIR)) return [];

  const files = fs.readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".json"));

  const examples = files.map((file) => {
    const raw = fs.readFileSync(path.join(EXAMPLES_DIR, file), "utf-8");
    const json = JSON.parse(raw);
    const result = ExampleSchema.safeParse(json);
    if (!result.success) {
      throw new Error(
        `콘텐츠 검증 실패: ${file}\n${result.error.issues
          .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
          .join("\n")}`
      );
    }
    return result.data;
  });

  return examples.sort((a, b) => a.difficulty - b.difficulty);
}

export function getExampleById(id: string): Example | undefined {
  return getAllExamples().find((e) => e.id === id);
}
