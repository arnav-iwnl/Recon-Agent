import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getAllSessions,
  getSession,
  getSessionTraces,
  getTraceSteps,
  deleteSession,
} from '../db/queries.js';

const router = Router();

/**
 * Helper to ensure SQLite datetime('now') strings are parsed as UTC.
 */
function parseSQLiteDate(dateStr: string): number {
  if (!dateStr) return 0;
  // If it doesn't end with Z, append it to force UTC parsing
  const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  return new Date(isoStr).getTime();
}

/**
 * GET /api/obs/sessions — List all research sessions.
 * Returns summary data: id, topic, status, cost, duration, step count.
 */
router.get('/sessions', (req: AuthRequest, res: Response) => {
  try {
    const sessions = getAllSessions();

    const result = sessions.map((s) => ({
      id: s.id,
      topic: s.topic,
      status: s.status,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      totalTokensIn: s.total_tokens_in,
      totalTokensOut: s.total_tokens_out,
      totalCost: s.total_cost,
      totalSteps: s.total_steps,
      durationMs: s.ended_at
        ? parseSQLiteDate(s.ended_at) - parseSQLiteDate(s.started_at)
        : null,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error listing sessions:', err);
    res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
});

/**
 * GET /api/obs/sessions/:id 
 
 */
router.get('/sessions/:id', (req: AuthRequest, res: Response) => {
  try {
    const session = getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const durationMs = session.ended_at
      ? parseSQLiteDate(session.ended_at) - parseSQLiteDate(session.started_at)
      : Date.now() - parseSQLiteDate(session.started_at);

    res.json({
      id: session.id,
      topic: session.topic,
      status: session.status,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      totalTokensIn: session.total_tokens_in,
      totalTokensOut: session.total_tokens_out,
      totalCost: session.total_cost,
      totalSteps: session.total_steps,
      durationMs,
      finalReport: session.final_report,
    });
  } catch (err) {
    console.error('Error getting session:', err);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

/**
 * DELETE /api/obs/sessions/:id
 */
router.delete('/sessions/:id', (req: AuthRequest, res: Response) => {
  try {
    const session = getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

/**
 * GET /api/obs/sessions/:id/traces
 */
router.get('/sessions/:id/traces', (req: AuthRequest, res: Response) => {
  try {
    const traces = getSessionTraces(req.params.id);

    const result = traces.map((t) => ({
      id: t.id,
      agentName: t.agent_name,
      agentRole: t.agent_role,
      input: t.input,
      output: t.output,
      tokensIn: t.tokens_in,
      tokensOut: t.tokens_out,
      cost: t.cost,
      durationMs: t.duration_ms,
      startedAt: t.started_at,
      endedAt: t.ended_at,
      error: t.error,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error getting traces:', err);
    res.status(500).json({ error: 'Failed to retrieve traces' });
  }
});

/**
 * GET /api/obs/traces/:id/steps */

router.get('/traces/:id/steps', (req: AuthRequest, res: Response) => {
  try {
    const steps = getTraceSteps(req.params.id);

    const result = steps.map((s) => ({
      id: s.id,
      stepIndex: s.step_index,
      toolName: s.tool_name,
      toolArguments: s.tool_arguments ? JSON.parse(s.tool_arguments) : null,
      toolResult: s.tool_result ? JSON.parse(s.tool_result) : null,
      promptTokens: s.prompt_tokens,
      completionTokens: s.completion_tokens,
      timestamp: s.timestamp,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error getting steps:', err);
    res.status(500).json({ error: 'Failed to retrieve steps' });
  }
});

export default router;
