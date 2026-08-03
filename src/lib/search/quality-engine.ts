import { TavilySearchResult } from './tavily';
import { ResourcePlanItem } from '@/lib/ai/types';

export const MIN_RESOURCE_RELEVANCE_SCORE = 60;

export interface LessonContext {
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
  lessonDescription: string;
  experienceLevel: string;
  keyConcepts?: string[];
}

export interface EvaluatedCandidate {
  candidate: TavilySearchResult;
  item: ResourcePlanItem;
  cleanUrl: string;
  score: number;
  reasons: string[];
  passed: boolean;
}

export function sanitizeUrl(stringUrl: string): string | null {
  if (!stringUrl || typeof stringUrl !== 'string') return null;
  const trimmed = stringUrl.trim();

  // Reject invalid schemes, placeholders
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed === '#' ||
    trimmed.includes('example.com')
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // Strip common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref', 'source', 'trk'];
    trackingParams.forEach(param => parsed.searchParams.delete(param));

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

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

export function calculateTitleSimilarity(titleA: string, titleB: string): number {
  const tokensA = new Set(tokenize(titleA));
  const tokensB = new Set(tokenize(titleB));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) intersection++;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

export function evaluateCandidate(
  candidate: TavilySearchResult,
  context: LessonContext,
  item: ResourcePlanItem
): EvaluatedCandidate {
  const cleanUrl = sanitizeUrl(candidate.url);
  if (!cleanUrl) {
    return {
      candidate,
      item,
      cleanUrl: '',
      score: 0,
      reasons: ['Invalid or unparseable URL'],
      passed: false,
    };
  }

  const reasons: string[] = [];
  let score = 0;

  const candidateText = `${candidate.title} ${candidate.content} ${candidate.url}`.toLowerCase();
  const lessonTitleTokens = tokenize(context.lessonTitle);
  const courseTitleTokens = tokenize(context.courseTitle);

  // HARD FILTER 1: Negative Context & Out-of-Domain Filter
  // Detect known completely unrelated domains/keywords (e.g. waterproofing, roofing, plumbing, real estate when course is CS/Biology)
  const irrelevancyKeywords = ['waterproofing', 'roofing', 'plumbing', 'pest control', 'real estate listing', 'casino', 'betting', 'viagra'];
  const isLessonUnrelatedKeyword = irrelevancyKeywords.some(kw => 
    candidateText.includes(kw) && !context.courseTitle.toLowerCase().includes(kw) && !context.lessonTitle.toLowerCase().includes(kw)
  );

  if (isLessonUnrelatedKeyword) {
    return {
      candidate,
      item,
      cleanUrl,
      score: 0,
      reasons: ['Hard filter: candidate contains completely unrelated topic keywords'],
      passed: false,
    };
  }

  // HARD FILTER 2: Minimum token overlap
  // Must match at least 1 significant token from lesson title OR course title OR item title
  const itemTitleTokens = tokenize(item.title);
  const coreTargetTokens = Array.from(new Set([...lessonTitleTokens, ...itemTitleTokens]));
  
  const tokenMatches = coreTargetTokens.filter(t => candidateText.includes(t));
  if (tokenMatches.length === 0 && !candidateText.includes(context.courseTitle.toLowerCase())) {
    return {
      candidate,
      item,
      cleanUrl,
      score: 0,
      reasons: ['Hard filter: zero keyword overlap with lesson title or course title'],
      passed: false,
    };
  }

  // 1. Lesson Title & Key Concepts Relevance (Max 35 pts)
  const titleOverlapRatio = tokenMatches.length / Math.max(1, coreTargetTokens.length);
  const titleScore = Math.min(35, Math.round(titleOverlapRatio * 35));
  score += titleScore;
  reasons.push(`Lesson title keyword match: +${titleScore}/35`);

  // 2. Lesson Description Relevance (Max 25 pts)
  const descTokens = tokenize(context.lessonDescription);
  const descMatches = descTokens.filter(t => candidateText.includes(t));
  const descRatio = descTokens.length > 0 ? descMatches.length / descTokens.length : 0.5;
  const descScore = Math.min(25, Math.round(descRatio * 25));
  score += descScore;
  reasons.push(`Description match: +${descScore}/25`);

  // 3. Module & Course Context Relevance (Max 15 pts)
  const courseMatches = courseTitleTokens.filter(t => candidateText.includes(t));
  const courseScore = courseMatches.length > 0 ? 15 : 5;
  score += courseScore;
  reasons.push(`Course/Module context match: +${courseScore}/15`);

  // 4. Source / Domain Quality Signal (Max 15 pts)
  const domain = extractDomain(cleanUrl).toLowerCase();
  const reputableDomains = [
    'edu', 'gov', 'khanacademy.org', 'geeksforgeeks.org', 'developer.mozilla.org',
    'wikipedia.org', 'youtube.com', 'youtu.be', 'mit.edu', 'stanford.edu', 'harvard.edu',
    'coursera.org', 'edx.org', 'w3schools.com', 'sciencedirect.com', 'nature.com',
    'ncbi.nlm.nih.gov', 'medium.com', 'stackoverflow.com', 'github.com'
  ];

  const isReputable = reputableDomains.some(d => cleanUrl.toLowerCase().includes(d));
  const domainScore = isReputable ? 15 : 8;
  score += domainScore;
  reasons.push(`Domain quality signal (${domain}): +${domainScore}/15`);

  // 5. Resource Type Suitability (Max 10 pts)
  const targetType = (item.resource_type || 'article').toLowerCase();
  let typeScore = 5;

  if (targetType === 'video') {
    const isVideoUrl = cleanUrl.includes('youtube.com/watch') || cleanUrl.includes('youtu.be') || cleanUrl.includes('vimeo.com');
    if (isVideoUrl) {
      typeScore = 10;
    } else if (candidateText.includes('video') || candidateText.includes('watch')) {
      typeScore = 7;
    } else {
      typeScore = 0; // Penalize non-video link for video requirement
    }
  } else if (targetType === 'practice') {
    const isPractice = ['quiz', 'exercise', 'practice', 'problem', 'challenge', 'lab'].some(kw => candidateText.includes(kw));
    typeScore = isPractice ? 10 : 6;
  } else {
    typeScore = 10;
  }
  score += typeScore;
  reasons.push(`Resource type (${targetType}) suitability: +${typeScore}/10`);

  const passed = score >= MIN_RESOURCE_RELEVANCE_SCORE;

  return {
    candidate,
    item,
    cleanUrl,
    score,
    reasons,
    passed,
  };
}
