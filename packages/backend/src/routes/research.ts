import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { mastra } from '../mastra/index.js';
import { createSession, updateSession } from '../db/queries.js';
import { TraceCollector } from '../observability/collector.js';

const router = Router();

// Map of active SSE connections by session ID
const sseClients: Map<string, Response[]> = new Map();

/**
 * Send an SSE event to all clients watching a session.
 */
function emitSSE(sessionId: string, event: string, data: unknown): void {
  const clients = sseClients.get(sessionId);
  if (!clients) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

/**
 * POST /api/research — Start a new research session.
 * Creates the session, kicks off the agent pipeline in the background,
 * and returns the session ID immediately.
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { topic } = req.body;
    const userId = req.userId!;

    if (!topic || typeof topic !== 'string') {
      res.status(400).json({ error: 'Topic is required' });
      return;
    }

    const sessionId = createSession(userId, topic.trim());

    // Run the research pipeline in the background
    runResearchPipeline(sessionId, topic.trim()).catch((err) => {
      console.error(`Pipeline error for session ${sessionId}:`, err);
    });

    res.status(201).json({ sessionId });
  } catch (err) {
    console.error('Error starting research:', err);
    res.status(500).json({ error: 'Failed to start research session' });
  }
});

/**
 * GET /api/research/:id/stream — SSE endpoint for live agent activity.
 */
router.get('/:id/stream', (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Register this client
  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, []);
  }
  sseClients.get(sessionId)!.push(res);

  // Send initial heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);

  // Cleanup on disconnect
  req.on('close', () => {
    const clients = sseClients.get(sessionId);
    if (clients) {
      const index = clients.indexOf(res);
      if (index !== -1) clients.splice(index, 1);
      if (clients.length === 0) sseClients.delete(sessionId);
    }
  });
});

/**
 * Run the multi-agent research pipeline.
 * Uses the orchestrator's supervisor pattern to delegate to sub-agents.
 * Emits SSE events at each stage for real-time UI updates.
 */
