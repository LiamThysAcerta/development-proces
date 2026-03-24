import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Release } from '../../models/release.model';

@Component({
  selector: 'app-add-release-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './add-release-modal.html',
})
export class AddReleaseModalComponent {
  @Output() save = new EventEmitter<Release>();
  @Output() cancel = new EventEmitter<void>();

  form = {
    version: '',
    branchName: '',
    description: '',
    team: '',
    repositoryUrl: '',
    firstTstDeployDate: '',
    prdDeployDate: '',
    prdSetupDate: '',
  };

  accDates: string[] = [''];

  get canSubmit(): boolean {
    return (
      !!this.form.version &&
      !!this.form.branchName &&
      !!this.accDates[0] &&
      !!this.form.firstTstDeployDate &&
      !!this.form.prdDeployDate
    );
  }

  onVersionChange(): void {
    if (this.form.version && !this.form.branchName) {
      this.form.branchName = `release/${this.form.version.replace(/^v/, '')}`;
    }
  }

  onPrdDateChange(): void {
    if (this.form.prdDeployDate && !this.form.prdSetupDate) {
      this.form.prdSetupDate = this.calcFridayBeforePrdWeek(this.form.prdDeployDate);
    }
  }

  addAccRound(): void {
    this.accDates.push('');
  }

  removeAccRound(index: number): void {
    this.accDates.splice(index, 1);
  }

  onSubmit(): void {
    const firstTstDate = new Date(this.form.firstTstDeployDate);
    const prdDate = new Date(this.form.prdDeployDate);
    const prdSetupDate = this.form.prdSetupDate
      ? new Date(this.form.prdSetupDate)
      : this.fridayBeforePrdWeek(prdDate);
    const accDeployments = this.accDates
      .filter((d) => !!d)
      .map((d, i) => ({ id: `acc-${Date.now()}-${i}`, date: new Date(d) }));

    accDeployments.sort((a, b) => a.date.getTime() - b.date.getTime());

    const firstAccDate = accDeployments[0].date;
    const accEnd = accDeployments[accDeployments.length - 1].date;

    const release: Release = {
      id: `rel-${Date.now()}`,
      version: this.form.version,
      branchName: this.form.branchName,
      status: 'development',
      firstTstDeployDate: firstTstDate,
      currentAccRound: 1,
      description: this.form.description,
      team: this.form.team
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      repositoryUrl: this.form.repositoryUrl || undefined,
      accDeployments,
      prdDeployDate: prdDate,
      prdSetupDate,
      phases: [
        {
          id: `ph-${Date.now()}-tst`,
          name: 'TST Development',
          environment: 'TST',
          startDate: firstTstDate,
          endDate: firstAccDate,
          completed: false,
        },
        {
          id: `ph-${Date.now()}-acc`,
          name: 'ACC Testing',
          environment: 'ACC',
          startDate: firstAccDate,
          endDate: accEnd,
          completed: false,
        },
        {
          id: `ph-${Date.now()}-prd`,
          name: 'PRD Deployment',
          environment: 'PRD',
          startDate: prdSetupDate,
          endDate: prdDate,
          completed: false,
        },
      ],
      prs: [],
    };

    this.save.emit(release);
  }

  private calcFridayBeforePrdWeek(dateStr: string): string {
    const d = this.fridayBeforePrdWeek(new Date(dateStr));
    return d.toISOString().slice(0, 10);
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
