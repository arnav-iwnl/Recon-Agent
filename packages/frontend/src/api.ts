const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ───────────────────────────────────────────────────

export async function register(email: string, password: string): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

// ─── Research ───────────────────────────────────────────────

export async function startResearch(topic: string): Promise<{ sessionId: string }> {
  const res = await fetch(`${API_BASE}/research`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ topic }),
  });
  return handleResponse(res);
}

export function subscribeToSession(
  sessionId: string,
  onEvent: (event: string, data: unknown) => void,
  onError?: (err: Event) => void
): EventSource {
  const token = localStorage.getItem('auth_token');
  const es = new EventSource(`${API_BASE}/research/${sessionId}/stream?token=${token}`);

  const events = ['connected', 'pipeline_start', 'agent_start', 'agent_complete', 'tool_call', 'report_complete', 'pipeline_end', 'error'];
  for (const eventName of events) {
    es.addEventListener(eventName, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(eventName, data);
      } catch {
        onEvent(eventName, e.data);
      }
    });
  }

  es.onerror = (err) => {
    if (onError) onError(err);
  };

  return es;
}

// ─── Observability ──────────────────────────────────────────

export interface SessionSummary {
  id: string;
  topic: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  totalSteps: number;
  durationMs: number | null;
}

export interface SessionDetail extends SessionSummary {
  finalReport: string | null;
}

export interface AgentTrace {
  id: string;
  agentName: string;
  agentRole: string;
  input: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  error: string | null;
}

export interface StepDetail {
  id: string;
  stepIndex: number;
  toolName: string | null;
  toolArguments: unknown;
  toolResult: unknown;
  promptTokens: number;
  completionTokens: number;
  timestamp: string;
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}/obs/sessions`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/obs/sessions/${id}`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

export async function deleteSession(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/obs/sessions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function fetchTraces(sessionId: string): Promise<AgentTrace[]> {
  const res = await fetch(`${API_BASE}/obs/sessions/${sessionId}/traces`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

export async function fetchSteps(traceId: string): Promise<StepDetail[]> {
  const res = await fetch(`${API_BASE}/obs/traces/${traceId}/steps`, { headers: getAuthHeaders() });
  return handleResponse(res);
}
