import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execAsync = promisify(exec);

export async function validateArduinoCompile(
  moduleId: string,
  code: string
): Promise<{ passed: boolean; detail: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), `arduino-${moduleId}-`));
  const sketchDir = path.join(dir, moduleId.replace(/-/g, "_"));
  const sketchFile = path.join(sketchDir, `${moduleId.replace(/-/g, "_")}.ino`);

  try {
    await import("node:fs/promises").then((fs) => fs.mkdir(sketchDir, { recursive: true }));
    await writeFile(sketchFile, code, "utf-8");

    const { stdout, stderr } = await execAsync(
      `arduino-cli compile --fqbn arduino:avr:uno "${sketchDir}"`,
      { timeout: 30000 }
    );

    return { passed: true, detail: stdout };
  } catch (err: any) {
    // arduino-cli는 컴파일 실패 시 non-zero exit code로 죽으므로 catch로 들어옴
    const detail = err.stderr || err.stdout || err.message || "알 수 없는 컴파일 오류";
    return { passed: false, detail };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}