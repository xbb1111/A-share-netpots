import type { LucideIcon } from 'lucide-react';

type SectionHeaderProps = {
  icon: LucideIcon;
  title: string;
  eyebrow: string;
};

export function SectionHeader({ icon: Icon, title, eyebrow }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <Icon size={20} aria-hidden="true" />
    </div>
  );
}
