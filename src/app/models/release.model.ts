export type Environment = 'DEV' | 'TST' | 'ACC' | 'PRD';

export type ReleaseStatus =
  | 'development'   // TST: devs creating, merging & reviewing PRs to develop
  | 'acc-setup'     // ACC: revert non-release commits, branch release/xx.xx.x, create PR to develop
  | 'acc-review'    // ACC: PR review period (12:15 – 16:00)
  | 'acc-release'   // ACC: deploy at scheduled time
  | 'acc-done'      // ACC: deployed, PR approved & merged
  | 'prd-setup'     // PRD: create PRs to develop & main, Jira ticket with infra
  | 'prd-review'    // PRD: PR review period (Friday before PRD until deploy)
  | 'prd-release'   // PRD: deploy at agreed moment
  | 'prd-done'      // PRD: deployed, PRs merged into main & develop
  | 'on-hold';

export type PRStatus = 'pending' | 'approved' | 'merged' | 'changes-requested' | 'draft';
export type ViewMode = 'kanban' | 'timeline';

export function getEnvironment(status: ReleaseStatus): Environment {
  if (status === 'development') return 'TST';
  if (status.startsWith('acc-')) return 'ACC';
  if (status.startsWith('prd-')) return 'PRD';
  return 'TST';
}

export interface PR {
  id: string;
  title: string;
  number: number;
  url: string;
  status: PRStatus;
  targetBranch: string;
  sourceBranch: string;
  author: string;
  reviewers: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Phase {
  id: string;
  name: string;
  environment: Environment;
  startDate: Date;
  endDate: Date;
  completed: boolean;
  description?: string;
}

export interface AccDeployment {
  id: string;
  date: Date;
  notes?: string;
}

export interface Release {
  id: string;
  version: string;
  branchName: string;
  status: ReleaseStatus;
  firstTstDeployDate: Date;
  currentAccRound: number;
  phases: Phase[];
  prs: PR[];
  accDeployments: AccDeployment[];
  prdDeployDate: Date;
  prdSetupDate: Date;
  description: string;
  team: string[];
  repositoryUrl?: string;
}

export interface NextAction {
  release: Release;
  action: string;
  dueDate: Date;
  daysUntil: number;
  urgent: boolean;
}
