import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore - Node built-in fs module without requiring @types/node
import * as fs from 'node:fs';

interface NodeProcessLike {
  env?: Record<string, string | undefined>;
  cwd?: () => string;
}

interface MiddlewareIncomingMessage {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  on: (event: string, listener: (arg?: unknown) => void) => void;
}

interface MiddlewareServerResponse {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

interface MiddlewareServerLike {
  middlewares: {
    use: (
      route: string,
      handler: (
        req: MiddlewareIncomingMessage,
        res: MiddlewareServerResponse,
        next: () => void
      ) => void
    ) => void;
  };
}

const nodeProcess: NodeProcessLike | undefined = (
  globalThis as unknown as { process?: NodeProcessLike }
).process;

export function parseEnvFile(filePath: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  try {
    if (!fs || typeof fs.existsSync !== 'function' || !fs.existsSync(filePath)) {
      return parsed;
    }
    const rawContent: string = fs.readFileSync(filePath, 'utf-8');
    const lines = rawContent.split(/\r?\n/);
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const lineWithoutExport = trimmed.startsWith('export ')
        ? trimmed.slice('export '.length).trim()
        : trimmed;
      const eqIdx = lineWithoutExport.indexOf('=');
      if (eqIdx <= 0) {
        continue;
      }
      const key = lineWithoutExport.slice(0, eqIdx).trim();
      let value = lineWithoutExport.slice(eqIdx + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1).trim();
      } else {
        const inlineCommentIdx = value.indexOf(' #');
        if (inlineCommentIdx !== -1) {
          value = value.slice(0, inlineCommentIdx).trim();
        }
      }

      if (key) {
        parsed[key] = value;
      }
    }
  } catch {
    // Ignore filesystem read errors gracefully
  }
  return parsed;
}

export function resolveOpenRouterApiKey(): string {
  const env = nodeProcess?.env ?? {};
  const directKey =
    env.OPENROUTER_API_KEY?.trim() || env.VITE_OPENROUTER_API_KEY?.trim();
  if (directKey) {
    return directKey;
  }

  const candidatePaths = [
    '/Users/omarkreidieh/Documents/Paintings App/.env',
    '/Users/omarkreidieh/Documents/Paintings App/.env.local',
    '/Users/omarkreidieh/.env',
  ];

  if (typeof nodeProcess?.cwd === 'function') {
    const cwdEnvPath = `${nodeProcess.cwd()}/.env`;
    if (!candidatePaths.includes(cwdEnvPath)) {
      candidatePaths.unshift(cwdEnvPath);
    }
  }

  for (const envPath of candidatePaths) {
    const values = parseEnvFile(envPath);
    const candidate =
      values.OPENROUTER_API_KEY?.trim() ||
      values.VITE_OPENROUTER_API_KEY?.trim();
    if (candidate) {
      return candidate;
    }
  }

  return '';
}

function readRequestBody(req: MiddlewareIncomingMessage): Promise<string> {
  if (typeof req.body === 'string' && req.body.length > 0) {
    return Promise.resolve(req.body);
  }
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(JSON.stringify(req.body));
  }
  return new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    req.on('data', (chunk?: unknown) => {
      if (typeof chunk === 'string') {
        chunks.push(chunk);
      } else if (
        chunk &&
        typeof (chunk as { toString?: (encoding?: string) => string }).toString ===
          'function'
      ) {
        chunks.push(
          (chunk as { toString: (encoding?: string) => string }).toString('utf-8')
        );
      }
    });
    req.on('end', () => {
      resolve(chunks.join(''));
    });
    req.on('error', (err?: unknown) => {
      reject(err);
    });
  });
}

const IMAGE_GENERATION_MODEL_CASCADE: string[] = [
  'google/gemini-3.1-flash-image',
  'google/gemini-3-pro-image',
  'google/gemini-nano-banana-2.1',
  'openai/gpt-5.4-image-2',
  'openai/gpt-5-image',
  'openai/gpt-5-image-mini',
  'google/gemini-2.5-flash-image',
  'google/gemini-3.1-flash-lite-image',
];

const VISION_JSON_MODEL_CASCADE: string[] = [
  'openai/gpt-6-astra',
  'google/gemini-4-argon',
  'deepseek/deepseek-v4.1-flash-1017',
  'google/gemini-2.5-flash',
  'openai/gpt-4o-mini',
];

function responseHasGeneratedImage(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  const choices = (parsed as { choices?: Array<{ message?: Record<string, unknown> }> })
    .choices;
  if (!Array.isArray(choices) || choices.length === 0) return false;
  const msg = choices[0]?.message;
  if (!msg || typeof msg !== 'object') return false;
  const images = msg.images as Array<{ image_url?: { url?: string }; url?: string }> | undefined;
  if (Array.isArray(images) && images.length > 0) {
    const firstUrl = images[0]?.image_url?.url || images[0]?.url || '';
    if (typeof firstUrl === 'string' && firstUrl.length > 32) {
      return true;
    }
  }
  const content = msg.content;
  if (typeof content === 'string' && content.includes('data:image/')) {
    return true;
  }
  return false;
}

