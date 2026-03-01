import { execSync } from "child_process";
import type { AIBackend } from "@bit-office/orchestrator";

const backends: AIBackend[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    supportsStdin: true,
    buildArgs(prompt, opts) {
      const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"];
      if (!opts.skipResume) {
        if (opts.resumeSessionId) {
          args.push("--resume", opts.resumeSessionId);
        } else if (opts.continue) {
          args.push("--continue");
        }
      }
      if (opts.noTools) args.push("--tools", "");
      if (opts.model) args.push("--model", opts.model);
      return args;
    },
    deleteEnv: ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"],
  },
  {
    id: "codex",
    name: "Codex CLI",
    command: "codex",
    buildArgs(prompt, opts) {
      if (opts.fullAccess) {
        return ["exec", prompt, "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"];
      }
      return ["exec", prompt, "--full-auto", "--skip-git-repo-check"];
    },
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    buildArgs(prompt) {
      return ["-p", prompt, "--yolo"];
    },
  },
  {
    id: "aider",
    name: "Aider",
    command: "aider",
    buildArgs(prompt) {
      return ["--message", prompt, "--yes", "--no-pretty", "--no-git"];
    },
  },
  {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    buildArgs(prompt) {
      return ["run", prompt, "--quiet"];
    },
  },
];

const backendMap = new Map<string, AIBackend>(backends.map((b) => [b.id, b]));

export function getBackend(id: string): AIBackend | undefined {
  return backendMap.get(id);
}

export function getAllBackends(): AIBackend[] {
  return backends;
}

/** Check which AI CLI tools are installed on this machine */
export function detectBackends(): string[] {
  const detected: string[] = [];
  for (const backend of backends) {
    try {
      execSync(`which ${backend.command}`, { stdio: "ignore", timeout: 3000 });
      detected.push(backend.id);
    } catch {
      // not installed
    }
  }
  return detected;
}
