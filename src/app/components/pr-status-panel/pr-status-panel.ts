import { Component, input, output } from '@angular/core';
import { PR, PRStatus } from '../../models/release.model';
import { StatusBadgeComponent } from '../status-badge/status-badge';

@Component({
  selector: 'app-pr-status-panel',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <div class="space-y-2">
      <h4 class="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Pull Requests
        <span class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{{ prs().length }}</span>
      </h4>

      @for (pr of prs(); track pr.id) {
        <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-2.5 text-sm">
          <div class="flex min-w-0 items-center gap-2">
            <span class="font-mono text-xs text-gray-400">#{{ pr.number }}</span>
            <a [href]="pr.url" target="_blank"
               class="max-w-[180px] truncate text-blue-600 hover:underline"
               [title]="pr.title">
              {{ pr.title }}
            </a>
            <span class="hidden text-xs text-gray-400 sm:inline">&#8594; {{ pr.targetBranch }}</span>
          </div>
          <div class="flex flex-shrink-0 items-center gap-2">
            <app-status-badge [status]="pr.status" />
            @if (pr.status === 'pending' || pr.status === 'draft') {
              <button (click)="emit(pr, 'approved')"
                class="rounded bg-blue-500 px-2 py-0.5 text-xs text-white transition-colors hover:bg-blue-600">
                Approve
              </button>
            }
            @if (pr.status === 'approved') {
              <button (click)="emit(pr, 'merged')"
                class="rounded bg-green-500 px-2 py-0.5 text-xs text-white transition-colors hover:bg-green-600">
                Merge
              </button>
            }
          </div>
        </div>
      }

      @if (prs().length === 0) {
        <p class="text-xs italic text-gray-400">No PRs yet</p>
      }

      <button (click)="openCreatePR()"
        class="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300
               px-3 py-2 text-xs text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-500">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create PR
      </button>
    </div>
  `,
})
export class PRStatusPanelComponent {
  prs = input.required<PR[]>();
  repositoryUrl = input<string>('');

  statusChange = output<{ pr: PR; status: PRStatus }>();
  createPR = output<void>();

  emit(pr: PR, status: PRStatus): void {
    this.statusChange.emit({ pr, status });
  }

  openCreatePR(): void {
    const url = this.repositoryUrl();
    if (url) window.open(`${url}/compare`, '_blank');
    this.createPR.emit();
  }
}
