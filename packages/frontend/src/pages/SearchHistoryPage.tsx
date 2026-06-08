import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchSessions, fetchSession, SessionSummary } from '../api';

export default function SearchHistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [reportLoading, setReportLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSessions()
      .then((data) => {
        // Filter to only show completed sessions, since those have final reports
        setSessions(data.filter((s) => s.status === 'completed'));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function toggleSession(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(id);
    
    // Lazy load the report if we haven't fetched it yet
    if (!reports[id]) {
      setReportLoading((prev) => ({ ...prev, [id]: true }));
      try {
        const detail = await fetchSession(id);
        if (detail.finalReport) {
          setReports((prev) => ({ ...prev, [id]: detail.finalReport! }));
        } else {
          setReports((prev) => ({ ...prev, [id]: '*No report generated for this session.*' }));
        }
      } catch (err) {
        console.error(err);
        setReports((prev) => ({ ...prev, [id]: '*Failed to load report.*' }));
      } finally {
        setReportLoading((prev) => ({ ...prev, [id]: false }));
      }
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <span className="spinner" />
        Loading search history...
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Search History</h2>
        <p>Your past research topics and their final reports</p>
      </div>

      <div className="history-list mt-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sessions.length === 0 ? (
          <div className="text-center card" style={{ padding: 40, color: 'var(--text-secondary)' }}>
            You haven't completed any research searches yet.
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="card" style={{ padding: '20px', cursor: 'pointer' }} onClick={() => toggleSession(session.id)}>
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0' }}>{session.topic}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(session.startedAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {expandedId === session.id ? '▼' : '▶'}
                </div>
              </div>

              {expandedId === session.id && (
                <div className="report-container mt-4" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }} onClick={(e) => e.stopPropagation()}>
                  {reportLoading[session.id] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                      <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                      Loading report...
                    </div>
                  ) : (
                    <ReactMarkdown>{reports[session.id] || ''}</ReactMarkdown>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