function normalizeImageMessages(
  messages: unknown
): unknown {
  if (!Array.isArray(messages) || messages.length < 2) {
    return messages;
  }
  const first = messages[0] as { role?: string; content?: unknown } | undefined;
  const second = messages[1] as { role?: string; content?: unknown } | undefined;
  if (
    first?.role === 'system' &&
    typeof first.content === 'string' &&
    second?.role === 'user' &&
    Array.isArray(second.content)
  ) {
    const mergedContent = second.content.map((part, idx) => {
      if (
        idx === 0 &&
        part &&
        typeof part === 'object' &&
        (part as { type?: string }).type === 'text' &&
        typeof (part as { text?: string }).text === 'string'
      ) {
        return {
          ...part,
          text: `${first.content}\n\n${(part as { text: string }).text}`,
        };
      }
      return part;
    });
    return [
      {
        ...second,
        content: mergedContent,
      },
      ...messages.slice(2),
    ];
  }
  return messages;
}

function attachOpenRouterMiddleware(server: MiddlewareServerLike): void {
  server.middlewares.use('/api/openrouter/chat', async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.end('');
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: { message: 'Method Not Allowed. Expected POST /api/openrouter/chat.' },
        })
      );
      return;
    }

    let apiKey = resolveOpenRouterApiKey();
    if (!apiKey && req.headers) {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const rawAuth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      if (typeof rawAuth === 'string' && rawAuth.toLowerCase().startsWith('bearer ')) {
        apiKey = rawAuth.slice(7).trim();
      }
    }

    if (!apiKey) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: {
            message:
              'Missing OpenRouter API key. Set OPENROUTER_API_KEY or VITE_OPENROUTER_API_KEY in .env.',
          },
        })
      );
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      let parsedBody: Record<string, unknown> | null = null;
      try {
        parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        parsedBody = null;
      }

      const modalities = Array.isArray(parsedBody?.modalities)
        ? (parsedBody?.modalities as string[])
        : [];
      const requestedModel =
        typeof parsedBody?.model === 'string' ? parsedBody.model : '';
      const isImageGenerationRequest =
        modalities.includes('image') ||
        requestedModel.includes('banana') ||
        requestedModel.includes('-image');

      const logOpenRouterUsage = (
        callType: 'image-generation' | 'vision-json' | 'generic',
        requestedModelId: string,
        rawJsonText: string,
        elapsedMs: number
      ) => {
        try {
          const parsed = JSON.parse(rawJsonText) as Record<string, unknown>;
          const usage = (parsed.usage ?? {}) as Record<string, unknown>;
          const entry = {
            timestampIso: new Date().toISOString(),
            callType,
            requestedModel: requestedModelId,
            resolvedModel: typeof parsed.model === 'string' ? parsed.model : requestedModelId,
            generationId: typeof parsed.id === 'string' ? parsed.id : undefined,
            promptTokens: Number(usage.prompt_tokens ?? 0),
            completionTokens: Number(usage.completion_tokens ?? 0),
            totalTokens: Number(usage.total_tokens ?? 0),
            costUsd:
              typeof usage.cost === 'number'
                ? usage.cost
                : typeof usage.total_cost === 'number'
                ? usage.total_cost
                : null,
            costDetails: usage.cost_details ?? null,
            elapsedMs,
          };
          const ledgerPath =
            '/Users/omarkreidieh/.gemini/antigravity/brain/f4cd9900-6223-4023-881a-d8229260fb05/scratch/openrouter_cost_ledger.jsonl';
          if (fs && typeof fs.appendFileSync === 'function') {
            fs.appendFileSync(ledgerPath, JSON.stringify(entry) + '\n', 'utf-8');
          }
        } catch {
          // Ignore logging errors
        }
      };

      if (parsedBody && isImageGenerationRequest) {
        const normalizedMessages = normalizeImageMessages(parsedBody.messages);
        const orderedImageModels = [
          requestedModel,
          requestedModel,
          ...IMAGE_GENERATION_MODEL_CASCADE.filter((m) => m !== requestedModel),
        ].filter(Boolean);
        let lastStatus = 502;
        let lastResponseText = '';

        for (const candidateModel of orderedImageModels) {
          const t0 = Date.now();
          const candidateBody = JSON.stringify({
            ...parsedBody,
            model: candidateModel,
            modalities: ['image', 'text'],
            messages: normalizedMessages,
            usage: { include: true },
          });

          try {
            const timeoutMs = candidateModel.startsWith('openai/gpt-5') ? 165000 : 55000;
            const signal =
              typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
                ? AbortSignal.timeout(timeoutMs)
                : undefined;

            const upstreamResponse = await fetch(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'http://localhost:5173',
                  'X-Title': 'Atelier Vue AI Studio',
                },
                body: candidateBody,
                ...(signal ? { signal } : {}),
              }
            );

            const responseText = await upstreamResponse.text();
            const elapsedMs = Date.now() - t0;
            lastStatus = upstreamResponse.status;
            lastResponseText = responseText;

            if (upstreamResponse.ok) {
              try {
                const json = JSON.parse(responseText);
                if (responseHasGeneratedImage(json)) {
                  logOpenRouterUsage('image-generation', candidateModel, responseText, elapsedMs);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(responseText);
                  return;
                }
              } catch {
                // Try next image model in cascade
              }
            }
          } catch {
            // Upstream timed out or network error; retry or proceed to next candidate
          }
        }

        res.statusCode = lastStatus;
        res.setHeader('Content-Type', 'application/json');
        res.end(lastResponseText);
        return;
      }

      if (parsedBody && !isImageGenerationRequest) {
        const orderedVisionModels = [
          requestedModel,
          requestedModel,
          ...VISION_JSON_MODEL_CASCADE.filter((m) => m !== requestedModel),
        ].filter(Boolean);

        let lastStatus = 502;
        let lastResponseText = '';

        for (const candidateModel of orderedVisionModels) {
          const t0 = Date.now();
          const candidateBody = JSON.stringify({
            ...parsedBody,
            model: candidateModel,
            usage: { include: true },
          });

          try {
            const signal =
              typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
                ? AbortSignal.timeout(45000)
                : undefined;

            const upstreamResponse = await fetch(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'http://localhost:5173',
                  'X-Title': 'Atelier Vue AI Studio',
                },
                body: candidateBody,
                ...(signal ? { signal } : {}),
              }
            );

            const responseText = await upstreamResponse.text();
            const elapsedMs = Date.now() - t0;
            lastStatus = upstreamResponse.status;
            lastResponseText = responseText;

            if (upstreamResponse.ok) {
              logOpenRouterUsage('vision-json', candidateModel, responseText, elapsedMs);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(responseText);
              return;
            }
          } catch {
            // Upstream timed out or network error; retry or proceed to next candidate
          }
        }

        res.statusCode = lastStatus;
        res.setHeader('Content-Type', 'application/json');
        res.end(lastResponseText);
        return;
      }

      const t0 = Date.now();
      const upstreamResponse = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:5173',
            'X-Title': 'Atelier Vue AI Studio',
          },
          body: rawBody,
        }
      );

      const responseBodyText = await upstreamResponse.text();
      logOpenRouterUsage('generic', requestedModel, responseBodyText, Date.now() - t0);
      res.statusCode = upstreamResponse.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(responseBodyText);
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: {
            message:
              error instanceof Error
                ? `OpenRouter proxy request failed: ${error.message}`
                : 'OpenRouter proxy request failed',
          },
        })
      );
    }
  });
}

