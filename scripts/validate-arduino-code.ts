/**
 * content/examples/*.json 의 "code" 필드를 실제 avr-gcc로 컴파일합니다.
 * design doc §6.3 "2단계 자동 검증"의 실행부.
 *
 * 지금은 board: "Arduino UNO" (atmega328p)만 지원합니다.
 * ESP32/Pico/micro:bit 등 다른 보드는 각자의 툴체인이 필요해서
 * §6.5에서 보드가 늘어날 때 이 스크립트도 보드별 분기를 추가해야 합니다.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getAllExamples } from "../lib/content";

const SUPPORTED_BOARDS = ["Arduino UNO"];
const BUILD_ROOT = path.join(process.cwd(), ".arduino-build-tmp");
const COMPILE_SCRIPT = path.join(process.cwd(), "scripts", "compile-check.sh");

function wrapAsSketch(code: string): string {
  return code.includes("#include <Arduino.h>") ? code : `#include <Arduino.h>\n\n${code}`;
}

async function main() {
  const examples = getAllExamples();
  const toCheck = examples.filter((e) => SUPPORTED_BOARDS.includes(e.board));
  const skipped = examples.filter((e) => !SUPPORTED_BOARDS.includes(e.board));

  if (skipped.length) {
    console.log(`ℹ️  건너뜀 (아직 지원하지 않는 보드): ${skipped.map((e) => `${e.label}(${e.board})`).join(", ")}`);
  }

  fs.rmSync(BUILD_ROOT, { recursive: true, force: true });
  fs.mkdirSync(BUILD_ROOT, { recursive: true });

  let failed = 0;
  for (const ex of toCheck) {
    const sketchPath = path.join(BUILD_ROOT, `${ex.id}.cpp`);
    const outDir = path.join(BUILD_ROOT, `out-${ex.id}`);
    fs.writeFileSync(sketchPath, wrapAsSketch(ex.code));

    try {
      execSync(`bash "${COMPILE_SCRIPT}" "${sketchPath}" "${outDir}"`, { stdio: "pipe" });
      console.log(`✅ ${ex.icon} ${ex.label} (${ex.id}) — 컴파일 성공`);
    } catch (err: any) {
      failed++;
      console.error(`❌ ${ex.icon} ${ex.label} (${ex.id}) — 컴파일 실패`);
      console.error(err.stderr?.toString() ?? err.message);
    }
  }

  fs.rmSync(BUILD_ROOT, { recursive: true, force: true });

  if (failed > 0) {
    console.error(`\n${failed}개 예제가 컴파일에 실패했습니다.`);
    process.exit(1);
  }
  console.log(`\n✅ 전체 통과 — ${toCheck.length}개 예제 실제 컴파일 확인 완료`);
}

main();
