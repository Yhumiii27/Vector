// A notice above a page's content (Callout of the charter): a title and its text. Server-compatible.
import type { ReactNode } from 'react';
import { Callout } from '@/components/app/Callout';

export function Notice({ title, warn, children }: { title?: ReactNode; warn?: boolean; children?: ReactNode }) {
  return (
    <Callout variant={warn ? 'emphasis' : 'outlined'} tone={warn ? 'accent' : 'neutral'} alignStart role="note">
      <div>
        {title && <strong>{title}</strong>}
        {title && children ? ' — ' : null}
        {children}
      </div>
    </Callout>
  );
}
