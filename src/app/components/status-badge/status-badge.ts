import { Component, computed, input } from '@angular/core';
import { ReleaseStatus, PRStatus, Environment } from '../../models/release.model';

type BadgeValue = ReleaseStatus | PRStatus | Environment;

const LABELS: Record<string, string> = {
  // Release statuses
  development: 'Development',
  'acc-setup': 'Setup ACC',
  'acc-review': 'ACC Review',
  'acc-release': 'To Release in ACC',
  'acc-done': 'ACC Done',
  'prd-setup': 'Setup PRD',
  'prd-review': 'PRD Review',
  'prd-release': 'To Release in PRD',
  'prd-done': 'Completed',
  'on-hold': 'On Hold',
  // PR statuses
  pending: 'Pending Review',
  approved: 'Approved',
  merged: 'Merged',
  'changes-requested': 'Changes Requested',
  draft: 'Draft',
  // Environments
  DEV: 'DEV',
  TST: 'TST',
  ACC: 'ACC',
  PRD: 'PRD',
};

const COLORS: Record<string, string> = {
  // Release statuses
  development: 'bg-slate-100 text-slate-700 ring-slate-200',
  'acc-setup': 'bg-amber-100 text-amber-800 ring-amber-200',
  'acc-review': 'bg-blue-100 text-blue-800 ring-blue-200',
  'acc-release': 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  'acc-done': 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  'prd-setup': 'bg-teal-100 text-teal-800 ring-teal-200',
  'prd-review': 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  'prd-release': 'bg-orange-100 text-orange-800 ring-orange-200',
  'prd-done': 'bg-green-100 text-green-800 ring-green-200',
  'on-hold': 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  // PR statuses
  pending: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  approved: 'bg-blue-100 text-blue-800 ring-blue-200',
  merged: 'bg-green-100 text-green-800 ring-green-200',
  'changes-requested': 'bg-red-100 text-red-800 ring-red-200',
  draft: 'bg-gray-100 text-gray-600 ring-gray-200',
  // Environments
  DEV: 'bg-gray-100 text-gray-700 ring-gray-200',
  TST: 'bg-slate-100 text-slate-700 ring-slate-200',
  ACC: 'bg-blue-100 text-blue-800 ring-blue-200',
  PRD: 'bg-orange-100 text-orange-800 ring-orange-200',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span [class]="cls()">{{ text() }}</span>`,
})
export class StatusBadgeComponent {
  status = input.required<BadgeValue>();

  text = computed(() => LABELS[this.status()] ?? this.status());
  cls = computed(
    () =>
      `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${COLORS[this.status()] ?? 'bg-gray-100 text-gray-700 ring-gray-200'}`,
  );
}
