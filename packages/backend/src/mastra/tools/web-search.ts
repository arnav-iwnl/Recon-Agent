import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Web search tool using Tavily API.
 * Returns structured search results with titles, URLs, and snippets.
 */
export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information on a given query. Returns relevant results with titles, URLs, and content snippets.',
  inputSchema: z.object({
    query: z.string().describe('The search query to look up'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      })
    ),
  }),
  execute: async (args: any) => {
    const data = args.context ?? args;
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { results: [{ title: 'Error', url: '', content: 'TAVILY_API_KEY not set' }] };
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: data.query,
          max_results: 5,
          include_answer: false,
          search_depth: 'basic',
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const json = await response.json() as {
        results: Array<{ title: string; url: string; content: string }>;
      };

      return {
        results: json.results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
      };
    } catch (err) {
      console.error('Web search error:', err);
      return {
        results: [{ title: 'Search Error', url: '', content: String(err) }],
      };
    }
  },
});
