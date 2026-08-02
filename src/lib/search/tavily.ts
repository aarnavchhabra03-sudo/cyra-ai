export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface TavilySearchResponse {
  results: TavilySearchResult[];
}

export function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export function sanitizeUrl(stringUrl: string): string | null {
  if (!stringUrl || typeof stringUrl !== 'string') return null;
  const trimmed = stringUrl.trim();

  // Reject malicious schemes, placeholders, or empty URLs
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed === '#' ||
    trimmed.includes('example.com')
  ) {
    return null;
  }

  if (!isValidHttpUrl(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.href;
  } catch {
    return null;
  }
}

export function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    let hostname = parsed.hostname.replace(/^www\./, '');
    return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch {
    return 'Web Source';
  }
}

export async function searchTavily(query: string, maxResults = 5): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[TAVILY SEARCH] TAVILY_API_KEY is missing in environment variables.');
    return [];
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: false,
        max_results: maxResults,
      }),
    });

    if (!res.ok) {
      console.error(`[TAVILY SEARCH] Tavily HTTP error ${res.status}:`, await res.text());
      return [];
    }

    const data: TavilySearchResponse = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (error) {
    console.error('[TAVILY SEARCH] Network or execution error:', error);
    return [];
  }
}
