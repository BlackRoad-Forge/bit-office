import { spawn, type ChildProcess } from "child_process";
import path from "path";

const PREVIEW_PORT = 9100;

/**
 * Global preview server — one at a time.
 * Kills the previous serve process before starting a new one.
 */
class PreviewServer {
  private process: ChildProcess | null = null;
  private currentDir: string | null = null;

  /**
   * Serve a directory on a fixed port. Kills any existing serve process first.
   * Returns the preview URL for the given file.
   */
  serve(filePath: string): string | undefined {
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    this.stop();

    try {
      this.process = spawn("npx", ["serve", dir, "-l", String(PREVIEW_PORT), "--no-clipboard"], {
        stdio: "ignore",
        detached: true,
      });
      this.process.unref();
      this.currentDir = dir;
      const url = `http://localhost:${PREVIEW_PORT}/${fileName}`;
      console.log(`[PreviewServer] Serving ${dir} on port ${PREVIEW_PORT}`);
      return url;
    } catch (e) {
      console.log(`[PreviewServer] Failed to start: ${e}`);
      return undefined;
    }
  }

  /** Kill the current serve process */
  stop() {
    if (this.process) {
      try { this.process.kill("SIGTERM"); } catch { /* already dead */ }
      this.process = null;
      this.currentDir = null;
      console.log(`[PreviewServer] Stopped`);
    }
  }
}

/** Singleton instance */
export const previewServer = new PreviewServer();
