import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Release, PRStatus, ReleaseStatus, getEnvironment } from '../../models/release.model';
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
    FormsModule,
  ],
  templateUrl: './release-card.html',
})
export class ReleaseCardComponent {
  release = input.required<Release>();
  expanded = signal(false);
  showAccForm = signal(false);
  newAccDate = signal('');

  prStatusChange = output<{ releaseId: string; prId: string; status: PRStatus }>();
  statusChange = output<{ releaseId: string; status: ReleaseStatus }>();
  accDeploymentAdd = output<{ releaseId: string; date: Date; notes?: string }>();
  deleteRelease = output<string>();

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

  nextStatus = computed(() => this.getNextStatus(this.release()));

  nextStatusLabel = computed(() => {
    const labels: Record<ReleaseStatus, string> = {
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
    };
    return labels[this.nextStatus()] ?? this.nextStatus();
  });

  advanceLabel = computed(() => {
    const r = this.release();
    const next = this.nextStatus();
    if (r.status === 'acc-done' && next === 'acc-setup') {
      return `Start ACC Round ${r.currentAccRound + 1}`;
    }
    return `Advance to ${this.nextStatusLabel()}`;
  });

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  onPRChange(event: { pr: { id: string }; status: PRStatus }): void {
    this.prStatusChange.emit({
      releaseId: this.release().id,
      prId: event.pr.id,
      status: event.status,
    });
  }

  advance(): void {
    const next = this.nextStatus();
    if (next && next !== this.release().status) {
      this.statusChange.emit({ releaseId: this.release().id, status: next });
    }
  }

  onDelete(): void {
    this.deleteRelease.emit(this.release().id);
  }

  submitAccRound(): void {
    const dateStr = this.newAccDate();
    if (!dateStr) return;
    this.accDeploymentAdd.emit({ releaseId: this.release().id, date: new Date(dateStr) });
    this.newAccDate.set('');
    this.showAccForm.set(false);
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
