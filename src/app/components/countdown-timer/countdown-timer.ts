import { Component, computed, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

@Component({
  selector: 'app-countdown-timer',
  standalone: true,
  template: `
    <div [class]="wrapperCls()">
      @if (msLeft() > 0) {
        <div class="flex items-baseline gap-1 font-mono font-bold text-sm">
          <span>{{ pad(days()) }}</span
          ><span class="text-xs font-normal opacity-70">d</span> <span>{{ pad(hours()) }}</span
          ><span class="text-xs font-normal opacity-70">h</span> <span>{{ pad(mins()) }}</span
          ><span class="text-xs font-normal opacity-70">m</span>
        </div>
        <div class="text-xs opacity-70 mt-0.5">until {{ label() }}</div>
      } @else if (msLeft() > -86400000) {
        <div class="font-bold text-sm">TODAY</div>
        <div class="text-xs opacity-70 mt-0.5">{{ label() }}</div>
      } @else {
        <div class="font-bold text-sm">OVERDUE {{ overdueDays() }}d</div>
        <div class="text-xs opacity-70 mt-0.5">{{ label() }}</div>
      }
    </div>
  `,
})
export class CountdownTimerComponent {
  targetDate = input.required<Date>();
  label = input<string>('deadline');

  private tick = toSignal(interval(1000), { initialValue: 0 });

  msLeft = computed(() => {
    this.tick();
    return this.targetDate().getTime() - Date.now();
  });

  days = computed(() => Math.floor(this.msLeft() / 86400000));
  hours = computed(() => Math.floor((this.msLeft() % 86400000) / 3600000));
  mins = computed(() => Math.floor((this.msLeft() % 3600000) / 60000));
  overdueDays = computed(() => Math.abs(Math.ceil(this.msLeft() / 86400000)));

  wrapperCls = computed(() => {
    const ms = this.msLeft();
    const days = Math.ceil(ms / 86400000);
    const base = 'rounded-lg px-3 py-2 text-center border border-gray-200';
    if (ms <= 0) return `${base} bg-red-50 text-red-700`;
    if (days <= 1) return `${base} bg-red-50 text-red-700`;
    if (days <= 3) return `${base} bg-orange-50 text-orange-700`;
    if (days <= 7) return `${base} bg-yellow-50 text-yellow-700`;
    return `${base} bg-blue-50 text-blue-700`;
  });

  pad(n: number): string {
    return String(Math.max(0, n)).padStart(2, '0');
  }
}
