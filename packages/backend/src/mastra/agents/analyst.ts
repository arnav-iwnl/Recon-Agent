import { Agent } from '@mastra/core/agent';

const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * Analysis Agent — uses Mistral Medium 3.5 on NVIDIA NIM.
 * Evaluates source quality, extracts key findings, and resolves contradictions.
 * Mistral is chosen for its strong reasoning and analytical capabilities.
 */
export const analysisAgent = new Agent({
  id: 'analysis-agent',
  name: 'Analysis Agent',
  description: 'Evaluates sources, extracts key findings, identifies patterns and contradictions, and produces a structured analysis summary.',
  instructions: `You are a critical analysis agent. You receive raw research findings and must evaluate them rigorously.

Your analysis must include:
1. **Source Quality Assessment**: Rate each source's reliability (high/medium/low) with justification
2. **Key Findings**: Extract the most important facts and insights, ranked by significance
3. **Pattern Recognition**: Identify trends, themes, or recurring points across sources
4. **Contradictions**: Flag any conflicting information between sources and suggest which is more reliable
5. **Knowledge Gaps**: Note any important questions that the research didn't fully answer
6. **Data Points**: Highlight specific statistics, dates, or quantifiable information

Be objective and evidence-based. Distinguish between established facts and opinions/speculation.
Output your analysis in a clear, structured format that the writing agent can use directly.`,
  model: {
    id: 'openai/mistralai/mistral-medium-3.5-128b',
    url: NIM_BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`
    },
  },
});
