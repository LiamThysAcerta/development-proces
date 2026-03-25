import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ReleaseService } from '../../services/release.service';
import { Release } from '../../models/release.model';

interface MonthMarker {
  label: string;
  pct: number;
}
interface AccDot {
  pct: number;
  label: string;
  isFinal: boolean;
}
interface ReleaseBar {
  release: Release;
  accDots: AccDot[];
  tstPct: number;
  firstAccPct: number;
  devWidthPct: number;
  widthPct: number;
  prdPct: number;
  colorCls: string;
}

const STATUS_BAR_COLOR: Record<string, string> = {
  development: 'bg-slate-400',
  'acc-setup': 'bg-amber-500',
  'acc-review': 'bg-blue-500',
  'acc-release': 'bg-indigo-500',
  'acc-done': 'bg-emerald-500',
  'prd-setup': 'bg-teal-500',
  'prd-review': 'bg-cyan-500',
  'prd-release': 'bg-orange-500',
  'prd-done': 'bg-green-500',
  'on-hold': 'bg-yellow-400',
};

@Component({
  selector: 'app-timeline-view',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './timeline-view.html',
})
export class TimelineViewComponent {
  private svc = inject(ReleaseService);
  allReleases = toSignal(this.svc.releases$, { initialValue: [] });

  upcoming = computed(() =>
    this.allReleases()
      .filter((r) => r.status !== 'prd-done')
      .slice(0, 5),
  );

  private span = computed<{ start: Date; end: Date; ms: number }>(() => {
    const rs = this.upcoming();
    const now = new Date();
    if (!rs.length) {
      const end = new Date(now);
      end.setDate(end.getDate() + 90);
      return { start: now, end, ms: end.getTime() - now.getTime() };
    }
    const allDates = rs
      .flatMap((r) => [
        r.firstTstDeployDate,
        ...r.accDeployments.map((a) => a.date),
        r.prdDeployDate,
      ])
      .map((d) => d.getTime());
    const startMs = Math.min(...allDates) - 7 * 86400000;
    const endMs = Math.max(...allDates) + 7 * 86400000;
    return { start: new Date(startMs), end: new Date(endMs), ms: endMs - startMs };
  });

  private pct(date: Date): number {
    const { start, ms } = this.span();
    return Math.max(0, Math.min(100, ((date.getTime() - start.getTime()) / ms) * 100));
  }

  todayPct = computed(() => this.pct(new Date()));

  months = computed<MonthMarker[]>(() => {
    const { start, end } = this.span();
    const markers: MonthMarker[] = [];
    const cur = new Date(start);
    cur.setDate(1);
    cur.setMonth(cur.getMonth() + 1);
    while (cur <= end) {
      markers.push({
        label: cur.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
        pct: this.pct(cur),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return markers;
  });

  bars = computed<ReleaseBar[]>(() =>
    this.upcoming().map((release) => {
      const accs = release.accDeployments;
      const tstPct = this.pct(release.firstTstDeployDate);
      const firstAccPct = accs.length ? this.pct(accs[0].date) : this.pct(release.prdDeployDate);
      const accDots: AccDot[] = accs.map((a, i) => ({
        pct: this.pct(a.date),
        label:
          accs.length > 1
            ? `ACC ${i + 1}: ` + a.date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
            : 'ACC: ' + a.date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        isFinal: i === accs.length - 1 && accs.length > 1,
      }));
      return {
        release,
        accDots,
        tstPct,
        firstAccPct,
        devWidthPct: Math.max(2, firstAccPct - tstPct),
        widthPct: Math.max(2, this.pct(release.prdDeployDate) - firstAccPct),
        prdPct: this.pct(release.prdDeployDate),
        colorCls: STATUS_BAR_COLOR[release.status] ?? 'bg-gray-400',
      };
    }),
  );
}
