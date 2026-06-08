import { Agent } from '@mastra/core/agent';
import { webSearchTool } from '../tools/web-search.js';
import { fetchPageTool } from '../tools/fetch-page.js';

const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  description: 'Performs web searches and retrieves source material for research sub-topics. Returns structured findings with source URLs and key data points.',
  instructions: `You are a meticulous research agent. Your job is to gather factual, comprehensive information on the given topic.

For each research task:
1. Use the web-search tool to find relevant sources (search 2-3 different queries for breadth)
2. Use the fetch-page tool on the most promising URLs to get detailed content
3. Synthesize your findings into a structured summary

Your output must include:
- A list of key findings with supporting evidence
- Source URLs for each finding
- Any notable data points, statistics, or expert quotes
- Conflicting information if found (flag for the analysis agent)

Be thorough but concise. Focus on factual, verifiable information.`,
  model: {
    id: 'openai/qwen/qwen3.5-397b-a17b',
    url: NIM_BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.QWEN_API_KEY}`
    },
  },
  tools: { webSearchTool, fetchPageTool },
});
