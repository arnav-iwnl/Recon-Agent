import { getDb } from './connection.js';
import { v4 as uuidv4 } from 'uuid';

// ─── User Queries ───────────────────────────────────────────

export function createUser(email: string, passwordHash: string): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, email, passwordHash);
  return id;
}

export function findUserByEmail(email: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | { id: string; email: string; password_hash: string; created_at: string }
    | undefined;
}

// ─── Session Queries ────────────────────────────────────────

export interface SessionRow {
  id: string;
  user_id: string;
  topic: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  total_steps: number;
  final_report: string | null;
}

export function createSession(userId: string, topic: string): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO sessions (id, user_id, topic) VALUES (?, ?, ?)').run(id, userId, topic);
  return id;
}

export function getSession(sessionId: string): SessionRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
}

export function getUserSessions(userId: string): SessionRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC').all(userId) as SessionRow[];
}

export function getAllSessions(): SessionRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all() as SessionRow[];
}

export function updateSession(
  sessionId: string,
  updates: Partial<Pick<SessionRow, 'status' | 'ended_at' | 'total_tokens_in' | 'total_tokens_out' | 'total_cost' | 'total_steps' | 'final_report'>>
): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.ended_at !== undefined) { sets.push('ended_at = ?'); values.push(updates.ended_at); }
  if (updates.total_tokens_in !== undefined) { sets.push('total_tokens_in = ?'); values.push(updates.total_tokens_in); }
  if (updates.total_tokens_out !== undefined) { sets.push('total_tokens_out = ?'); values.push(updates.total_tokens_out); }
  if (updates.total_cost !== undefined) { sets.push('total_cost = ?'); values.push(updates.total_cost); }
  if (updates.total_steps !== undefined) { sets.push('total_steps = ?'); values.push(updates.total_steps); }
  if (updates.final_report !== undefined) { sets.push('final_report = ?'); values.push(updates.final_report); }

  if (sets.length > 0) {
    values.push(sessionId);
    db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM steps WHERE trace_id IN (SELECT id FROM agent_traces WHERE session_id = ?)').run(sessionId);
    db.prepare('DELETE FROM agent_traces WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  })();
}

// ─── Agent Trace Queries ────────────────────────────────────

export interface AgentTraceRow {
  id: string;
  session_id: string;
  agent_name: string;
  agent_role: string | null;
  input: string | null;
  output: string | null;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  duration_ms: number;
  started_at: string;
  ended_at: string | null;
  error: string | null;
}

export function createAgentTrace(sessionId: string, agentName: string, agentRole: string, input: string): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO agent_traces (id, session_id, agent_name, agent_role, input) VALUES (?, ?, ?, ?, ?)'
  ).run(id, sessionId, agentName, agentRole, input);
  return id;
}

export function updateAgentTrace(
  traceId: string,
  updates: Partial<Pick<AgentTraceRow, 'output' | 'tokens_in' | 'tokens_out' | 'cost' | 'duration_ms' | 'ended_at' | 'error'>>
): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.output !== undefined) { sets.push('output = ?'); values.push(updates.output); }
  if (updates.tokens_in !== undefined) { sets.push('tokens_in = ?'); values.push(updates.tokens_in); }
  if (updates.tokens_out !== undefined) { sets.push('tokens_out = ?'); values.push(updates.tokens_out); }
  if (updates.cost !== undefined) { sets.push('cost = ?'); values.push(updates.cost); }
  if (updates.duration_ms !== undefined) { sets.push('duration_ms = ?'); values.push(updates.duration_ms); }
  if (updates.ended_at !== undefined) { sets.push('ended_at = ?'); values.push(updates.ended_at); }
  if (updates.error !== undefined) { sets.push('error = ?'); values.push(updates.error); }

  if (sets.length > 0) {
    values.push(traceId);
    db.prepare(`UPDATE agent_traces SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
}

export function getSessionTraces(sessionId: string): AgentTraceRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_traces WHERE session_id = ? ORDER BY started_at ASC').all(sessionId) as AgentTraceRow[];
}

// ─── Step Queries ───────────────────────────────────────────

export interface StepRow {
  id: string;
  trace_id: string;
  step_index: number | null;
  tool_name: string | null;
  tool_arguments: string | null;
  tool_result: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  timestamp: string;
}

export function createStep(
  traceId: string,
  stepIndex: number,
  toolName: string | null,
  toolArguments: string | null,
  toolResult: string | null,
  promptTokens: number,
  completionTokens: number
): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO steps (id, trace_id, step_index, tool_name, tool_arguments, tool_result, prompt_tokens, completion_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, traceId, stepIndex, toolName, toolArguments, toolResult, promptTokens, completionTokens);
  return id;
}

export function getTraceSteps(traceId: string): StepRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM steps WHERE trace_id = ? ORDER BY step_index ASC').all(traceId) as StepRow[];
}
