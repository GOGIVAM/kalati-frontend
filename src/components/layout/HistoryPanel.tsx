import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Dialog } from '@/components/common/Dialog';
import { Spinner } from '@/components/common/States';
import { useConversations, useDeleteConversation } from '@/hooks/useConversations';
import { useLocale } from '@/hooks/useLocale';
import { formatDateTime } from '@/lib/format';

/** Colonne de droite : rappel des questions posées, de leur périmètre et
    des documents cités, avec accès direct à une nouvelle conversation. */
export function HistoryPanel() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const { data, isPending } = useConversations();
  const remove = useDeleteConversation();
  const [confirmClear, setConfirmClear] = useState(false);

  const items = data?.items ?? [];

  const clearAll = () => {
    items.forEach((conversation) => remove.mutate(conversation.id));
    setConfirmClear(false);
    navigate('/');
  };

  return (
    <aside className="k-aside" aria-label={t('history.panelTitle')}>
      <header className="k-aside__head">
        <h2 className="k-aside__title">{t('history.panelTitle')}</h2>
        <button
          type="button"
          className="k-aside__clear"
          disabled={items.length === 0}
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 size={14} />
          {t('history.clearAll')}
        </button>
      </header>

      <div className="k-aside__scroll">
        {isPending ? (
          <div style={{ padding: 'var(--space-4)' }}>
            <Spinner label={t('common.loading')} />
          </div>
        ) : null}

        {!isPending && items.length === 0 ? (
          <p className="k-aside__empty">{t('history.empty')}</p>
        ) : null}

        {items.map((conversation) => (
          <article key={conversation.id} className="k-aside__entry">
            <div className="k-aside__entry-head">
              <span className="k-aside__kicker">{t('history.question')}</span>
              <span className="k-aside__time">
                {formatDateTime(conversation.updatedAt, locale)}
              </span>
            </div>

            <button
              type="button"
              className="k-aside__quote"
              onClick={() => navigate(`/c/${conversation.id}`)}
            >
              « {conversation.title} »
            </button>

            {conversation.scopes.length ? (
              <>
                <p className="k-aside__kicker">{t('history.scopes')}</p>
                <div className="k-aside__chips">
                  {conversation.scopes.map((scope) => (
                    <span key={scope} className="k-aside__chip">
                      {t(`scopes.${scope}`, scope)}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            <p className="k-aside__kicker">{t('history.exchange')}</p>
            <div className="k-aside__files">
              <span className="k-aside__file">
                <FileText size={13} />
                {t('history.messages', { count: conversation.messageCount })}
              </span>
            </div>
          </article>
        ))}
      </div>

      <footer className="k-aside__foot">
        <Button variant="primary" block onClick={() => navigate('/')}>
          <Plus size={16} />
          {t('chat.newConversation')}
        </Button>
      </footer>

      <Dialog
        open={confirmClear}
        title={t('history.clearAll')}
        onClose={() => setConfirmClear(false)}
        actions={
          <>
            <Button variant="danger" onClick={clearAll}>
              {t('common.delete')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <p>{t('history.clearAllBody')}</p>
      </Dialog>
    </aside>
  );
}
