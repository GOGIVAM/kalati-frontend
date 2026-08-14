import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Form';
import { Tag } from '@/components/common/Tag';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/States';
import { useConversations } from '@/hooks/useConversations';
import { useLocale } from '@/hooks/useLocale';
import { formatDateTime, formatNumber } from '@/lib/format';

export function HistoryPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isPending, isError, error, refetch } = useConversations(search || undefined);

  return (
    <AppShell>
      <div className="k-page">
        <PageHeader
          kicker={t('app.name')}
          title={t('history.title')}
          lead={t('history.lead')}
          actions={
            <Button variant="primary" onClick={() => navigate('/')}>
              <MessageSquarePlus size={16} />
              {t('chat.newConversation')}
            </Button>
          }
        />

        <div className="k-row" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ position: 'relative', minWidth: 280 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-faint)',
              }}
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('history.search')}
              aria-label={t('history.search')}
              style={{ paddingLeft: 30 }}
            />
          </div>
        </div>

        {isPending ? <LoadingBlock /> : null}
        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {data && data.items.length === 0 ? (
          <EmptyState
            title={t('history.empty')}
            body={t('chat.emptyBody')}
            action={
              <Button variant="primary" onClick={() => navigate('/')}>
                {t('chat.newConversation')}
              </Button>
            }
          />
        ) : null}

        {data && data.items.length > 0 ? (
          <div className="k-table-wrap">
            <table className="k-table">
              <thead>
                <tr>
                  <th>{t('history.columns.title')}</th>
                  <th>{t('history.columns.scopes')}</th>
                  <th style={{ width: 110 }}>{t('history.columns.messages')}</th>
                  <th style={{ width: 180 }}>{t('history.columns.updated')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((conversation) => (
                  <tr
                    key={conversation.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/c/${conversation.id}`)}
                  >
                    <td style={{ fontWeight: 600 }}>{conversation.title}</td>
                    <td>
                      <span className="k-row" style={{ gap: 'var(--space-1)' }}>
                        {conversation.scopes.length === 0 ? (
                          <Tag tone="neutral">{t('chat.scopesAll')}</Tag>
                        ) : (
                          conversation.scopes.map((code) => (
                            <Tag key={code} tone="accent">
                              {t(`scopes.${code}`, code)}
                            </Tag>
                          ))
                        )}
                      </span>
                    </td>
                    <td className="k-num">{formatNumber(conversation.messageCount, locale)}</td>
                    <td className="k-num">{formatDateTime(conversation.updatedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
