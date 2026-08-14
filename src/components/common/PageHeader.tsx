import type { ReactNode } from 'react';

interface PageHeaderProps {
  kicker?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
}

export function PageHeader({ kicker, title, lead, actions }: PageHeaderProps) {
  return (
    <header className="k-page__header">
      <div>
        {kicker ? <p className="k-page__kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {lead ? <p className="k-page__lead">{lead}</p> : null}
      </div>
      {actions ? <div className="k-row">{actions}</div> : null}
    </header>
  );
}
