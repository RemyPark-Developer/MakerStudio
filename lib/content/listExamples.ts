import { getAllExamples } from "@/lib/content";
import { getPublishedModules } from "@/lib/content/publishedModules";
import type { Example } from "@/lib/schema";

/**
 * content/examples/*.json(파일, avr-gcc 컴파일 검증 + PR 리뷰를 거친 공식 콘텐츠)과
 * content_modules(DB, 관리자가 검수·승인한 콘텐츠)를 합쳐서 반환한다.
 * id가 겹치면 파일 쪽이 우선한다 — 같은 id로 AI가 만든 DB 콘텐츠가 나중에 들어와도
 * 파일 예제를 덮어쓰지 않는다.
 */
export async function listAllExamples(): Promise<Example[]> {
  const fileExamples = getAllExamples();
  const fileIds = new Set(fileExamples.map((e) => e.id));

  const dbModules = await getPublishedModules();
  const merged = [...fileExamples, ...dbModules.filter((m) => !fileIds.has(m.id))];

  return merged.sort((a, b) => a.difficulty - b.difficulty);
}
