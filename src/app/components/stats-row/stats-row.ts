import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stats-row',
  standalone: true,
  templateUrl: './stats-row.html',
})
export class StatsRowComponent {
  total = input.required<number>();
  active = input.required<number>();
  pendingPRs = input.required<number>();
}
