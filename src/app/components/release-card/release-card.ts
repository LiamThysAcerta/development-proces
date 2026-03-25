import { Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Release, ReleaseStatus, getEnvironment } from '../../models/release.model';
import { StatusBadgeComponent } from '../status-badge/status-badge';
import { PRStatusPanelComponent } from '../pr-status-panel/pr-status-panel';
import { CountdownTimerComponent } from '../countdown-timer/countdown-timer';

const BORDER_COLORS: Record<ReleaseStatus, string> = {
  development: 'border-l-slate-400',
  'acc-setup': 'border-l-amber-400',
  'acc-review': 'border-l-blue-400',
  'acc-release': 'border-l-indigo-400',
  'acc-done': 'border-l-emerald-400',
  'prd-setup': 'border-l-teal-400',
  'prd-review': 'border-l-cyan-400',
  'prd-release': 'border-l-orange-400',
  'prd-done': 'border-l-green-400',
  'on-hold': 'border-l-yellow-400',
};

@Component({
  selector: 'app-release-card',
  standalone: true,
  imports: [
    DatePipe,
    StatusBadgeComponent,
    PRStatusPanelComponent,
    CountdownTimerComponent,
  ],
  templateUrl: './release-card.html',
})
export class ReleaseCardComponent {
  release = input.required<Release>();
  expanded = signal(false);

  environment = computed(() => getEnvironment(this.release().status));

  cardCls = computed(() => {
    const color = BORDER_COLORS[this.release().status] ?? 'border-l-gray-200';
    return `bg-white rounded-xl border border-gray-200 border-l-4 ${color} shadow-sm transition-shadow hover:shadow-md`;
  });

  firstAccDate = computed(() => this.release().accDeployments[0]?.date ?? null);
  lastAccDate = computed(() => {
    const d = this.release().accDeployments;
    return d.length ? d[d.length - 1].date : null;
  });

  currentAccDate = computed(() => {
    const release = this.release();
    if (!release.accDeployments.length) return null;
    const index = Math.max(
      0,
      Math.min(release.currentAccRound - 1, release.accDeployments.length - 1),
    );
    return release.accDeployments[index].date;
  });

  nextDate = computed<Date | null>(() => {
    const r = this.release();
    switch (r.status) {
      case 'development': {
        const firstAcc = r.accDeployments[0]?.date;
        return firstAcc ? this.withTime(firstAcc, 12, 0) : null;
      }
      case 'acc-setup':
        return this.withTime(this.currentAccDate(), 12, 15);
      case 'acc-review':
        return this.withTime(this.currentAccDate(), 16, 0);
      case 'acc-release':
        return this.withTime(this.currentAccDate(), 17, 0);
      case 'acc-done':
        return r.currentAccRound >= r.accDeployments.length ? r.prdSetupDate : null;
      case 'prd-setup':
        return r.prdSetupDate;
      case 'prd-review':
      case 'prd-release':
        return r.prdDeployDate;
      default:
        return null;
    }
  });

  nextDateLabel = computed(() => {
    const r = this.release();
    switch (r.status) {
      case 'development':
        return 'TST ends at 12:00 on ACC release moment';
      case 'acc-setup':
        return `ACC Round ${r.currentAccRound} Setup (before 12:15)`;
      case 'acc-review':
        return `ACC Round ${r.currentAccRound} Review ends (16:00)`;
      case 'acc-release':
        return `ACC Round ${r.currentAccRound} Deploy`;
      case 'acc-done':
        return r.currentAccRound >= r.accDeployments.length
          ? 'PRD setup deadline'
          : 'Next ACC round';
      case 'prd-setup':
        return 'PRD Setup (Friday before PRD week)';
      case 'prd-review':
        return 'PRD Review ends before deploy';
      case 'prd-release':
        return 'PRD Deploy';
      default:
        return '';
    }
  });

  pendingCount = computed(
    () => this.release().prs.filter((p) => p.status === 'pending' || p.status === 'draft').length,
  );

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  private withTime(date: Date | null, hours: number, minutes: number): Date | null {
    if (!date) return null;
    const value = new Date(date);
    value.setHours(hours, minutes, 0, 0);
    return value;
  }

  private getNextStatus(release: Release): ReleaseStatus {
    switch (release.status) {
      case 'development':
        return 'acc-setup';
      case 'acc-setup':
        return 'acc-review';
      case 'acc-review':
        return 'acc-release';
      case 'acc-release':
        return 'acc-done';
      case 'acc-done':
        return release.currentAccRound < release.accDeployments.length ? 'acc-setup' : 'prd-setup';
      case 'prd-setup':
        return 'prd-review';
      case 'prd-review':
        return 'prd-release';
      case 'prd-release':
        return 'prd-done';
      case 'on-hold':
        return 'development';
      default:
        return release.status;
    }
  }
}
