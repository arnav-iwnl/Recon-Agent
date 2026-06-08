import { Mastra } from '@mastra/core';
import { orchestratorAgent } from './agents/orchestrator.js';
import { researchAgent } from './agents/researcher.js';
import { analysisAgent } from './agents/analyst.js';
import { writingAgent } from './agents/writer.js';

/**
 * Central Mastra instance — registers all agents so they can
 * be retrieved by ID and share services (logging, observability).
 */
export const mastra = new Mastra({
  agents: {
    orchestratorAgent,
    researchAgent,
    analysisAgent,
    writingAgent,
  },
});
