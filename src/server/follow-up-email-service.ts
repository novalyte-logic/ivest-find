import { GoogleGenAI, Type } from '@google/genai';
import { Investor } from '../data/investors';

interface FollowUpDraft {
  subject: string;
  body: string;
}

function getFollowUpModel() {
  return process.env.FOLLOW_UP_GEMINI_MODEL || 'gemini-2.5-pro';
}

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHtmlBody(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.includes('<')) {
    return trimmed;
  }

  return trimmed.replace(/\n/g, '<br>');
}

function getApiKeyCandidates(): string[] {
  return Array.from(
    new Set(
      [
        process.env.VERTEX_AI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.GEMINI_API_KEY,
        process.env.VITE_GEMINI_API_KEY,
        process.env.VITE_VERTEX_AI_API_KEY,
      ]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

async function generateWithKey(
  apiKey: string,
  input: {
    subject?: string;
    body?: string;
    investor?: Investor | null;
    vaultContext: string;
    instruction?: string;
  },
): Promise<FollowUpDraft> {
  const ai = new GoogleGenAI({ apiKey });
  const model = getFollowUpModel();

  const previousSubject = sanitizeText(input.subject);
  const previousBody = sanitizeText(input.body);
  const instruction = sanitizeText(input.instruction);
  const investorContext = input.investor
    ? `Target investor:
- Name: ${input.investor.name}
- Firm: ${input.investor.firm || 'Unknown'}
- Role: ${input.investor.role}
- Focus: ${input.investor.focus.join(', ') || 'Unknown'}
- Bio: ${input.investor.bio}
- Latest summary: ${input.investor.latestSummary || 'Not available'}
- Latest news: ${(input.investor.latestNews || []).join('; ') || 'Not available'}
- Pain points: ${(input.investor.painPoints || []).join('; ') || 'Not available'}
- Financial goals: ${(input.investor.financialGoals || []).join('; ') || 'Not available'}`
    : 'Target investor: Not selected.';

  const groundedResponse = await ai.models.generateContent({
    model,
    contents: `Generate a concise investor follow-up email for Novalyte AI.

Rules:
1. Use the Novalyte AI vault context as the source of truth.
2. Do not invent traction, customer names, partnerships, or metrics.
3. If a prior email exists, write a real follow-up rather than a fresh cold intro.
4. Keep the email concise and easy to reply to.
5. Use Google Search grounding for any investor-specific context.
6. Return the draft in plain text notes first.
7. If you suggest a subject, keep it reply-thread friendly.

Additional direction:
${instruction || 'Write a credible follow-up that nudges for a response without sounding pushy.'}

Previous subject:
${previousSubject || 'None'}

Previous email body:
${previousBody || 'None'}

${investorContext}

Novalyte AI vault context:
${input.vaultContext}`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const structuredResponse = await ai.models.generateContent({
    model,
    contents: `Convert these grounded follow-up notes into JSON.

Rules:
1. Return only a JSON object.
2. Include "subject" and "body".
3. "body" must be HTML suitable for an email editor.
4. Keep the email concise and investor-ready.

Grounded notes:
${groundedResponse.text || ''}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ['subject', 'body'],
      },
    },
  });

  const parsed = JSON.parse(structuredResponse.text || '{}') as Record<string, unknown>;
  const subject = sanitizeText(parsed.subject);
  const body = normalizeHtmlBody(sanitizeText(parsed.body));

  return {
    subject: subject || previousSubject || 'Re: Novalyte AI',
    body,
  };
}

export async function generateFollowUpEmail(input: {
  subject?: string;
  body?: string;
  investor?: Investor | null;
  vaultContext: string;
  instruction?: string;
}): Promise<FollowUpDraft> {
  const apiKeys = getApiKeyCandidates();
  if (apiKeys.length === 0) {
    throw new Error('No server-side Google or Vertex AI API key is configured.');
  }

  let lastError: unknown = null;

  for (const apiKey of apiKeys) {
    try {
      return await generateWithKey(apiKey, input);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to generate a follow-up email.');
}
