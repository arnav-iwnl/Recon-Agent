import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSessions, SessionSummary } from '../api';

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function formatDuration(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  // Aggregate stats
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const totalTokens = sessions.reduce((a, s) => a + s.totalTokensIn + s.totalTokensOut, 0);
  const totalCost = sessions.reduce((a, s) => a + s.totalCost, 0);

  if (loading) {
    return (
      <div className="loading-container">
        <span className="spinner" />
        Loading sessions...
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Observability Dashboard</h2>
        <p>Monitor agent performance, costs, and execution details</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalSessions}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedSessions}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatTokens(totalTokens)}</div>
          <div className="stat-label">Total Tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${totalCost.toFixed(4)}</div>
          <div className="stat-label">Total Cost</div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {sessions.length === 0 ? (
          <div className="text-center" style={{ padding: 40, color: 'var(--text-secondary)' }}>
            No research sessions yet. Start one from the Research page!
          </div>
        ) : (
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Status</th>
                <th>Steps</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Duration</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  onClick={() => navigate(`/dashboard/${session.id}`)}
                >
                  <td className="topic-cell">{session.topic}</td>
                  <td>
                    <span className={`badge badge-${session.status}`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="mono">{session.totalSteps}</td>
                  <td className="mono">{formatTokens(session.totalTokensIn + session.totalTokensOut)}</td>
                  <td className="mono">${session.totalCost.toFixed(4)}</td>
                  <td className="mono">{formatDuration(session.durationMs)}</td>
                  <td className="mono">
                    {new Date(session.startedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
