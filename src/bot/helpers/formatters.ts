import {
  DeploymentState,
  VercelProject,
  VercelDeployment,
  WebAnalyticsResult,
} from '../../services/vercel-types.js';

export function formatStatusBadge(state?: string): string {
  switch (state?.toUpperCase()) {
    case 'READY':
      return '🟢 Ready';
    case 'ERROR':
      return '🔴 Failed';
    case 'BUILDING':
      return '🟡 Building';
    case 'INITIALIZING':
    case 'QUEUED':
      return '⚪ Queued';
    case 'CANCELED':
      return '⚪ Canceled';
    default:
      return '⚪ Unknown';
  }
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatProjectSummary(project: VercelProject): string {
  const latest =
    project.targets?.production || project.latestDeployments?.[0];
  const status = formatStatusBadge(latest?.readyState);
  const time = latest?.createdAt ? formatTimeAgo(latest.createdAt) : 'N/A';
  const framework = project.framework || 'Custom / Other';

  let text = `📦 *${project.name}*\n`;
  text += `• Status: ${status}\n`;
  text += `• Framework: \`${framework}\`\n`;
  text += `• Last Deployed: ${time}\n`;

  if (latest?.url) {
    text += `• URL: https://${latest.url}\n`;
  }

  if (latest?.meta?.githubCommitMessage) {
    const commitMsg = latest.meta.githubCommitMessage.split('\n')[0].slice(0, 50);
    const author = latest.meta.githubCommitAuthorName || 'Unknown';
    text += `• Commit: _"${commitMsg}"_ by ${author}\n`;
  }

  return text;
}

export function formatDeploymentCard(d: VercelDeployment): string {
  const status = formatStatusBadge(d.readyState || d.state);
  const time = formatTimeAgo(d.created);
  const branch = d.meta?.githubCommitRef || 'main';
  const author = d.meta?.githubCommitAuthorName || d.creator?.username || 'Unknown';
  const commitMsg = d.meta?.githubCommitMessage
    ? d.meta.githubCommitMessage.split('\n')[0].slice(0, 60)
    : 'No commit message';

  let text = `${status} *${d.name}*\n`;
  text += `• Target: \`${d.target || 'preview'}\` (${branch})\n`;
  text += `• Commit: _"${commitMsg}"_ by ${author}\n`;
  text += `• Time: ${time}\n`;
  text += `• Preview: https://${d.url}\n`;
  text += `• ID: \`${d.uid}\`\n`;

  return text;
}

export function formatAnalyticsCard(
  projectName: string,
  analytics: WebAnalyticsResult
): string {
  let text = `📊 *Web Analytics — ${projectName}*\n\n`;

  if (!analytics.isEnabled) {
    text += `ℹ️ ${analytics.message || 'Web Analytics is not enabled for this project.'}\n\n`;
    text += `_To enable analytics, visit your project settings on Vercel Dashboard ➔ Analytics._`;
    return text;
  }

  text += `• *Last 24 Hours*:\n`;
  text += `  └ Total Page Views / Visitors: *${analytics.visits24h?.toLocaleString() ?? 0}*\n\n`;
  text += `• *Last 7 Days*:\n`;
  text += `  └ Total Page Views / Visitors: *${analytics.visits7d?.toLocaleString() ?? 0}*\n`;

  return text;
}
