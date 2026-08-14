import { ApiError, authHeaders, buildUrl, credentialsMode, http } from '@/lib/httpClient';
import type {
  Citation,
  CriticalVerification,
  ModelInfo,
  PipelineStage,
  QueryClass,
  RagasScores,
  RefusalReason,
} from '@/types';

/* -------------------------------------------------------------------------
   Événements du flux SSE de génération.
   Contrat détaillé : API_CONTRACT.md § 3.
   ------------------------------------------------------------------------- */

export type StreamEvent =
  | { type: 'accepted'; messageId: string; conversationId: string; queryClass?: QueryClass }
  | { type: 'stage'; stage: PipelineStage; iteration?: number }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'token'; text: string }
  | {
      type: 'refusal';
      reason: RefusalReason;
      faithfulness?: number;
      confidence?: number;
      message?: string;
      nearestSources?: Citation[];
    }
  | {
      type: 'done';
      model?: ModelInfo;
      queryClass?: QueryClass;
      ragas?: RagasScores;
      criticalVerification?: CriticalVerification;
      modelFallback?: boolean;
      faithfulness?: number;
      confidence?: number;
      latencyMs?: number;
      iterations?: number;
    }
  | { type: 'error'; code: string; message: string };

export interface AskPayload {
  conversationId: string;
  question: string;
  scopes: string[];
}

/**
 * Interroge KALATI et consomme la réponse en flux (Server-Sent Events).
 *
 * EventSource n'est pas utilisable ici : la requête est un POST authentifié.
 * On lit donc le corps de la réponse à la main. Si le backend répond en JSON
 * plutôt qu'en SSE, la réponse complète est convertie en une séquence
 * d'événements équivalente, ce qui laisse l'interface identique.
 */
export async function askStream(
  payload: AskPayload,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(buildUrl('/api/chat/ask'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        ...authHeaders(),
      },
      credentials: credentialsMode,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (cause) {
    if ((cause as Error).name === 'AbortError') return;
    throw new ApiError(0, 'NETWORK_UNREACHABLE', 'Backend KALATI injoignable.');
  }

  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message = response.statusText;
    try {
      const body = await response.json();
      code = body.code ?? code;
      message = body.message ?? message;
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(response.status, code, message);
  }

  const contentType = response.headers.get('content-type') ?? '';

  // Repli non-SSE : une réponse JSON complète, rejouée en événements.
  if (!contentType.includes('text/event-stream')) {
    const message = await response.json();
    onEvent({
      type: 'accepted',
      messageId: message.id ?? 'ms_local',
      conversationId: payload.conversationId,
    });
    if (message.citations?.length) {
      onEvent({ type: 'citations', citations: message.citations });
    }
    if (message.refusal) {
      onEvent({ type: 'refusal', ...message.refusal });
    } else if (typeof message.content === 'string') {
      onEvent({ type: 'token', text: message.content });
    }
    onEvent({
      type: 'done',
      model: message.model,
      queryClass: message.queryClass,
      ragas: message.ragas,
      criticalVerification: message.criticalVerification,
      modelFallback: message.modelFallback,
      faithfulness: message.faithfulness,
      confidence: message.confidence,
      latencyMs: message.latencyMs,
      iterations: message.iterations,
    });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(0, 'STREAM_UNAVAILABLE', 'Flux de réponse indisponible.');

  const decoder = new TextDecoder();
  let buffer = '';

  const flushFrame = (frame: string) => {
    // Un cadre SSE peut porter plusieurs lignes `data:`.
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data || data === '[DONE]') return;
    try {
      onEvent(JSON.parse(data) as StreamEvent);
    } catch {
      // Cadre illisible : on l'ignore plutôt que d'interrompre la génération.
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        flushFrame(buffer.slice(0, separator));
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) flushFrame(buffer);
  } catch (cause) {
    if ((cause as Error).name !== 'AbortError') throw cause;
  } finally {
    reader.releaseLock();
  }
}

export const chatService = {
  askStream,

  stop(messageId: string) {
    return http.post<void>('/api/chat/stop', { messageId });
  },

  feedback(messageId: string, verdict: 'useful' | 'not_useful', comment?: string) {
    return http.post<void>(`/api/chat/messages/${encodeURIComponent(messageId)}/feedback`, {
      verdict,
      comment,
    });
  },
};