async function runResearchPipeline(sessionId: string, topic: string): Promise<void> {
  const collector = new TraceCollector(sessionId);
  const orchestrator = mastra.getAgentById('orchestrator');

  emitSSE(sessionId, 'pipeline_start', {
    message: `Starting deep research on: "${topic}"`,
    timestamp: new Date().toISOString(),
  });

  try {
    // ── Phase 1: Research ──────────────────────────────────
    emitSSE(sessionId, 'agent_start', {
      agent: 'Research Agent',
      role: 'researcher',
      task: `Gathering sources and information about: ${topic}`,
      model: 'openai/qwen/qwen3.5-397b-a17b',
      timestamp: new Date().toISOString(),
    });

    const researchTraceId = collector.startAgentTrace('Research Agent', 'researcher', topic);
    const researcher = mastra.getAgentById('research-agent');

    const researchPrompt = `Research the following topic thoroughly. Search for multiple relevant sources and extract key information.\n\nTopic: ${topic}\n\nProvide detailed findings with source URLs.`;

    const researchResult = await researcher.generate(researchPrompt, { maxSteps: 15 });
    const researchOutput = researchResult.text;
    const researchUsage: any = researchResult.usage || {};

    // Record steps from the research agent
    if (researchResult.steps) {
      for (let i = 0; i < researchResult.steps.length; i++) {
        const step = researchResult.steps[i];
        const toolCalls = step.toolCalls || [];
        const toolResults = step.toolResults || [];

        for (let j = 0; j < toolCalls.length; j++) {
          const tc: any = toolCalls[j];
          const tr: any = toolResults[j];
          const usage: any = step.usage || {};

          console.log('--- DEBUG TOOL CALL ---', JSON.stringify(tc));

          const actualToolName = tc.toolName || tc.name || tc.tool || (tc.function && tc.function.name) || (tc.payload && tc.payload.toolName) || 'unknown_tool';
          const actualArgs = tc.args || tc.arguments || (tc.function && tc.function.arguments) || (tc.payload && tc.payload.args) || tc;

          collector.recordStep('Research Agent', {
            toolName: actualToolName,
            toolArguments: JSON.stringify(actualArgs),
            toolResult: tr ? JSON.stringify(tr.result || tr.content || tr) : null,
            promptTokens: usage.promptTokens || 0,
            completionTokens: usage.completionTokens || 0,
          });

          emitSSE(sessionId, 'tool_call', {
            agent: 'Research Agent',
            tool: actualToolName,
            args: actualArgs,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    collector.endAgentTrace('Research Agent', researchOutput, {
      promptTokens: researchUsage.promptTokens || 0,
      completionTokens: researchUsage.completionTokens || 0,
    }, 'openai/qwen/qwen3.5-397b-a17b');

    emitSSE(sessionId, 'agent_complete', {
      agent: 'Research Agent',
      role: 'researcher',
      summary: researchOutput.slice(0, 300) + (researchOutput.length > 300 ? '...' : ''),
      tokens: researchUsage,
      timestamp: new Date().toISOString(),
    });

    // ── Phase 2: Analysis ──────────────────────────────────
    emitSSE(sessionId, 'agent_start', {
      agent: 'Analysis Agent',
      role: 'analyst',
      task: 'Evaluating sources and extracting key findings',
      model: 'openai/mistralai/mistral-medium-3.5-128b',
      timestamp: new Date().toISOString(),
    });

    const analysisTraceId = collector.startAgentTrace('Analysis Agent', 'analyst', researchOutput);
    const analyst = mastra.getAgentById('analysis-agent');

    const analysisPrompt = `Analyze the following research findings. Evaluate source quality, extract key findings, identify contradictions, and produce a structured analysis.\n\nResearch Findings:\n${researchOutput}`;

    const analysisResult = await analyst.generate(analysisPrompt, { maxSteps: 10 });
    const analysisOutput = analysisResult.text;
    const analysisUsage: any = analysisResult.usage || {};

    if (analysisResult.steps) {
      for (let i = 0; i < analysisResult.steps.length; i++) {
        const usage: any = analysisResult.steps[i].usage || {};
        collector.recordStep('Analysis Agent', {
          toolName: null,
          toolArguments: null,
          toolResult: null,
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
        });
      }
    }

    collector.endAgentTrace('Analysis Agent', analysisOutput, {
      promptTokens: analysisUsage.promptTokens || 0,
      completionTokens: analysisUsage.completionTokens || 0,
    }, 'openai/mistralai/mistral-medium-3.5-128b');

    emitSSE(sessionId, 'agent_complete', {
      agent: 'Analysis Agent',
      role: 'analyst',
      summary: analysisOutput.slice(0, 300) + (analysisOutput.length > 300 ? '...' : ''),
      tokens: analysisUsage,
      timestamp: new Date().toISOString(),
    });

    // ── Phase 3: Writing ──────────────────────────────────
    emitSSE(sessionId, 'agent_start', {
      agent: 'Writing Agent',
      role: 'writer',
      task: 'Producing the final structured report',
      model: 'openai/meta/llama-3.1-70b-instruct',
      timestamp: new Date().toISOString(),
    });

    const writingTraceId = collector.startAgentTrace('Writing Agent', 'writer', analysisOutput);
    const writer = mastra.getAgentById('writing-agent');

    const writingPrompt = `Write a comprehensive, well-structured research report based on the following analysis.\n\nTopic: ${topic}\n\nAnalysis:\n${analysisOutput}\n\nRaw Research Data:\n${researchOutput}\n\nProduce a polished report with: Executive Summary, Key Findings, Detailed Analysis, Source References, and Conclusion.`;

    const writingResult = await writer.generate(writingPrompt, { maxSteps: 10 });
    const finalReport = writingResult.text;
    const writingUsage: any = writingResult.usage || {};

    if (writingResult.steps) {
      for (let i = 0; i < writingResult.steps.length; i++) {
        const usage: any = writingResult.steps[i].usage || {};
        collector.recordStep('Writing Agent', {
          toolName: null,
          toolArguments: null,
          toolResult: null,
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
        });
      }
    }

    collector.endAgentTrace('Writing Agent', finalReport, {
      promptTokens: writingUsage.promptTokens || 0,
      completionTokens: writingUsage.completionTokens || 0,
    }, 'openai/meta/llama-3.1-70b-instruct');

    emitSSE(sessionId, 'agent_complete', {
      agent: 'Writing Agent',
      role: 'writer',
      summary: 'Final report generated',
      tokens: writingUsage,
      timestamp: new Date().toISOString(),
    });

    // ── Finalize ──────────────────────────────────────────
    collector.finalizeSession('completed', finalReport);

    emitSSE(sessionId, 'report_complete', {
      report: finalReport,
      metrics: collector.getMetrics(),
      timestamp: new Date().toISOString(),
    });

    emitSSE(sessionId, 'pipeline_end', {
      status: 'completed',
      metrics: collector.getMetrics(),
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Research pipeline error:', err);

    collector.finalizeSession('failed');

    emitSSE(sessionId, 'error', {
      message: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    emitSSE(sessionId, 'pipeline_end', {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

export default router;
