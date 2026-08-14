import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService } from '@/services/chat.service';
import type { StreamEvent } from '@/services/chat.service';
import { ApiError } from '@/lib/httpClient';
import type { ChatMessage } from '@/types';

/**
 * Fait « couler » le texte reçu caractère par caractère.
 *
 * Le backend peut envoyer des jetons très irréguliers (ou, en repli non-SSE,
 * la réponse entière d'un bloc). Ce tampon lisse l'affichage sans jamais
 * retarder la fin : plus le tampon est rempli, plus le débit accélère.
 */
const TICK_MS = 24;

const drainSize = (pendingLength: number) => Math.max(2, Math.ceil(pendingLength / 24));

interface UseChatOptions {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  /**
   * Crée une conversation à la volée quand l'agent envoie sa première
   * question depuis un écran vierge, et renvoie son identifiant.
   */
  ensureConversation?: () => Promise<string | null>;
  onFirstAnswer?: () => void;
}

export function useChat({
  conversationId,
  initialMessages,
  ensureConversation,
  onFirstAnswer,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef('');
  const activeIdRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  /** Conversation à laquelle le fil affiché est rattaché. */
  const boundIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    // Une conversation créée par `ask` ne doit pas vider le fil en cours.
    if (conversationId && conversationId === boundIdRef.current) return;
    boundIdRef.current = conversationId;
    setMessages(initialMessages);
    pendingRef.current = '';
    activeIdRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const patch = useCallback((id: string, changes: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setInterval(() => {
      const id = activeIdRef.current;
      if (!id) return;
      const pending = pendingRef.current;
      if (!pending) return;
      const slice = pending.slice(0, drainSize(pending.length));
      pendingRef.current = pending.slice(slice.length);
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: m.content + slice } : m)),
      );
    }, TICK_MS);
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  /** Vide le tampon d'un coup — utilisé à la fin du flux. */
  const flushPending = useCallback(() => {
    const id = activeIdRef.current;
    const pending = pendingRef.current;
    pendingRef.current = '';
    if (id && pending) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: m.content + pending } : m)),
      );
    }
  }, []);

  const ask = useCallback(
    async (question: string, scopes: string[]) => {
      if (busy || !question.trim()) return;

      const cid = conversationId ?? (await ensureConversation?.()) ?? null;
      if (!cid) return;
      boundIdRef.current = cid;

      setError(null);
      setBusy(true);

      const now = new Date().toISOString();
      const localAssistantId = `pending_${Date.now()}`;
      activeIdRef.current = localAssistantId;
      pendingRef.current = '';

      setMessages((prev) => [
        ...prev,
        { id: `local_${Date.now()}`, role: 'user', content: question, createdAt: now },
        {
          id: localAssistantId,
          role: 'assistant',
          content: '',
          createdAt: now,
          streaming: true,
          stage: 'retrieval',
          citations: [],
        },
      ]);

      startTimer();

      const controller = new AbortController();
      abortRef.current = controller;

      const handle = (event: StreamEvent) => {
        const id = activeIdRef.current;
        if (!id) return;
        switch (event.type) {
          case 'accepted':
            // On remplace l'identifiant local par celui du serveur.
            activeIdRef.current = event.messageId;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id
                  ? { ...m, id: event.messageId, queryClass: event.queryClass ?? null }
                  : m,
              ),
            );
            break;
          case 'stage':
            patch(activeIdRef.current ?? id, { stage: event.stage, iterations: event.iteration });
            break;
          case 'citations':
            patch(activeIdRef.current ?? id, { citations: event.citations });
            break;
          case 'token':
            pendingRef.current += event.text;
            break;
          case 'refusal':
            pendingRef.current = '';
            patch(activeIdRef.current ?? id, {
              content: '',
              refusal: {
                reason: event.reason,
                faithfulness: event.faithfulness ?? null,
                confidence: event.confidence ?? null,
                message: event.message ?? null,
                nearestSources: event.nearestSources ?? null,
              },
              stage: null,
            });
            break;
          case 'done':
            flushPending();
            patch(activeIdRef.current ?? id, {
              streaming: false,
              stage: null,
              model: event.model ?? null,
              ragas: event.ragas ?? null,
              criticalVerification: event.criticalVerification ?? null,
              modelFallback: event.modelFallback ?? null,
              ...(event.queryClass ? { queryClass: event.queryClass } : {}),
              faithfulness: event.faithfulness ?? null,
              confidence: event.confidence ?? null,
              latencyMs: event.latencyMs ?? null,
              iterations: event.iterations ?? null,
            });
            break;
          case 'error':
            pendingRef.current = '';
            patch(activeIdRef.current ?? id, {
              streaming: false,
              stage: null,
              error: event.message,
            });
            setError(event.message);
            break;
        }
      };

      try {
        await chatService.askStream({ conversationId: cid, question, scopes }, handle, controller.signal);
        flushPending();
        const id = activeIdRef.current;
        if (id) patch(id, { streaming: false, stage: null });
        onFirstAnswer?.();
      } catch (cause) {
        const message =
          cause instanceof ApiError ? cause.message : 'La génération a échoué.';
        const id = activeIdRef.current;
        if (id) patch(id, { streaming: false, stage: null, error: message });
        setError(message);
      } finally {
        stopTimer();
        activeIdRef.current = null;
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, conversationId, ensureConversation, flushPending, onFirstAnswer, patch, startTimer, stopTimer],
  );

  const stop = useCallback(() => {
    const id = activeIdRef.current;
    abortRef.current?.abort();
    flushPending();
    stopTimer();
    if (id) {
      patch(id, { streaming: false, stage: null });
      void chatService.stop(id).catch(() => undefined);
    }
    activeIdRef.current = null;
    setBusy(false);
  }, [flushPending, patch, stopTimer]);

  return { messages, setMessages, ask, stop, busy, error };
}
