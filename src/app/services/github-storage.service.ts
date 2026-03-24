import { Injectable, signal } from '@angular/core';
import { Release } from '../models/release.model';

export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  pat: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Serialization helpers ────────────────────────────────────────────────────

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function strToDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function deserializeRelease(raw: Record<string, unknown>): Release {
  return {
    ...(raw as unknown as Release),
    firstTstDeployDate: strToDate(raw['firstTstDeployDate'] as string),
    prdDeployDate: strToDate(raw['prdDeployDate'] as string),
    prdSetupDate: strToDate(raw['prdSetupDate'] as string),
    accDeployments: (raw['accDeployments'] as Record<string, unknown>[]).map((a) => ({
      ...a,
      date: strToDate(a['date'] as string),
    })),
    phases: (raw['phases'] as Record<string, unknown>[]).map((p) => ({
      ...p,
      startDate: strToDate(p['startDate'] as string),
      endDate: strToDate(p['endDate'] as string),
    })),
    prs: (raw['prs'] as Record<string, unknown>[]).map((pr) => ({
      ...pr,
      createdAt: strToDate(pr['createdAt'] as string),
      updatedAt: strToDate(pr['updatedAt'] as string),
    })),
  } as Release;
}

function serializeRelease(r: Release): unknown {
  return {
    ...r,
    firstTstDeployDate: dateToStr(r.firstTstDeployDate),
    prdDeployDate: dateToStr(r.prdDeployDate),
    prdSetupDate: dateToStr(r.prdSetupDate),
    accDeployments: r.accDeployments.map((a) => ({ ...a, date: dateToStr(a.date) })),
    phases: r.phases.map((p) => ({
      ...p,
      startDate: dateToStr(p.startDate),
      endDate: dateToStr(p.endDate),
    })),
    prs: r.prs.map((pr) => ({
      ...pr,
      createdAt: dateToStr(pr.createdAt),
      updatedAt: dateToStr(pr.updatedAt),
    })),
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GithubStorageService {
  private readonly CONFIG_KEY = 'gh_releases_config';
  private readonly FILE_PATH = 'public/releases.json';

  readonly saveStatus = signal<SaveStatus>('idle');

  private saveQueue: Release[] | null = null;
  private saving = false;

  getConfig(): GithubConfig | null {
    const raw = localStorage.getItem(this.CONFIG_KEY);
    return raw ? (JSON.parse(raw) as GithubConfig) : null;
  }

  saveConfig(config: GithubConfig): void {
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
  }

  clearConfig(): void {
    localStorage.removeItem(this.CONFIG_KEY);
  }

  isConfigured(): boolean {
    const c = this.getConfig();
    return !!(c?.owner && c?.repo && c?.branch && c?.pat);
  }

  async loadReleases(): Promise<Release[]> {
    const response = await fetch('./releases.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Failed to load releases.json: ${response.status}`);
    const data = (await response.json()) as Record<string, unknown>[];
    return data.map(deserializeRelease);
  }

  async saveReleases(releases: Release[]): Promise<void> {
    if (this.saving) {
      this.saveQueue = releases;
      return;
    }
    await this.doSave(releases);
  }

  async testConnection(): Promise<void> {
    const config = this.getConfig();
    if (!config) throw new Error('Not configured');
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${this.FILE_PATH}?ref=${encodeURIComponent(config.branch)}`;
    const res = await fetch(url, {
      headers: this.apiHeaders(config),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`${res.status}: ${err.message ?? 'Unknown error'}`);
    }
  }

  private async doSave(releases: Release[]): Promise<void> {
    const config = this.getConfig();
    if (!config) return; // not configured – skip silently

    this.saving = true;
    this.saveStatus.set('saving');

    try {
      const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${this.FILE_PATH}`;
      const headers = this.apiHeaders(config);

      // Fetch current SHA so GitHub accepts the update
      const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(config.branch)}`, {
        headers,
      });
      if (!getRes.ok) throw new Error(`GitHub API error ${getRes.status}`);
      const { sha } = (await getRes.json()) as { sha: string };

      // Encode as Base64 (UTF-8 safe)
      const json = JSON.stringify(releases.map(serializeRelease), null, 2);
      const bytes = new TextEncoder().encode(json);
      const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
      const content = btoa(binary);

      // Commit the updated file
      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: 'chore: update releases data [skip ci]',
          content,
          sha,
          branch: config.branch,
        }),
      });

      if (!putRes.ok) {
        const err = (await putRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(`GitHub API error ${putRes.status}: ${err.message ?? ''}`);
      }

      this.saveStatus.set('saved');
      setTimeout(() => this.saveStatus.set('idle'), 3000);
    } catch (err) {
      console.error('[GithubStorageService] save failed', err);
      this.saveStatus.set('error');
      setTimeout(() => this.saveStatus.set('idle'), 5000);
    } finally {
      this.saving = false;
      if (this.saveQueue) {
        const next = this.saveQueue;
        this.saveQueue = null;
        void this.doSave(next);
      }
    }
  }

  private apiHeaders(config: GithubConfig): Record<string, string> {
    return {
      Authorization: `Bearer ${config.pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }
}
