import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Copy, Square, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { useLocale } from '@/hooks/useLocale';
import { usePrefsStore } from '@/store/prefsStore';
import { formatTime } from '@/lib/format';
import { CitationList } from './CitationList';
import { CalibratedRefusal } from './CalibratedRefusal';
import { AnswerMeta } from './AnswerMeta';
import { QualityPanel } from './QualityPanel';
import { FallbackNotice, VerificationNotice } from './VerificationNotice';
import { chatService } from '@/services/chat.service';
import { useSpeech } from '@/hooks/useVoice';
import { env } from '@/lib/env';
import type { ChatMessage } from '@/types';

function StageLine({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  if (!message.streaming || !message.stage) return null;
  return (
    <p className="k-stage">
      <span className="k-spin" aria-hidden="true" />
      {t(`chat.stages.${message.stage}`, { iteration: message.iterations ?? 1 })}
    </p>
  );
}

function Feedback({ messageId }: { messageId: string }) {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const speech = useSpeech();
  const speaking = speech.playingId === messageId;

  const listenButton = env.voiceEnabled ? (
    <Button
      variant="ghost"
      icon
      size="sm"
      aria-label={speaking ? t('voice.stopListening') : t('voice.listen')}
      title={speaking ? t('voice.stopListening') : t('voice.listen')}
      onClick={() => void speech.play(messageId)}
    >
      {speaking ? <Square size={14} /> : <Volume2 size={14} />}
    </Button>
  ) : null;

  if (sent) {
    return (
      <span className="k-row" style={{ gap: 'var(--space-2)' }}>
        {listenButton}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
          {t('chat.feedbackSent')}
        </span>
      </span>
    );
  }

  const send = (verdict: 'useful' | 'not_useful') => {
    setSent(true);
    void chatService.feedback(messageId, verdict).catch(() => undefined);
  };

  return (
    <span className="k-row" style={{ gap: 0 }}>
      {listenButton}
      <Button
        variant="ghost"
        icon
        size="sm"
        aria-label={t('chat.copy')}
        onClick={() => {
          const node = document.getElementById(`msg-${messageId}`);
          if (node?.textContent) {
            void navigator.clipboard.writeText(node.textContent).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </Button>
      <Button
        variant="ghost"
        icon
        size="sm"
        aria-label={t('chat.useful')}
        onClick={() => send('useful')}
      >
        <ThumbsUp size={14} />
      </Button>
      <Button
        variant="ghost"
        icon
        size="sm"
        aria-label={t('chat.notUseful')}
        onClick={() => send('not_useful')}
      >
        <ThumbsDown size={14} />
      </Button>
    </span>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const isUser = message.role === 'user';
  const showQuality = usePrefsStore((s) => s.showQuality);
  const time = formatTime(message.createdAt, locale);

  return (
    <article className={`k-msg k-msg--${isUser ? 'user' : 'assistant'}`}>
      <header className="k-msg__who">
        {isUser ? (
          <>
            {time ? <span className="k-msg__time">{time}</span> : null}
            <span className="k-msg__name">{t('chat.you')}</span>
            <Avatar size={26} />
          </>
        ) : (
          <>
            <img className="k-msg__logo" src="/logo1.png" alt="" aria-hidden="true" />
            <span className="k-msg__name">{t('chat.assistant')}</span>
            {time ? <span className="k-msg__time">{time}</span> : null}
          </>
        )}
      </header>

      {message.refusal ? (
        <CalibratedRefusal refusal={message.refusal} />
      ) : message.error ? (
        <div className="k-refusal" style={{ borderColor: 'var(--color-danger)' }}>
          <p className="k-refusal__title" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle size={16} />
            {t('common.error')}
          </p>
          <p className="k-refusal__body">{message.error}</p>
        </div>
      ) : (
        <div className="k-msg__body" id={`msg-${message.id}`}>
          {message.content}
          {message.streaming ? <span className="k-caret" aria-hidden="true" /> : null}
        </div>
      )}

      <StageLine message={message} />

      {!isUser && message.modelFallback ? <FallbackNotice /> : null}

      {!isUser && message.criticalVerification ? (
        <VerificationNotice verification={message.criticalVerification} />
      ) : null}

      {!isUser && message.citations?.length ? (
        <CitationList citations={message.citations} />
      ) : null}

      {!isUser && !message.streaming && message.ragas && showQuality ? (
        <QualityPanel ragas={message.ragas} />
      ) : null}

      {!isUser && !message.streaming && !message.error ? (
        <div className="k-row" style={{ gap: 'var(--space-2)' }}>
          <AnswerMeta message={message} />
          <span className="k-spacer" />
          <Feedback messageId={message.id} />
        </div>
      ) : null}
    </article>
  );
}
