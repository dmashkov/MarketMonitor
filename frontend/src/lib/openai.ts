/**
 * OpenAI Client Configuration
 *
 * This module provides typed access to OpenAI API
 * Used for AI-powered market search and analysis
 *
 * ENV: VITE_OPENAI_API_KEY
 */

import type { OpenAIMessage, OpenAISearchResponse } from '@/shared/types';

// Type-safe OpenAI configuration
interface OpenAIConfig {
  apiKey: string;
  baseURL: string;
  model: 'gpt-4-turbo' | 'gpt-4o';
}

// Get config from environment
function getOpenAIConfig(): OpenAIConfig {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_OPENAI_API_KEY environment variable is not set');
  }

  return {
    apiKey,
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o', // Use GPT-4o for better price/performance ratio
  };
}

/**
 * Call OpenAI API to search for market events
 *
 * @param promptText - The prompt text to send to OpenAI
 * @returns Typed search results from OpenAI
 */
export async function callOpenAISearch(promptText: string): Promise<OpenAISearchResponse> {
  const config = getOpenAIConfig();

  const messages: OpenAIMessage[] = [
    {
      role: 'system',
      content: `You are a market research AI assistant for the Russian climate equipment market.
Extract structured data about market events.
Always return valid JSON in this format ONLY:
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "segment": "...",
      "event_type": "...",
      "company": "...",
      "description": "...",
      "criticality": 1-5,
      "source_url": "..."
    }
  ],
  "total_found": <number>,
  "search_query": "<original query>"
}

DO NOT include markdown code blocks - only pure JSON.`,
    },
    {
      role: 'user',
      content: promptText,
    },
  ];

  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.5,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as Record<string, unknown>;
      throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
    }

    interface OpenAIResponse {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    }

    const data = await response.json() as OpenAIResponse;
    const content = data.choices[0]?.message.content;

    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    // Type-safe JSON parsing
    const result: OpenAISearchResponse = JSON.parse(content);

    // Validate structure
    if (!Array.isArray(result.events) || typeof result.total_found !== 'number') {
      throw new Error('Invalid response structure from OpenAI');
    }

    return result;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse OpenAI response: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Call OpenAI API for summarization
 *
 * @param eventsSummary - JSON string of events to summarize
 * @returns AI-generated summary
 */
export async function callOpenAISummarize(eventsSummary: string): Promise<string> {
  const config = getOpenAIConfig();

  const messages: OpenAIMessage[] = [
    {
      role: 'system',
      content: `You are a market analyst for the Russian climate equipment market.
Analyze the provided market events and provide a concise summary with:
1. Top 5 key events
2. Main market trends
3. Activity assessment
4. Business recommendations

Write in Russian.`,
    },
    {
      role: 'user',
      content: `Analyze these market events:\n${eventsSummary}`,
    },
  ];

  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as Record<string, unknown>;
      throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
    }

    interface OpenAIResponse {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    }

    const data = await response.json() as OpenAIResponse;
    const content = data.choices[0]?.message.content;

    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    return content;
  } catch (error) {
    throw error;
  }
}

export default {
  callOpenAISearch,
  callOpenAISummarize,
};
