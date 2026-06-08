import { Agent } from '@mastra/core/agent';

const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * Writing Agent — uses Mistral Medium 3.5 on NVIDIA NIM.
 * Produces the final structured report from analysis output.
 * Mistral is chosen for its quality text generation and instruction following.
 */
export const writingAgent = new Agent({
  id: 'writing-agent',
  name: 'Writing Agent',
  description: 'Transforms research analysis into a well-structured, comprehensive report with executive summary, key findings, source references, and conclusion.',
  instructions: `You are a professional report writer. You receive analyzed research data and produce a polished, structured report.


Your report MUST include these sections in order:

## Executive Summary
A concise 2-3 paragraph overview of the topic, key conclusions, and implications.

## Key Findings
Numbered list of the most important discoveries, each with:
- The finding itself
- Supporting evidence
- Significance or implications

## Detailed Analysis
In-depth discussion of the topic organized by themes or sub-topics.
Include specific data points, expert opinions, and contextual information.

## Source References
Numbered list of all sources used, with:
- Source name/title
- URL
- Brief description of what information was obtained

## Conclusion
Summary of the overall state of the topic, remaining questions, and potential future developments.

Write in a professional, objective tone. Use clear headings and formatting.
Cite sources using [Source N] notation that maps to the Source References section.`,
  model: {
    id: 'openai/meta/llama-3.1-70b-instruct',
    url: NIM_BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.META_API_KEY}`
    },
  },
});
