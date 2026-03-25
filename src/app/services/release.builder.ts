import { Release, AccDeployment, Phase, PR } from '../models/release.model';

/**
 * Fluent builder for creating Release objects with minimal boilerplate.
 * Usage:
 *   ReleaseBuilder.from('rel-id')
 *     .version('1.0.0')
 *     .firstTstDeploy(new Date(2026, 0, 15))
 *     .accDeployments([{ date: new Date(2026, 0, 20) }])
 *     .prdDeploy(new Date(2026, 1, 1))
 *     .build()
 */
export class ReleaseBuilder {
  private release: Partial<Release> = {};

  private constructor(id: string) {
    this.release.id = id;
    this.release.prs = [];
    this.release.currentAccRound = 1;
  }

  /**
   * Start building a new release with the given ID
   */
  static from(id: string): ReleaseBuilder {
    return new ReleaseBuilder(id);
  }

  /**
   * Set the version (e.g., '26.04.0')
   */
  version(version: string): ReleaseBuilder {
    this.release.version = version;
    return this;
  }

  /**
   * Set the branch name (e.g., 'release/26-04')
   */
  branch(branchName: string): ReleaseBuilder {
    this.release.branchName = branchName;
    return this;
  }

  /**
   * Set the first TST deployment date
   */
  firstTstDeploy(date: Date): ReleaseBuilder {
    this.release.firstTstDeployDate = date;
    return this;
  }

  /**
   * Set ACC deployment dates. Each deployment can have optional notes.
   * Example: [{ date: new Date(2026, 0, 20) }, { date: new Date(2026, 0, 27), notes: 'Final round' }]
   */
  accDeployments(deployments: Array<{ date: Date; notes?: string }>): ReleaseBuilder {
    this.release.accDeployments = deployments.map((d, idx) => ({
      id: `${this.release.id}-acc-${idx + 1}`,
      date: d.date,
      notes: d.notes,
    }));
    return this;
  }

  /**
   * Set the PRD deployment date
   */
  prdDeploy(date: Date): ReleaseBuilder {
    this.release.prdDeployDate = date;
    // Calculate PRD setup date (Friday before the PRD week)
    this.release.prdSetupDate = this.fridayBeforePrdWeek(date);
    return this;
  }

  /**
   * Set the release description
   */
  description(description: string): ReleaseBuilder {
    this.release.description = description;
    return this;
  }

  /**
   * Set the team members
   */
  team(team: string[]): ReleaseBuilder {
    this.release.team = team;
    return this;
  }

  /**
   * Set the repository URL
   */
  repository(url: string): ReleaseBuilder {
    this.release.repositoryUrl = url;
    return this;
  }

  /**
   * Build the final Release object
   */
  build(): Release {
    if (!this.release.version) throw new Error('Version is required');
    if (!this.release.branchName) throw new Error('Branch name is required');
    if (!this.release.firstTstDeployDate) throw new Error('First TST deploy date is required');
    if (!this.release.accDeployments?.length)
      throw new Error('At least one ACC deployment is required');
    if (!this.release.prdDeployDate) throw new Error('PRD deploy date is required');

    const firstAccDate = this.release.accDeployments![0].date;
    const lastAccDate = this.release.accDeployments![this.release.accDeployments!.length - 1].date;

    // Auto-generated phases
    const phases: Phase[] = [
      {
        id: `${this.release.id}-tst-phase`,
        name: 'TST Development',
        environment: 'TST',
        startDate: this.release.firstTstDeployDate,
        endDate: firstAccDate,
        completed: false,
      },
      {
        id: `${this.release.id}-acc-phase`,
        name: 'ACC Testing',
        environment: 'ACC',
        startDate: firstAccDate,
        endDate: lastAccDate,
        completed: false,
      },
      {
        id: `${this.release.id}-prd-phase`,
        name: 'PRD Deployment',
        environment: 'PRD',
        startDate: this.release.prdSetupDate!,
        endDate: this.release.prdDeployDate,
        completed: false,
      },
    ];

    // Auto-generated PR for release checklist
    const prs: PR[] = [
      {
        id: `${this.release.id}-pr`,
        title: `Release checklist ${this.release.version}`,
        number: parseInt((this.release.id ?? '').replace(/\D/g, '') || '0', 10) || 500,
        url: `#`, // Placeholder, set via repository method if needed
        status: 'draft',
        targetBranch: 'main',
        sourceBranch: this.release.branchName,
        author: 'Release Manager',
        reviewers: this.release.team?.slice(0, 2) ?? ['Team Lead'],
        createdAt: this.release.firstTstDeployDate,
        updatedAt: this.release.firstTstDeployDate,
      },
    ];

    return {
      id: this.release.id!,
      version: this.release.version,
      branchName: this.release.branchName,
      status: 'development', // Always starts in development, will be computed dynamically
      firstTstDeployDate: this.release.firstTstDeployDate,
      currentAccRound: 1,
      phases,
      prs,
      accDeployments: this.release.accDeployments,
      prdDeployDate: this.release.prdDeployDate,
      prdSetupDate: this.release.prdSetupDate!,
      description: this.release.description ?? 'Release',
      team: this.release.team ?? ['Release Team'],
      repositoryUrl: this.release.repositoryUrl,
    };
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
