import type { ReactNode } from 'react';

type Tone = 'accent' | 'neutral' | 'outline' | 'success' | 'warning' | 'danger' | 'info';

export function Tag({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`k-tag k-tag--${tone}`}>{children}</span>;
}