export function openRouterProxyPlugin(): Plugin {
  return {
    name: 'atelier-vue-openrouter-proxy',
    configureServer(server) {
      attachOpenRouterMiddleware(server as unknown as MiddlewareServerLike);
    },
    configurePreviewServer(server) {
      attachOpenRouterMiddleware(server as unknown as MiddlewareServerLike);
    },
  };
}

const resolvedStartupApiKey = resolveOpenRouterApiKey();
if (resolvedStartupApiKey && nodeProcess?.env) {
  if (!nodeProcess.env.OPENROUTER_API_KEY) {
    nodeProcess.env.OPENROUTER_API_KEY = resolvedStartupApiKey;
  }
  if (!nodeProcess.env.VITE_OPENROUTER_API_KEY) {
    nodeProcess.env.VITE_OPENROUTER_API_KEY = resolvedStartupApiKey;
  }
}

export default defineConfig({
  plugins: [react(), openRouterProxyPlugin()],
  define:
    resolvedStartupApiKey && !nodeProcess?.env?.VITE_OPENROUTER_API_KEY
      ? {
          'import.meta.env.VITE_OPENROUTER_API_KEY': JSON.stringify(
            resolvedStartupApiKey
          ),
        }
      : resolvedStartupApiKey
        ? {
            'import.meta.env.VITE_OPENROUTER_API_KEY': JSON.stringify(
              resolvedStartupApiKey
            ),
          }
        : undefined,
  test: {
    environment: 'jsdom',
    globals: true,
  },
} as Parameters<typeof defineConfig>[0] & {
  test?: { environment: string; globals: boolean };
});

