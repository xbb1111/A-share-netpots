import type { OverviewMetric } from '../data/types';

type MetricCardProps = {
  metric: OverviewMetric;
};

export function MetricCard({ metric }: MetricCardProps) {
  const Icon = metric.icon;

  return (
    <section className={`metric-card metric-card--${metric.tone}`} aria-label={metric.label}>
      <div className="metric-card__top">
        <span>{metric.label}</span>
        <Icon size={18} aria-hidden="true" />
      </div>
      <strong>{metric.value}</strong>
      <p>{metric.detail}</p>
    </section>
  );
}
