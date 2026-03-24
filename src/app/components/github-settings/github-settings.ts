import { Component, EventEmitter, OnInit, Output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GithubStorageService, GithubConfig } from '../../services/github-storage.service';

@Component({
  selector: 'app-github-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './github-settings.html',
})
export class GithubSettingsComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private storage = inject(GithubStorageService);

  form: GithubConfig = { owner: '', repo: '', branch: 'main', pat: '' };
  testStatus = signal<'idle' | 'testing' | 'ok' | 'error'>('idle');
  testError = signal('');

  ngOnInit(): void {
    const cfg = this.storage.getConfig();
    if (cfg) this.form = { ...cfg };
  }

  get isValid(): boolean {
    return !!(this.form.owner && this.form.repo && this.form.branch && this.form.pat);
  }

  save(): void {
    this.storage.saveConfig(this.form);
    this.close.emit();
  }

  async test(): Promise<void> {
    if (!this.isValid) return;
    this.storage.saveConfig(this.form);
    this.testStatus.set('testing');
    this.testError.set('');
    try {
      await this.storage.testConnection();
      this.testStatus.set('ok');
    } catch (e: unknown) {
      this.testStatus.set('error');
      this.testError.set(e instanceof Error ? e.message : String(e));
    }
  }

  clear(): void {
    this.storage.clearConfig();
    this.form = { owner: '', repo: '', branch: 'main', pat: '' };
    this.testStatus.set('idle');
    this.testError.set('');
  }
}
