export { Orchestrator } from "./orchestrator.js";
export { AgentSession } from "./agent-session.js";
export { previewServer } from "./preview-server.js";
export { AgentManager } from "./agent-manager.js";
export { DelegationRouter } from "./delegation.js";
export { PromptEngine } from "./prompt-templates.js";
export { RetryTracker } from "./retry.js";
export { createWorktree, mergeWorktree, removeWorktree } from "./worktree.js";

export type { AIBackend, BuildArgsOpts } from "./ai-backend.js";
export type {
  AgentStatus,
  RiskLevel,
  Decision,
  TaskResultPayload,
  OrchestratorEvent,
  OrchestratorEventMap,
  OrchestratorOptions,
  CreateAgentOpts,
  CreateTeamOpts,
  RunTaskOpts,
  WorktreeOptions,
  RetryOptions,
  TaskStartedEvent,
  TaskDoneEvent,
  TaskFailedEvent,
  TaskDelegatedEvent,
  TaskRetryingEvent,
  AgentStatusEvent,
  ApprovalNeededEvent,
  LogAppendEvent,
  TeamChatEvent,
  TaskQueuedEvent,
  WorktreeCreatedEvent,
  WorktreeMergedEvent,
  AgentCreatedEvent,
  AgentFiredEvent,
  TaskResultReturnedEvent,
} from "./types.js";

import { Orchestrator } from "./orchestrator.js";
import type { OrchestratorOptions } from "./types.js";

/**
 * Factory function to create an Orchestrator instance.
 */
export function createOrchestrator(options: OrchestratorOptions): Orchestrator {
  return new Orchestrator(options);
}
