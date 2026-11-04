import { InlineKeyboard } from 'grammy';
import { VercelProject, VercelTeam } from '../../services/vercel-types.js';

export function makeProjectsKeyboard(
  projects: VercelProject[],
  page = 0,
  pageSize = 5
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const totalPages = Math.ceil(projects.length / pageSize);
  const start = page * pageSize;
  const currentProjects = projects.slice(start, start + pageSize);

  for (const project of currentProjects) {
    keyboard.text(`📁 ${project.name}`, `project:${project.name}`).row();
  }

  // Navigation row if more than 1 page
  const navRow: { text: string; data: string }[] = [];
  if (page > 0) {
    navRow.push({ text: '⬅️ Previous', data: `projects_page:${page - 1}` });
  }
  if (page < totalPages - 1) {
    navRow.push({ text: 'Next ➡️', data: `projects_page:${page + 1}` });
  }

  if (navRow.length > 0) {
    for (const btn of navRow) {
      keyboard.text(btn.text, btn.data);
    }
    keyboard.row();
  }

  keyboard.text('🔄 Refresh List', 'projects_refresh');
  return keyboard;
}

export function makeProjectActionKeyboard(
  projectName: string,
  latestDeploymentId?: string,
  liveUrl?: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text('📜 Deployments', `deployments:${projectName}`)
    .text('📊 Analytics', `analytics:${projectName}`)
    .row();

  if (latestDeploymentId) {
    keyboard
      .text('📄 Latest Logs', `logs:${latestDeploymentId}`)
      .text('🔄 Redeploy', `redeploy_prompt:${projectName}:${latestDeploymentId}`)
      .row();
  }

  if (liveUrl) {
    keyboard.url('🌐 Open Live Site', `https://${liveUrl}`).row();
  }

  keyboard.text('⬅️ Back to Projects', 'projects_refresh');
  return keyboard;
}

export function makeRedeployConfirmKeyboard(
  projectName: string,
  deploymentId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Yes, Redeploy Now', `redeploy_exec:${projectName}:${deploymentId}`)
    .text('❌ Cancel', `project:${projectName}`);
}

export function makeTeamsKeyboard(
  teams: VercelTeam[],
  currentTeamId?: string | null
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  const isPersonalActive = !currentTeamId;
  keyboard
    .text(
      `${isPersonalActive ? '✅ ' : ''}👤 Personal Account`,
      'switch_team:personal'
    )
    .row();

  for (const team of teams) {
    const isTeamActive = currentTeamId === team.id;
    keyboard
      .text(
        `${isTeamActive ? '✅ ' : ''}🏢 ${team.name} (@${team.slug})`,
        `switch_team:${team.id}`
      )
      .row();
  }

  keyboard.text('🔄 Refresh Workspaces', 'teams_refresh');
  return keyboard;
}
