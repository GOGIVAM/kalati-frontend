import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { TransparencyBanner } from '@/components/layout/Transparency';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Composer } from '@/components/chat/Composer';
import { Button } from '@/components/common/Button';
import { LoadingBlock } from '@/components/common/States';
import { useChat } from '@/hooks/useChat';
import {
  useConversation,
  useCreateConversation,
  useScopes,
} from '@/hooks/useConversations';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useOnline, useQuestionQueue } from '@/hooks/useOnline';

export function ChatPage() {
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();

  const activeId = conversationId ?? null;
  const { scopes } = useScopes();
  const selectedScopes = useUiStore((s) => s.scopes);
  const setScopes = useUiStore((s) => s.setScopes);

  const defaultScopes = useAuthStore((s) => s.user?.defaultScopes);

  const conversation = useConversation(activeId);
  const create = useCreateConversation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const online = useOnline();
  const enqueue = useQuestionQueue((s) => s.enqueue);
  const shiftQueue = useQuestionQueue((s) => s.shift);
  const queuedCount = useQuestionQueue((s) => s.items.length);

  // Périmètres par défaut du profil, appliqués une seule fois.
  useEffect(() => {
    if (seededRef.current) return;
    if (defaultScopes?.length) setScopes(defaultScopes);
    seededRef.current = true;
  }, [defaultScopes, setScopes]);

  const ensureConversation = useCallback(async () => {
    const created = await create.mutateAsync(selectedScopes);
    navigate(`/c/${created.id}`, { replace: true });
    return created.id;
  }, [create, navigate, selectedScopes]);

  const { messages, ask, stop, busy } = useChat({
    conversationId: activeId,
    initialMessages: conversation.data?.messages ?? [],
    ensureConversation,
    onFirstAnswer: () => client.invalidateQueries({ queryKey: ['conversations'] }),
  });

  // Suit le bas du fil pendant la génération.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  /** Hors ligne : la question est mise en file plutôt que perdue. */
  const send = useCallback(
    (question: string) => {
      if (!online) {
        enqueue(question, selectedScopes);
        return;
      }
      void ask(question, selectedScopes);
    },
    [ask, enqueue, online, selectedScopes],
  );

  // Rejoue la file dès le rétablissement de l'intranet, une question à la fois.
  useEffect(() => {
    if (!online || busy || queuedCount === 0) return;
    const next = shiftQueue();
    if (next) void ask(next.question, next.scopes);
  }, [ask, busy, online, queuedCount, shiftQueue]);

  const loading = Boolean(activeId) && conversation.isPending;
  const title = conversation.data?.title ?? '';

  return (
    <AppShell>
      {title ? (
        <header className="k-chat__head">
          <h1 className="k-chat__title">{title}</h1>
          {selectedScopes.length ? (
            <span className="k-chat__pill">
              {selectedScopes.length === 1
                ? t(`scopes.${selectedScopes[0]}`, selectedScopes[0])
                : t('chat.scopeCount', { count: selectedScopes.length })}
            </span>
          ) : null}
        </header>
      ) : null}

      {!loading && messages.length === 0 ? (
        <div className="k-chat k-chat--empty">
          <div className="k-chat__pad">
          <div className="k-hero">
            <img className="k-hero__logo" src="/logo1.png" alt="CAMRAIL" />
            <h1 className="k-hero__title">{t('chat.emptyTitle')}</h1>
            <p className="k-hero__lead">{t('chat.emptyBody')}</p>

            <Composer
              variant="inline"
              busy={busy || create.isPending}
              offline={!online}
              scopes={scopes}
              onSend={send}
              onStop={stop}
            />

            <div className="k-suggest">
              {scopes.slice(0, 3).map((scope) => {
                const example = t(`examples.${scope.code}`, '');
                if (!example) return null;
                return (
                  <button
                    key={scope.code}
                    type="button"
                    className="k-suggest__item"
                    onClick={() => send(example)}
                  >
                    <span className="k-suggest__icon" aria-hidden="true">
                      <FileText size={16} />
                    </span>
                    <span className="k-suggest__scope">
                      {t(`scopes.${scope.code}`, scope.label)}
                    </span>
                    <span className="k-suggest__text">{example}</span>
                  </button>
                );
              })}
            </div>
          </div>
          </div>
          <TransparencyBanner />
        </div>
      ) : (
        <div className="k-chat">
          <div className="k-chat__scroll" ref={scrollRef}>
            <div className="k-chat__inner">
              {loading ? <LoadingBlock /> : null}

              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {conversation.isError && activeId ? (
                <div className="k-row">
                  <Button variant="secondary" onClick={() => void conversation.refetch()}>
                    {t('common.retry')}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <Composer
            busy={busy || create.isPending}
            offline={!online}
            scopes={scopes}
            onSend={send}
            onStop={stop}
          />

          <TransparencyBanner />
        </div>
      )}
    </AppShell>
  );
}
