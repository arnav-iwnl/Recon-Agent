import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Fetch and extract text content from a web page URL.
 * Uses a simple HTML-to-text extraction approach.
 */
export const fetchPageTool = createTool({
  id: 'fetch-page',
  description: 'Fetch the text content of a web page given its URL. Returns the main text content stripped of HTML tags.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the web page to fetch'),
  }),
  outputSchema: z.object({
    content: z.string(),
    title: z.string(),
  }),
  execute: async (args: any) => {
    const data = args.context ?? args;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(data.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          content: `Failed to fetch page: HTTP ${response.status}`,
          title: 'Error',
        };
      }

      const html = await response.text();

      // Simple HTML to text extraction
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
      const title = titleMatch ? titleMatch[1].trim() : 'No title';

      // Remove script and style tags with content
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

      // Remove remaining HTML tags
      text = text.replace(/<[^>]+>/g, ' ');

      // Clean up whitespace
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      // Limit to first 3000 chars to avoid context window issues
      const truncated = text.length > 3000 ? text.slice(0, 3000) + '...[truncated]' : text;

      return { content: truncated, title };
    } catch (err) {
      return {
        content: `Error fetching page: ${String(err)}`,
        title: 'Error',
      };
    }
  },
});
