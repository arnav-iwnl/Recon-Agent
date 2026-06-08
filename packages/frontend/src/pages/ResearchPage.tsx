import { useState, useRef, useEffect, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { startResearch, subscribeToSession } from '../api';

interface FeedEvent {
  id: number;
  eventType: string;
  agent?: string;
  role?: string;
  message: string;
  tool?: string;
  toolArgs?: unknown;
  model?: string;
  timestamp: string;
}

export default function ResearchPage() {
  const [topic, setTopic] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);
  const eventIdRef = useRef(0);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  function addEvent(eventType: string, data: Record<string, unknown>) {
    const id = ++eventIdRef.current;
    const evt: FeedEvent = {
      id,
      eventType,
      agent: data.agent as string | undefined,
      role: data.role as string | undefined,
      message: (data.message || data.task || data.summary || '') as string,
      tool: data.tool as string | undefined,
      toolArgs: data.args,
      model: data.model as string | undefined,
      timestamp: (data.timestamp as string) || new Date().toISOString(),
    };
    setEvents((prev) => [...prev, evt]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || status === 'running') return;

    setError('');
    setEvents([]);
    setReport(null);
    setStatus('running');

    try {
      const { sessionId: sid } = await startResearch(topic.trim());
      setSessionId(sid);

      const es = subscribeToSession(
        sid,
        (eventName, data) => {
          const d = data as Record<string, unknown>;

          switch (eventName) {
            case 'pipeline_start':
              addEvent('system', { message: d.message as string, timestamp: d.timestamp as string });
              break;
            case 'agent_start':
              addEvent('agent_start', d);
              break;
            case 'tool_call':
              addEvent('tool_call', d);
              break;
            case 'agent_complete':
              addEvent('agent_complete', d);
              break;
            case 'report_complete':
              setReport(d.report as string);
              break;
            case 'pipeline_end':
              setStatus(d.status === 'completed' ? 'completed' : 'failed');
              es.close();
              break;
            case 'error':
              addEvent('error', { message: d.message as string, timestamp: d.timestamp as string });
              setStatus('failed');
              es.close();
              break;
          }
        },
        () => {
          // SSE connection error — may just be the server closing after completion
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start research');
      setStatus('failed');
    }
  }

  function getRoleClass(role?: string): string {
    switch (role) {
      case 'researcher': return 'researcher';
      case 'analyst': return 'analyst';
      case 'writer': return 'writer';
      default: return 'system';
    }
  }

  function formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  return (
    <>
      <div className="page-header">
        <h2>Research</h2>
        <p>Submit a topic and watch AI agents research it in real time</p>
      </div>

      {/* Topic Input */}
      <div className="research-input-area">
        <form onSubmit={handleSubmit}>
          <div className="research-input-row">
            <input
              id="research-topic"
              type="text"
              className="input"
              placeholder="Enter a research topic... e.g., 'Impact of AI on healthcare diagnostics'"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={status === 'running'}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!topic.trim() || status === 'running'}
            >
              {status === 'running' && <span className="spinner" />}
              {status === 'running' ? 'Researching...' : '🔬 Start Research'}
            </button>
          </div>
        </form>
        {error && <div className="auth-error mt-4">{error}</div>}
      </div>

      {/* Live Feed */}
      {events.length > 0 && (
        <>
          <div className="card-header">
            <span className="card-title">
              {status === 'running' ? '🔴 Live Activity Feed' : '📋 Activity Log'}
            </span>
            {status === 'running' && <span className="badge badge-running">Live</span>}
            {status === 'completed' && <span className="badge badge-completed">Complete</span>}
            {status === 'failed' && <span className="badge badge-failed">Failed</span>}
          </div>

          <div className="live-feed" ref={feedRef} style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {events.map((evt) => (
              <div key={evt.id} className="feed-event">
                <div className={`feed-event-dot ${getRoleClass(evt.role)}`} />
                <div className="feed-event-content">
                  <div className="feed-event-header">
                    <span className={`feed-event-agent ${getRoleClass(evt.role)}`}>
                      {evt.agent || 'System'}
                      {evt.model && <span style={{ fontWeight: 400, fontSize: '0.75rem', opacity: 0.6, marginLeft: 8 }}>{evt.model}</span>}
                    </span>
                    <span className="feed-event-time">{formatTime(evt.timestamp)}</span>
                  </div>
                  <div className="feed-event-body">
                    {evt.eventType === 'agent_start' && `▶ ${evt.message}`}
                    {evt.eventType === 'agent_complete' && `✓ ${evt.message}`}
                    {evt.eventType === 'tool_call' && `🔧 Called tool: ${evt.tool}`}
                    {evt.eventType === 'system' && evt.message}
                    {evt.eventType === 'error' && `❌ ${evt.message}`}
                  </div>
                  {evt.eventType === 'tool_call' && !!evt.toolArgs && (
                    <div className="feed-event-tool">
                      {JSON.stringify(evt.toolArgs, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Final Report */}
      {report && (
        <div style={{ marginTop: 24 }}>
          <div className="card-header">
            <span className="card-title">📄 Research Report</span>
            {sessionId && (
              <a href={`/dashboard/${sessionId}`} className="btn btn-ghost btn-sm">
                View in Dashboard →
              </a>
            )}
          </div>
          <div className="report-container">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );
}
