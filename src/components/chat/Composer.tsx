import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Plus, Send, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ScopeFilter } from './ScopeFilter';
import { useVoiceInput } from '@/hooks/useVoice';
import { env } from '@/lib/env';
import { usePrefsStore } from '@/store/prefsStore';
import type { Scope } from '@/types';

interface ComposerProps {
  busy: boolean;
  offline?: boolean;
  scopes: Scope[];
  onSend: (question: string) => void;
  onStop: () => void;
  /** `inline` : posé dans l'accueil centré, sans filet haut. */
  variant?: 'docked' | 'inline';
}

export function Composer({
  busy,
  offline = false,
  scopes,
  onSend,
  onStop,
  variant = 'docked',
}: ComposerProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [showScopes, setShowScopes] = useState(false);
  const enterToSend = usePrefsStore((s) => s.enterToSend);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput((text) =>
    setValue((current) => (current ? `${current} ${text}` : text)),
  );
  const voiceAvailable = env.voiceEnabled && voice.supported;

  // Hauteur automatique jusqu'à la limite CSS (max-height).
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  const submit = () => {
    const question = value.trim();
    if (!question || busy) return;
    onSend(question);
    setValue('');
  };

  return (
    <div className={`k-composer${variant === 'inline' ? ' k-composer--inline' : ''}`}>
      <div className="k-composer__inner">
        <div className="k-composer__box">
          <button
            type="button"
            className="k-composer__plus"
            aria-label={t('chat.scopesHint')}
            title={t('chat.scopesHint')}
            onClick={() => setShowScopes((value) => !value)}
          >
            <Plus size={17} />
          </button>
          <textarea
            ref={textareaRef}
            className="k-composer__input"
            rows={1}
            value={value}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && enterToSend) {
                event.preventDefault();
                submit();
              }
            }}
          />
          {voiceAvailable ? (
            <Button
              variant={voice.state === 'recording' ? 'danger' : 'ghost'}
              icon
              aria-label={
                voice.state === 'recording' ? t('voice.recording') : t('voice.dictate')
              }
              title={voice.state === 'recording' ? t('voice.recording') : t('voice.dictate')}
              disabled={voice.state === 'transcribing' || offline}
              onClick={() => (voice.state === 'recording' ? voice.stop() : void voice.start())}
            >
              {voice.state === 'transcribing' ? (
                <Loader2 size={16} className="k-rotate" />
              ) : (
                <Mic size={16} />
              )}
            </Button>
          ) : null}
          {busy ? (
            <Button variant="secondary" icon onClick={onStop} aria-label={t('chat.stop')} title={t('chat.stop')}>
              <Square size={14} />
            </Button>
          ) : (
            <Button
              variant="primary"
              icon
              disabled={!value.trim()}
              onClick={submit}
              aria-label={t('chat.send')}
              title={t('chat.send')}
            >
              <Send size={16} />
            </Button>
          )}
        </div>
        <div className="k-composer__under">
          {showScopes ? <ScopeFilter scopes={scopes} /> : null}
          <p className="k-composer__hint">
          {offline
            ? t('offline.composerDisabled')
            : voice.state === 'recording'
              ? t('voice.recording')
              : voice.state === 'transcribing'
                ? t('voice.transcribing')
                : voice.error
                  ? voice.error
                  : `${t('chat.hint')} · ${t('chat.scopesHint')}`}
          </p>
        </div>
      </div>
    </div>
  );
}
