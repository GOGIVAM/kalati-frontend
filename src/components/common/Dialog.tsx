import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}

export function Dialog({ open, title, onClose, children, actions, wide }: DialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="k-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="k-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={wide ? { maxWidth: 760 } : undefined}
      >
        <div className="k-row k-dialog__title">
          <span>{title}</span>
          <span className="k-spacer" />
          <Button variant="ghost" icon aria-label={t('common.close')} onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="k-dialog__body">{children}</div>
        {actions ? <div className="k-dialog__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
