import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/common/Dialog';
import { Button } from '@/components/common/Button';
import { useUiStore } from '@/store/uiStore';

const PRINCIPLES = ['p1', 'p2', 'p3', 'p4'] as const;

/** Guide d'utilisation distribué à la formation, accessible depuis l'interface. */
export function GuideDialog() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.guideOpen);
  const close = useUiStore((s) => s.closeGuide);

  return (
    <Dialog
      open={open}
      wide
      title={t('guide.title')}
      onClose={close}
      actions={
        <Button variant="primary" onClick={close}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="k-stack">
        <p className="k-page__lead" style={{ marginTop: 0 }}>
          {t('guide.lead')}
        </p>

        <ol className="k-stack" style={{ margin: 0, paddingLeft: '1.4em' }}>
          {PRINCIPLES.map((key) => (
            <li key={key}>
              <p style={{ fontWeight: 700 }}>{t(`guide.${key}Title`)}</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {t(`guide.${key}`)}
              </p>
            </li>
          ))}
        </ol>

        <hr className="k-hr" style={{ margin: 0 }} />

        <div>
          <p className="k-page__kicker">{t('guide.limits')}</p>
          <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
            {t('guide.limitsBody')}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
