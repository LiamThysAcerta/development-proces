import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import {
  Release,
  PRStatus,
  ReleaseStatus,
  NextAction,
  AccDeployment,
} from '../models/release.model';
import { GithubStorageService } from './github-storage.service';

@Injectable({ providedIn: 'root' })
export class ReleaseService {
  private releasesSubject = new BehaviorSubject<Release[]>([]);

  releases$ = this.releasesSubject.asObservable();

  get saveStatus() {
    return this.storage.saveStatus;
  }

  get isStorageConfigured(): boolean {
    return this.storage.isConfigured();
  }

  constructor(private storage: GithubStorageService) {
    this.storage
      .loadReleases()
      .then((releases) => this.releasesSubject.next(releases))
      .catch(() => this.releasesSubject.next(this.buildMockReleases()));
  }

  private persist(): void {
    void this.storage.saveReleases(this.releasesSubject.value);
  }

  getNextActions(): Observable<NextAction[]> {
    return this.releases$.pipe(
      map((releases) => {
        const now = new Date();
        const actions: NextAction[] = [];

        for (const release of releases) {
          if (release.status === 'prd-done' || release.status === 'on-hold') continue;

          let action = '';
          let dueDate: Date;

          const accRoundDate = this.getAccRoundDate(release);

          switch (release.status) {
            case 'development': {
              // CTA 1 – merge into develop before first TST deploy
              const tstDeadline = this.withTime(release.firstTstDeployDate, 0, 0);
              if (tstDeadline.getTime() > now.getTime()) {
                const daysUntilTst = Math.ceil(
                  (tstDeadline.getTime() - now.getTime()) / 86_400_000,
                );
                actions.push({
                  release,
                  action: `Merge all features into develop for ${release.version} before first TST deploy.`,
                  dueDate: tstDeadline,
                  daysUntil: daysUntilTst,
                  urgent: daysUntilTst <= 2,
                });
              }
              // CTA 2 – TST period ends at 12:00 on first ACC day
              action = `Create, merge & review PRs to develop for ${release.version}. TST period until 12:00 on ACC release moment.`;
              dueDate = this.withTime(
                accRoundDate ?? release.accDeployments[0]?.date ?? release.prdDeployDate,
                12,
                0,
              );
              break;
            }

            case 'acc-setup':
              action = `Revert non-release commits, branch release/${release.version}, create PR to develop (round ${release.currentAccRound}) for ${release.version}`;
              dueDate = this.withTime(accRoundDate ?? release.prdDeployDate, 12, 15);
              break;

            case 'acc-review':
              action = `Review PR for release ${release.version} (round ${release.currentAccRound}). Review window: 12:15–16:00`;
              dueDate = this.withTime(accRoundDate ?? release.prdDeployDate, 16, 0);
              break;

            case 'acc-release':
              action = `Deploy release ${release.version} in ACC (round ${release.currentAccRound}) at scheduled time`;
              dueDate = this.withTime(accRoundDate ?? release.prdDeployDate, 17, 0);
              break;

            case 'acc-done': {
              const isLastRound = release.currentAccRound >= release.accDeployments.length;
              action = isLastRound
                ? `ACC done for ${release.version}. Advance to PRD setup.`
                : `ACC round ${release.currentAccRound} done for ${release.version}. Start next ACC round.`;
              dueDate = isLastRound
                ? release.prdSetupDate
                : (accRoundDate ?? release.prdDeployDate);
              break;
            }

            case 'prd-setup':
              action = `Create PRs to develop & main, create Jira ticket with infra for ${release.version}`;
              dueDate = release.prdSetupDate;
              break;

            case 'prd-review':
              action = `Review PRs for PRD deployment of ${release.version}. Review until deploy day.`;
              dueDate = release.prdDeployDate;
              break;

            case 'prd-release':
              action = `Deploy release ${release.version} in PRD at agreed moment`;
              dueDate = release.prdDeployDate;
              break;

            default:
              continue;
          }

          const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000);
          actions.push({ release, action, dueDate, daysUntil, urgent: daysUntil <= 2 });
        }

        return actions.sort((a, b) => a.daysUntil - b.daysUntil);
      }),
    );
  }

  updatePRStatus(releaseId: string, prId: string, status: PRStatus): void {
    const releases = this.releasesSubject.value.map((release) => {
      if (release.id !== releaseId) return release;
      return {
        ...release,
        prs: release.prs.map((pr) =>
          pr.id === prId ? { ...pr, status, updatedAt: new Date() } : pr,
        ),
      };
    });
    this.releasesSubject.next(releases);
    this.persist();
  }

  updateReleaseStatus(releaseId: string, status: ReleaseStatus): void {
    const releases = this.releasesSubject.value.map((r) => {
      if (r.id !== releaseId) return r;

      // Advance ACC round when looping back from acc-done to acc-setup
      const shouldAdvanceRound = r.status === 'acc-done' && status === 'acc-setup';
      const currentAccRound = shouldAdvanceRound
        ? Math.min(r.currentAccRound + 1, r.accDeployments.length)
        : status === 'prd-setup'
          ? r.accDeployments.length
          : r.currentAccRound;

      const isAccCompleted =
        status === 'prd-setup' ||
        status === 'prd-review' ||
        status === 'prd-release' ||
        status === 'prd-done';

      return {
        ...r,
        status,
        currentAccRound,
        phases: r.phases.map((phase) => {
          if (phase.environment === 'ACC') {
            return { ...phase, completed: isAccCompleted };
          }
          if (phase.environment === 'PRD') {
            return { ...phase, completed: status === 'prd-done' };
          }
          if (phase.environment === 'TST') {
            return { ...phase, completed: status !== 'development' };
          }
          return phase;
        }),
      };
    });
    this.releasesSubject.next(releases);
    this.persist();
  }

  addRelease(release: Release): void {
    this.releasesSubject.next([...this.releasesSubject.value, release]);
    this.persist();
  }

  deleteRelease(releaseId: string): void {
    this.releasesSubject.next(this.releasesSubject.value.filter((r) => r.id !== releaseId));
    this.persist();
  }

  addAccDeployment(releaseId: string, date: Date, notes?: string): void {
    const deployment: AccDeployment = { id: `acc-${Date.now()}`, date, notes };
    const releases = this.releasesSubject.value.map((r) => {
      if (r.id !== releaseId) return r;

      const accDeployments = [...r.accDeployments, deployment].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );

      const status: ReleaseStatus =
        r.status === 'prd-setup' || r.status === 'acc-done' ? 'acc-setup' : r.status;

      return {
        ...r,
        accDeployments,
        status,
        currentAccRound: Math.min(r.currentAccRound, accDeployments.length),
      };
    });
    this.releasesSubject.next(releases);
    this.persist();
  }

  private getAccRoundDate(release: Release): Date | null {
    if (!release.accDeployments.length) return null;
    const index = Math.max(
      0,
      Math.min(release.currentAccRound - 1, release.accDeployments.length - 1),
    );
    return release.accDeployments[index].date;
  }

  private withTime(date: Date, hours: number, minutes: number): Date {
    const value = new Date(date);
    value.setHours(hours, minutes, 0, 0);
    return value;
  }

  private fridayBeforePrdWeek(prdDate: Date): Date {
    const d = new Date(prdDate);
    const day = d.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - mondayOffset);
    d.setDate(d.getDate() - 3);
    return d;
  }

  private buildMockReleases(): Release[] {
    const parseDate = (raw: string): Date => {
      const match = raw.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      const value = match?.[1] ?? raw;
      const [day, month, year] = value.split('/').map(Number);
      return new Date(year, month - 1, day);
    };

    const schedule = [
      {
        id: 'rel-mrt',
        version: 'release/26.03.0',
        releaseContent: '06/02/2026',
        firstTst: '20/02/2026',
        firstAcc: '24/02/2026',
        lastAcc: '12/03/2026',
        prd: 'MRT: 19/03/2026',
        status: 'prd-done' as ReleaseStatus,
      },
      {
        id: 'rel-apr',
        version: '26.04.0',
        releaseContent: '06/03/2026',
        firstTst: '26/03/2026',
        firstAcc: '1/04/2026',
        lastAcc: '09/04/2026',
        prd: 'APR: 16/04/2026',
        status: 'development' as ReleaseStatus,
      },
    ];

    return schedule.map((item, idx) => {
      const firstAccDate = parseDate(item.firstAcc);
      const lastAccDate = parseDate(item.lastAcc);
      const accDeployments: AccDeployment[] = [
        { id: `${item.id}-acc-1`, date: firstAccDate },
        { id: `${item.id}-acc-2`, date: lastAccDate, notes: 'Final ACC round' },
      ];
      const prdDate = parseDate(item.prd);
      const firstTstDate = parseDate(item.firstTst);
      const prdSetupDate = this.fridayBeforePrdWeek(prdDate);

      return {
        id: item.id,
        version: item.version,
        branchName: `release/${prdDate.getFullYear()}-${String(prdDate.getMonth() + 1).padStart(2, '0')}`,
        status: item.status,
        firstTstDeployDate: firstTstDate,
        currentAccRound:
          item.status === 'prd-done' ||
          item.status === 'prd-setup' ||
          item.status === 'prd-review' ||
          item.status === 'prd-release'
            ? accDeployments.length
            : 1,
        description: `Content ${item.releaseContent} | TST ${item.firstTst}`,
        team: ['Release Team'],
        repositoryUrl: 'https://github.com/org/repo',
        accDeployments,
        prdDeployDate: prdDate,
        prdSetupDate,
        phases: [
          {
            id: `${item.id}-tst-phase`,
            name: 'TST Development',
            environment: 'TST' as const,
            startDate: firstTstDate,
            endDate: firstAccDate,
            completed: item.status !== 'development',
          },
          {
            id: `${item.id}-acc-phase`,
            name: 'ACC Testing',
            environment: 'ACC' as const,
            startDate: firstAccDate,
            endDate: lastAccDate,
            completed:
              item.status === 'prd-done' ||
              item.status === 'prd-setup' ||
              item.status === 'prd-review' ||
              item.status === 'prd-release',
          },
          {
            id: `${item.id}-prd-phase`,
            name: 'PRD Deployment',
            environment: 'PRD' as const,
            startDate: prdSetupDate,
            endDate: prdDate,
            completed: item.status === 'prd-done',
          },
        ],
        prs: [
          {
            id: `${item.id}-pr`,
            title: `Release checklist ${item.version}`,
            number: 500 + idx,
            url: `https://github.com/org/repo/pull/${500 + idx}`,
            status:
              item.status === 'prd-done'
                ? 'merged'
                : item.status === 'development'
                  ? 'draft'
                  : 'approved',
            targetBranch: 'main',
            sourceBranch: `release/${item.id}`,
            author: 'Release Bot',
            reviewers: ['Team Lead'],
            createdAt: firstTstDate,
            updatedAt: firstTstDate,
          },
        ],
      } as Release;
    });
  }
}
