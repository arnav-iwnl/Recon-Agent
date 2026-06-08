import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  fetchSession,
  fetchTraces,
  fetchSteps,
  deleteSession,
  SessionDetail,
  AgentTrace,
  StepDetail,
} from '../api';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, StepDetail[]>>({});
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchSession(id), fetchTraces(id)])
      .then(([s, t]) => {
        setSession(s);
        setTraces(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleTrace(traceId: string) {
    if (expandedTrace === traceId) {
      setExpandedTrace(null);
      return;
    }
    setExpandedTrace(traceId);
    if (!steps[traceId]) {
      const s = await fetchSteps(traceId);
      setSteps((prev) => ({ ...prev, [traceId]: s }));
    }
  }

  async function handleDelete() {
    if (!id || !window.confirm('Are you sure you want to delete this session?')) return;
    try {
      await deleteSession(id);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      alert('Failed to delete session');
    }
  }

  function getAgentColor(role: string | null): string {
    switch (role) {
      case 'researcher': return 'var(--agent-researcher)';
      case 'analyst': return 'var(--agent-analyst)';
      case 'writer': return 'var(--agent-writer)';
      default: return 'var(--agent-orchestrator)';
    }
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <span className="spinner" />
        Loading session...
      </div>
    );
  }

  if (!session) {
    return <div className="text-center mt-4">Session not found</div>;
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
            ← Back
          </button>
          <div>
            <h2>{session.topic}</h2>
            <p>Session {session.id.slice(0, 8)}</p>
          </div>
        </div>
        <button className="btn" style={{ background: 'var(--danger)', color: 'white', border: 'none' }} onClick={handleDelete}>
          🗑️ Delete
        </button>
      </div>

      {/* Session Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">
            <span className={`badge badge-${session.status}`} style={{ fontSize: '0.9rem' }}>
              {session.status}
            </span>
          </div>
          <div className="stat-label">Status</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDuration(session.durationMs || 0)}</div>
          <div className="stat-label">Duration</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{session.totalSteps}</div>
          <div className="stat-label">Agent Steps</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(session.totalTokensIn + session.totalTokensOut).toLocaleString()}</div>
          <div className="stat-label">Total Tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${session.totalCost.toFixed(6)}</div>
          <div className="stat-label">Estimated Cost</div>
        </div>
      </div>

      {/* Report Toggle */}
      {session.finalReport && (
        <div className="mb-4">
          <button
            className="btn btn-ghost"
            onClick={() => setShowReport(!showReport)}
          >
            {showReport ? '📋 Hide Report' : '📄 View Final Report'}
          </button>
          {showReport && (
            <div className="report-container mt-4">
              <ReactMarkdown>{session.finalReport}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Agent Traces */}
      <div className="card-header mt-4">
        <span className="card-title">Agent Traces</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {traces.length} traces
        </span>
      </div>

      {traces.map((trace) => (
        <div
          key={trace.id}
          className="trace-card"
          onClick={() => toggleTrace(trace.id)}
        >
          <div className="trace-header">
            <div className="trace-agent-name">
              <div
                className="trace-agent-dot"
                style={{ background: getAgentColor(trace.agentRole) }}
              />
              <span style={{ color: getAgentColor(trace.agentRole) }}>
                {trace.agentName}
              </span>
              {trace.error && (
                <span className="badge badge-failed" style={{ marginLeft: 8 }}>Error</span>
              )}
            </div>
            <div className="trace-metrics">
              <div className="trace-metric">
                <div className="value">{trace.tokensIn + trace.tokensOut}</div>
                <div className="label">Tokens</div>
              </div>
              <div className="trace-metric">
                <div className="value">${trace.cost.toFixed(6)}</div>
                <div className="label">Cost</div>
              </div>
              <div className="trace-metric">
                <div className="value">{formatDuration(trace.durationMs)}</div>
                <div className="label">Duration</div>
              </div>
            </div>
          </div>

          {/* Input/Output Preview */}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Input:</strong>{' '}
            {trace.input && trace.input.length > 150
              ? trace.input.slice(0, 150) + '...'
              : trace.input}
          </div>

          {trace.error && (
            <div style={{ marginTop: 8, color: 'var(--danger)', fontSize: '0.8rem' }}>
              <strong>Error:</strong> {trace.error}
            </div>
          )}

          {/* Expanded Steps */}
          {expandedTrace === trace.id && (
            <div style={{ marginTop: 16 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Steps ({steps[trace.id]?.length || 0})
              </div>

              {steps[trace.id]?.map((step) => (
                <div key={step.id} className="step-item">
                  <div className="step-index">{step.stepIndex}</div>
                  <div className="step-content">
                    {step.toolName ? (
                      <div className="step-tool-name">🔧 {step.toolName}</div>
                    ) : (
                      <div className="step-tool-name">💬 LLM Response</div>
                    )}

                    {!!step.toolArguments && (
                      <div className="step-data">
                        <strong>Args:</strong> {JSON.stringify(step.toolArguments, null, 2)}
                      </div>
                    )}

                    {!!step.toolResult && (
                      <div className="step-data">
                        <strong>Result:</strong>{' '}
                        {JSON.stringify(step.toolResult, null, 2).slice(0, 500)}
                      </div>
                    )}

                    <div className="step-tokens">
                      Prompt: {step.promptTokens} | Completion: {step.completionTokens} |{' '}
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              {(!steps[trace.id] || steps[trace.id].length === 0) && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '12px 0' }}>
                  No step-level detail recorded
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {traces.length === 0 && (
        <div className="text-center" style={{ padding: 40, color: 'var(--text-secondary)' }}>
          No agent traces recorded yet
        </div>
      )}
    </>
  );
}
