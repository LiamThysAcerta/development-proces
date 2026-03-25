import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import {
  Release,
  PRStatus,
  ReleaseStatus,
  NextAction,
  AccDeployment,
} from '../models/release.model';
import { ReleaseBuilder } from './release.builder';

@Injectable({ providedIn: 'root' })
export class ReleaseService {
  // Static schedule of releases - add new releases here via VCS
  private static readonly RELEASES_SCHEDULE = [
    ReleaseBuilder.from('rel-mrt')
      .version('26.03.0')
      .firstTstDeploy(new Date(2026, 1, 20)) // Feb 20, 2026
      .accDeployments([
        { date: new Date(2026, 1, 24) }, // Feb 24, 2026
        { date: new Date(2026, 2, 12), notes: 'Final ACC round' }, // Mar 12, 2026
      ])
      .prdDeploy(new Date(2026, 2, 19)) // Mar 19, 2026
      .branch('release/26-03')
      .description('06/02/2026')
      .team(['Release Team'])
      .build(),

    ReleaseBuilder.from('rel-apr')
      .version('26.04.0')
      .firstTstDeploy(new Date(2026, 2, 26)) // Mar 26, 2026
      .accDeployments([
        { date: new Date(2026, 3, 1) }, // Apr 1, 2026
        { date: new Date(2026, 3, 9) }, // Apr 9, 2026
      ])
      .prdDeploy(new Date(2026, 3, 16)) // Apr 16, 2026
      .branch('release/26-04')
      .description('06/03/2026')
      .team(['Release Team'])
      .build(),
  ];

  private releasesSubject = new BehaviorSubject<Release[]>([]);
  releases$ = this.releasesSubject.asObservable();

  constructor() {
    this.initializeReleases();
  }

  private initializeReleases(): void {
    // Initialize with static schedule
    this.releasesSubject.next(ReleaseService.RELEASES_SCHEDULE);
  }

  /**
   * Computes the current status of a release based on dates.
   * Status automatically transitions based on time progression.
   */
  private computeCurrentStatus(release: Release): ReleaseStatus {
    const now = new Date();
    const firstAccDate = release.accDeployments[0]?.date;
    const lastAccDate = release.accDeployments[release.accDeployments.length - 1]?.date;

    // PRD release has passed
    if (now >= release.prdDeployDate) {
      return 'prd-done';
    }

    // PRD review: from PRD setup Friday until deploy
    const prdSetupDate = this.fridayBeforePrdWeek(release.prdDeployDate);
    if (now >= prdSetupDate) {
      // Check if we're on deploy day
      if (this.isSameDay(now, release.prdDeployDate)) {
        return 'prd-release';
      }
      // Still in review window
      return release.accDeployments.length > 0 && now >= lastAccDate! ? 'prd-review' : 'acc-done';
    }

    // ACC phases
    if (firstAccDate && now >= firstAccDate) {
      const currentAccDate =
        release.accDeployments[
          Math.min(release.currentAccRound - 1, release.accDeployments.length - 1)
        ]?.date;

      // Check if on deploy day for current round
      if (currentAccDate && this.isSameDay(now, currentAccDate)) {
        return 'acc-release';
      }

      // Check if in review window (12:15 - 16:00)
      if (currentAccDate && this.isSameDay(now, currentAccDate)) {
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const reviewStart = 12 * 60 + 15; // 12:15
        const reviewEnd = 16 * 60; // 16:00
        const currentTime = hours * 60 + minutes;

        if (currentTime >= reviewStart && currentTime < reviewEnd) {
          return 'acc-review';
        }
      }

      // ACC setup: 12 hours before deploy
      if (currentAccDate) {
        const setupDeadline = new Date(currentAccDate);
        setupDeadline.setHours(0, 0, 0, 0);
        if (now < setupDeadline) {
          return 'acc-setup';
        }
      }

      // Deployed, wait for next round or move to PRD
      if (currentAccDate && now >= new Date(currentAccDate.getTime() + 17 * 60 * 60 * 1000)) {
        const isLastRound = release.currentAccRound >= release.accDeployments.length;
        return isLastRound ? 'prd-setup' : 'acc-done';
      }

      return 'acc-done';
    }

    // Development phase: before first ACC deployment
    return 'development';
  }

  /**
   * Returns releases with computed current status.
   * Use this for displaying status, but keep original release definition for reference.
   */
  getCurrentStatusReleases(): Observable<Release[]> {
    return this.releases$.pipe(
      map((releases) =>
        releases.map((release) => ({
          ...release,
          status: this.computeCurrentStatus(release),
        })),
      ),
    );
  }

  getNextActions(): Observable<NextAction[]> {
    return this.getCurrentStatusReleases().pipe(
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

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private fridayBeforePrdWeek(prdDate: Date): Date {
    const d = new Date(prdDate);
    const day = d.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - mondayOffset);
    d.setDate(d.getDate() - 3);
    return d;
  }
}
