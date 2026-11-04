export interface VercelUser {
  id: string;
  username: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface VercelTeam {
  id: string;
  slug: string;
  name: string;
  avatar?: string;
}

export type DeploymentState =
  | 'READY'
  | 'ERROR'
  | 'BUILDING'
  | 'INITIALIZING'
  | 'QUEUED'
  | 'CANCELED';

export interface VercelDeploymentSummary {
  id: string;
  url: string;
  readyState: DeploymentState;
  createdAt: number;
  creator?: {
    username: string;
  };
  meta?: {
    githubCommitRef?: string;
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
    gitlabCommitRef?: string;
    gitlabCommitMessage?: string;
  };
}

export interface VercelProject {
  id: string;
  name: string;
  framework?: string | null;
  accountId: string;
  updatedAt: number;
  createdAt: number;
  targets?: {
    production?: VercelDeploymentSummary;
  };
  latestDeployments?: VercelDeploymentSummary[];
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  created: number;
  state: DeploymentState;
  readyState: DeploymentState;
  type: string;
  creator: {
    uid: string;
    username: string;
  };
  target?: 'production' | 'staging' | null;
  meta?: {
    githubCommitRef?: string;
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
    gitlabCommitRef?: string;
    gitlabCommitMessage?: string;
  };
  alias?: string[];
}

export interface VercelLogEvent {
  id?: string;
  type?: string;
  created: number;
  payload: {
    id?: string;
    text?: string;
    date?: number;
    info?: {
      type?: string;
      name?: string;
    };
  };
}

export interface WebAnalyticsResult {
  visits24h: number | null;
  visits7d: number | null;
  isEnabled: boolean;
  message?: string;
}
