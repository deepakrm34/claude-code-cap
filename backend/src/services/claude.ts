import Anthropic from '@anthropic-ai/sdk';

// The official SDK defaults to reading ANTHROPIC_API_KEY. This repo uses a
// custom var name (CLAUDE_API_KEY), so the key is passed explicitly below.
//
// Unlike DATABASE_URL / JWT_SECRET (which fail fast at module load), the AI
// enhance feature is optional: we construct the client lazily so the rest of
// the API still boots and serves requests when CLAUDE_API_KEY is unset. Calls
// to the enhance endpoint then fail with a clear, catchable error.
export class ClaudeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeConfigError';
  }
}

/** Claude answered, but with nothing usable (safety refusal or empty output). */
export class ClaudeResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeResponseError';
  }
}

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1024;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.CLAUDE_API_KEY;
  // Treat the .env.example placeholder as unset — otherwise it produces a
  // misleading upstream 401 instead of a clear "not configured" response.
  if (!apiKey || apiKey.includes('REPLACE_ME') || apiKey.includes('xxxx')) {
    throw new ClaudeConfigError('CLAUDE_API_KEY is not set. Add it to backend/.env (see .env.example).');
  }
  client = new Anthropic({ apiKey });
  return client;
}

const SYSTEM_PROMPT = [
  'You rewrite task descriptions to be clearer and more actionable.',
  'Given a task title and description, produce an improved description that:',
  '- states the goal in one or two sentences,',
  '- lists concrete, ordered steps or acceptance criteria where useful,',
  '- preserves the original intent and any specifics (names, dates, numbers),',
  '- adds no information that was not implied by the input.',
  'Respond with only the rewritten description as plain text — no preamble, no markdown headers, no "Here is" phrasing.',
].join('\n');

export interface EnhanceInput {
  title: string;
  description: string;
}

/**
 * Rewrite a task's title + description into a clearer, more actionable
 * description via Claude. Returns the rewritten text (trimmed).
 *
 * Throws {@link ClaudeConfigError} when CLAUDE_API_KEY is unset, and the
 * SDK's typed API errors (e.g. Anthropic.RateLimitError) on request failures —
 * the route handler maps these to appropriate HTTP status codes.
 */
export async function enhanceTaskDescription({ title, description }: EnhanceInput): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Title: ${title}\n\nDescription: ${description}`,
      },
    ],
  });

  // Opus 4.8 can decline a request with HTTP 200 + stop_reason "refusal"
  // (empty or partial content) — check before reading content.
  if (response.stop_reason === 'refusal') {
    throw new ClaudeResponseError('Claude declined to process this task.');
  }

  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();

  if (!text) {
    throw new ClaudeResponseError('Claude returned an empty response.');
  }
  return text;
}
