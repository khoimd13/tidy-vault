const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

function monthOf(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : MONTH.format(new Date(t));
}

export function formatSpan(span: { from: string; to: string }): string {
  const from = monthOf(span.from);
  const to = monthOf(span.to);
  return from === to ? `Mostly ${from}` : `Mostly ${from} – ${to}`;
}
