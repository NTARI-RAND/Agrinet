'use client';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

export function Badge({ variant, children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  const cls = STATUS_BADGE[status] || 'badge-gray';
  const label = STATUS_LABEL[status] || status || '—';
  return <span className={`badge ${cls}`}>{t(label)}</span>;
}
