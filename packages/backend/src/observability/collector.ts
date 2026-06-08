import {
  createAgentTrace,
  updateAgentTrace,
  createStep,
  updateSession,
  getSessionTraces,
} from '../db/queries.js';
import { calculateCost } from './cost.js';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface StepData {
  toolName: string | null;
  toolArguments: string | null;
  toolResult: string | null;
  promptTokens: number;
  completionTokens: number;
}

/**
 * TraceCollector manages observability data for a single research session.
 * It records agent traces, step-level detail, and aggregates session-level metrics.
 * All writes are synchronous (better-sqlite3) to avoid losing data in async contexts.
 */
export class TraceCollector {
  private sessionId: string;
  private agentTraces: Map<string, { traceId: string; startTime: number; stepCount: number }> = new Map();
  private totalTokensIn = 0;
  private totalTokensOut = 0;
  private totalCost = 0;
  private totalSteps = 0;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Called when an agent begins processing.
   * Returns a traceId for correlating subsequent steps.
   */
  startAgentTrace(agentName: string, agentRole: string, input: string): string {
    let traceId: string;
    try {
      traceId = createAgentTrace(this.sessionId, agentName, agentRole, input);
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        throw new Error('Session was deleted during processing');
      }
      throw err;
    }
    
    this.agentTraces.set(agentName, {
      traceId,
      startTime: Date.now(),
      stepCount: 0,
    });
    return traceId;
  }

  /**
   * Called when an agent completes its work.
   */
  endAgentTrace(
    agentName: string,
    output: string,
    tokens: TokenUsage,
    modelId: string,
    error?: string
  ): void {
    const entry = this.agentTraces.get(agentName);
    if (!entry) return;

    const durationMs = Date.now() - entry.startTime;
    const cost = calculateCost(modelId, tokens.promptTokens, tokens.completionTokens);

    updateAgentTrace(entry.traceId, {
      output,
      tokens_in: tokens.promptTokens,
      tokens_out: tokens.completionTokens,
      cost,
      duration_ms: durationMs,
      ended_at: new Date().toISOString(),
      error: error || undefined,
    });

    this.totalTokensIn += tokens.promptTokens;
    this.totalTokensOut += tokens.completionTokens;
    this.totalCost += cost;
  }

  /**
   * Record a single step (tool call, LLM interaction) within an agent trace.
   */
  recordStep(agentName: string, step: StepData): void {
    const entry = this.agentTraces.get(agentName);
    if (!entry) return;

    entry.stepCount++;
    this.totalSteps++;

    try {
      createStep(
        entry.traceId,
        entry.stepCount,
        step.toolName,
        step.toolArguments,
        step.toolResult,
        step.promptTokens,
        step.completionTokens
      );
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        throw new Error('Session was deleted during processing');
      }
      throw err;
    }
  }

  /**
   * Finalize the session with aggregated metrics.
   */
  finalizeSession(status: 'completed' | 'max_steps' | 'failed', finalReport?: string): void {
    updateSession(this.sessionId, {
      status,
      ended_at: new Date().toISOString(),
      total_tokens_in: this.totalTokensIn,
      total_tokens_out: this.totalTokensOut,
      total_cost: this.totalCost,
      total_steps: this.totalSteps,
      final_report: finalReport || null,
    });
  }

  /**
   * Get current session metrics (for mid-session SSE updates).
   */
  getMetrics() {
    return {
      totalTokensIn: this.totalTokensIn,
      totalTokensOut: this.totalTokensOut,
      totalCost: this.totalCost,
      totalSteps: this.totalSteps,
    };
  }
}
