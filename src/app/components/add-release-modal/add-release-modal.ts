import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-release-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './add-release-modal.html',
})
export class AddReleaseModalComponent {
  @Output() close = new EventEmitter<void>();

  form = {
    id: '',
    version: '',
    branchName: '',
    description: '',
    team: '',
    firstTstDeployDate: '',
    prdDeployDate: '',
  };

  accDates: string[] = ['', ''];
  generatedCode = '';
  copied = false;

  get canGenerate(): boolean {
    return (
      !!this.form.version &&
      !!this.form.branchName &&
      !!this.accDates[0] &&
      !!this.form.firstTstDeployDate &&
      !!this.form.prdDeployDate
    );
  }

  onVersionChange(): void {
    const v = this.form.version;
    if (!v) return;
    if (!this.form.branchName) {
      const parts = v.split('.');
      this.form.branchName =
        parts.length >= 2
          ? `release/${parts[0]}.${parts[1].padStart(2, '0')}`
          : `release/${v.replace(/^v/, '')}`;
    }
    if (!this.form.id) {
      const parts = v.split('.');
      this.form.id =
        parts.length >= 2
          ? `rel-${parts[0].slice(-2)}${parts[1].padStart(2, '0')}`
          : `rel-${v.replace(/\./g, '')}`;
    }
  }

  addAccRound(): void {
    this.accDates.push('');
  }

  removeAccRound(index: number): void {
    this.accDates.splice(index, 1);
  }

  generate(): void {
    const validAcc = this.accDates.filter((d) => !!d);
    const id = this.form.id || `rel-${Date.now()}`;

    const fmt = (dateStr: string): { code: string; comment: string } => {
      const d = new Date(dateStr);
      const mon = d.toLocaleString('en-US', { month: 'short' });
      return {
        code: `new Date(${d.getFullYear()}, ${d.getMonth()}, ${d.getDate()})`,
        comment: `// ${mon} ${d.getDate()}, ${d.getFullYear()}`,
      };
    };

    const accLines = validAcc
      .map((d) => {
        const { code, comment } = fmt(d);
        return `    { date: ${code} }, ${comment}`;
      })
      .join('\n');

    const tst = fmt(this.form.firstTstDeployDate);
    const prd = fmt(this.form.prdDeployDate);

    const teamMembers = this.form.team
      ? this.form.team
          .split(',')
          .map((t) => `'${t.trim()}'`)
          .join(', ')
      : `'Release Team'`;

    const descLine = this.form.description ? `\n  .description('${this.form.description}')` : '';

    this.generatedCode =
      `ReleaseBuilder.from('${id}')\n` +
      `  .version('${this.form.version}')\n` +
      `  .firstTstDeploy(${tst.code}) ${tst.comment}\n` +
      `  .accDeployments([\n${accLines}\n  ])\n` +
      `  .prdDeploy(${prd.code}) ${prd.comment}\n` +
      `  .branch('${this.form.branchName}')${descLine}\n` +
      `  .team([${teamMembers}])\n` +
      `  .build(),`;

    this.copied = false;
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText(this.generatedCode).then(() => {
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2000);
    });
  }
}
