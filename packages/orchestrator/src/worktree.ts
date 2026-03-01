import { execSync } from "child_process";
import path from "path";

const TIMEOUT = 5000;

/**
 * Check if a directory is inside a git repository.
 */
function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "ignore", timeout: TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a git worktree for an agent's task.
 * Returns the worktree path, or null if workspace is not a git repo.
 */
export function createWorktree(
  workspace: string,
  agentId: string,
  taskId: string,
  agentName: string,
): string | null {
  if (!isGitRepo(workspace)) return null;

  const worktreeDir = path.join(workspace, ".worktrees");
  const worktreeName = `${agentId}-${taskId}`;
  const worktreePath = path.join(worktreeDir, worktreeName);
  const branch = `agent/${agentName.toLowerCase().replace(/\s+/g, "-")}/${taskId}`;

  try {
    execSync(`git worktree add "${worktreePath}" -b "${branch}"`, {
      cwd: workspace,
      stdio: "pipe",
      timeout: TIMEOUT,
    });
    return worktreePath;
  } catch (err) {
    console.error(`[Worktree] Failed to create worktree: ${(err as Error).message}`);
    return null;
  }
}

export interface MergeResult {
  success: boolean;
  conflictFiles?: string[];
}

/**
 * Merge a worktree branch back to the current branch and clean up.
 */
export function mergeWorktree(
  workspace: string,
  worktreePath: string,
  branch: string,
): MergeResult {
  try {
    execSync(`git merge --no-ff "${branch}"`, {
      cwd: workspace,
      stdio: "pipe",
      timeout: TIMEOUT,
    });
    // Clean up worktree and branch
    try {
      execSync(`git worktree remove "${worktreePath}"`, { cwd: workspace, stdio: "pipe", timeout: TIMEOUT });
    } catch { /* already removed */ }
    try {
      execSync(`git branch -d "${branch}"`, { cwd: workspace, stdio: "pipe", timeout: TIMEOUT });
    } catch { /* branch not found or not fully merged */ }

    return { success: true };
  } catch (err) {
    // Merge conflict — extract conflicting files
    let conflictFiles: string[] = [];
    try {
      const output = execSync("git diff --name-only --diff-filter=U", {
        cwd: workspace,
        encoding: "utf-8",
        timeout: TIMEOUT,
      }).trim();
      conflictFiles = output ? output.split("\n") : [];
      // Abort the failed merge
      execSync("git merge --abort", { cwd: workspace, stdio: "pipe", timeout: TIMEOUT });
    } catch { /* ignore */ }

    return { success: false, conflictFiles };
  }
}

/**
 * Force-remove a worktree and its branch (used on task failure/cancel).
 */
export function removeWorktree(worktreePath: string, branch: string, workspace?: string): void {
  const cwd = workspace ?? path.dirname(path.dirname(worktreePath));
  try {
    execSync(`git worktree remove --force "${worktreePath}"`, { cwd, stdio: "pipe", timeout: TIMEOUT });
  } catch { /* already removed */ }
  try {
    execSync(`git branch -D "${branch}"`, { cwd, stdio: "pipe", timeout: TIMEOUT });
  } catch { /* branch not found */ }
}
