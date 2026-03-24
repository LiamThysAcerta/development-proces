import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReleaseService } from '../../services/release.service';
import { Release, PRStatus, ReleaseStatus, ViewMode } from '../../models/release.model';
import { ReleaseCardComponent } from '../release-card/release-card';
import { TimelineViewComponent } from '../timeline-view/timeline-view';
import { CountdownTimerComponent } from '../countdown-timer/countdown-timer';
import { AddReleaseModalComponent } from '../add-release-modal/add-release-modal';
import { StatsRowComponent } from '../stats-row/stats-row';
import { GithubSettingsComponent } from '../github-settings/github-settings';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    ReleaseCardComponent,
    TimelineViewComponent,
    CountdownTimerComponent,
    AddReleaseModalComponent,
    StatsRowComponent,
    GithubSettingsComponent,
  ],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  private svc = inject(ReleaseService);

  showAddModal = signal(false);
  showSettingsModal = signal(false);

  releases = toSignal(this.svc.releases$, { initialValue: [] });
  nextActions = toSignal(this.svc.getNextActions(), { initialValue: [] });
  saveStatus = this.svc.saveStatus;

  view = signal<ViewMode>('kanban');

  // Stats
  totalCount = computed(() => this.releases().length);
  activeCount = computed(() => this.releases().filter((r) => r.status !== 'prd-done').length);
  pendingPRs = computed(
    () =>
      this.releases()
        .flatMap((r) => r.prs)
        .filter((p) => p.status === 'pending' || p.status === 'draft').length,
  );

  // Kanban columns grouped by environment
  columnGroups = computed(() => {
    const rs = this.releases();
    return [
      {
        env: 'TST',
        envCls: 'text-slate-600 bg-slate-50 border-slate-200',
        columns: [
          {
            id: 'development' as ReleaseStatus,
            title: 'Development',
            dotCls: 'bg-slate-400',
            releases: rs.filter((r) => r.status === 'development'),
          },
        ],
      },
      {
        env: 'ACC',
        envCls: 'text-blue-700 bg-blue-50 border-blue-200',
        columns: [
          {
            id: 'acc-setup' as ReleaseStatus,
            title: 'Setup ACC',
            dotCls: 'bg-amber-500',
            releases: rs.filter((r) => r.status === 'acc-setup'),
          },
          {
            id: 'acc-review' as ReleaseStatus,
            title: 'ACC Review',
            dotCls: 'bg-blue-500',
            releases: rs.filter((r) => r.status === 'acc-review'),
          },
          {
            id: 'acc-release' as ReleaseStatus,
            title: 'To Release in ACC',
            dotCls: 'bg-indigo-500',
            releases: rs.filter((r) => r.status === 'acc-release'),
          },
          {
            id: 'acc-done' as ReleaseStatus,
            title: 'ACC Done',
            dotCls: 'bg-emerald-500',
            releases: rs.filter((r) => r.status === 'acc-done'),
          },
        ],
      },
      {
        env: 'PRD',
        envCls: 'text-orange-700 bg-orange-50 border-orange-200',
        columns: [
          {
            id: 'prd-setup' as ReleaseStatus,
            title: 'Setup PRD',
            dotCls: 'bg-teal-500',
            releases: rs.filter((r) => r.status === 'prd-setup'),
          },
          {
            id: 'prd-review' as ReleaseStatus,
            title: 'PRD Review',
            dotCls: 'bg-cyan-500',
            releases: rs.filter((r) => r.status === 'prd-review'),
          },
          {
            id: 'prd-release' as ReleaseStatus,
            title: 'To Release in PRD',
            dotCls: 'bg-orange-500',
            releases: rs.filter((r) => r.status === 'prd-release'),
          },
        ],
      },
    ];
  });

  reviewWindows = computed(() =>
    this.releases().filter((r) => r.status === 'acc-review' || r.status === 'prd-review'),
  );

  accDayReference = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Only show when a release is actively on its ACC day or in an ACC-active status
    const candidates = this.releases()
      .filter((r) => {
        if (r.status === 'acc-setup' || r.status === 'acc-review' || r.status === 'acc-release') {
          return true;
        }
        // Also show if ACC day is today
        const accDay = this.getAccReleaseDay(r);
        if (!accDay) return false;
        const accDayMidnight = new Date(accDay);
        accDayMidnight.setHours(0, 0, 0, 0);
        return accDayMidnight.getTime() === today.getTime();
      })
      .map((release) => {
        const accDay = this.getAccReleaseDay(release);
        return { release, accDay };
      })
      .filter((item): item is { release: Release; accDay: Date } => item.accDay !== null)
      .sort((a, b) => a.accDay.getTime() - b.accDay.getTime());

    if (!candidates.length) return null;

    const selected = candidates[0];
    return {
      release: selected.release,
      accDay: selected.accDay,
      steps: [
        {
          time: '12:00',
          title: 'Setup ACC',
          detail:
            'Revert non-release commits on Jira. Branch release/xx.xx.x from develop. Create PR to develop.',
        },
        {
          time: '12:15–16:00',
          title: 'ACC Review',
          detail:
            'Review and approve the release PR. Features were already reviewed on develop in TST.',
        },
        {
          time: 'Scheduled',
          title: 'Deploy in ACC',
          detail: 'Deploy at the agreed time (e.g. 17:00). Time may vary per release.',
        },
        {
          time: 'Post-deploy',
          title: 'ACC Done',
          detail:
            'PR approved & merged. If more ACC rounds remain, loop back to Setup. Otherwise advance to PRD.',
        },
      ],
    };
  });

  private getAccReleaseDay(release: Release): Date | null {
    if (!release.accDeployments.length) return null;
    const index = Math.max(
      0,
      Math.min(release.currentAccRound - 1, release.accDeployments.length - 1),
    );
    return release.accDeployments[index].date;
  }

  setView(v: ViewMode): void {
    this.view.set(v);
  }

  onAddRelease(release: Release): void {
    this.svc.addRelease(release);
    this.showAddModal.set(false);
  }

  onAddAccDeployment(e: { releaseId: string; date: Date; notes?: string }): void {
    this.svc.addAccDeployment(e.releaseId, e.date, e.notes);
  }

  onPRChange(e: { releaseId: string; prId: string; status: PRStatus }): void {
    this.svc.updatePRStatus(e.releaseId, e.prId, e.status);
  }

  onStatusChange(e: { releaseId: string; status: ReleaseStatus }): void {
    this.svc.updateReleaseStatus(e.releaseId, e.status);
  }

  onDeleteRelease(releaseId: string): void {
    this.svc.deleteRelease(releaseId);
  }
}
