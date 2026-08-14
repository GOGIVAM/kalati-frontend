import { useTranslation } from 'react-i18next';
import { CheckChip } from '@/components/common/Form';
import { useUiStore } from '@/store/uiStore';
import type { Scope } from '@/types';

/** Filtres par périmètre métier appliqués à la recherche documentaire (§ II). */
export function ScopeFilter({ scopes }: { scopes: Scope[] }) {
  const { t } = useTranslation();
  const selected = useUiStore((s) => s.scopes);
  const toggleScope = useUiStore((s) => s.toggleScope);
  const setScopes = useUiStore((s) => s.setScopes);

  return (
    <div className="k-row" style={{ gap: 'var(--space-2)' }}>
      <span
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {t('chat.scopes')}
      </span>
      <div className="k-scopes">
        <CheckChip
          checked={selected.length === 0}
          onChange={() => setScopes([])}
          label={t('chat.scopesAll')}
        />
        {scopes.map((scope) => (
          <CheckChip
            key={scope.code}
            checked={selected.includes(scope.code)}
            onChange={() => toggleScope(scope.code)}
            label={t(`scopes.${scope.code}`, scope.label)}
          />
        ))}
      </div>
    </div>
  );
}
