import axios, { AxiosError } from 'axios';
import {
  VercelUser,
  VercelTeam,
  VercelProject,
  VercelDeployment,
  VercelLogEvent,
  WebAnalyticsResult,
} from './vercel-types.js';

const VERCEL_API_BASE = 'https://api.vercel.com';

function createClient(token: string, teamId?: string | null) {
  const params: Record<string, string> = {};
  if (teamId) {
    params.teamId = teamId;
  }

  return axios.create({
    baseURL: VERCEL_API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    params,
    timeout: 10000,
  });
}

function handleApiError(error: unknown, action: string): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message =
      (error.response?.data as { error?: { message?: string } })?.error
        ?.message || error.message;

    if (status === 401) {
      throw new Error(`Unauthorized (401): The Vercel token is invalid or expired.`);
    }
    if (status === 403) {
      throw new Error(`Forbidden (403): You do not have permission to ${action}.`);
    }
    if (status === 404) {
      throw new Error(`Not Found (404): The requested resource does not exist.`);
    }

    throw new Error(`Vercel API error while trying to ${action}: ${message}`);
  }

  throw new Error(`Unexpected error during ${action}: ${(error as Error).message}`);
}

/**
 * Validates a Vercel Personal Access Token and returns the authenticated user profile.
 */
export async function verifyUser(token: string): Promise<VercelUser> {
  try {
    const client = createClient(token);
    const response = await client.get<{ user: VercelUser }>('/v2/user');
    return response.data.user;
  } catch (err) {
    handleApiError(err, 'verify user token');
  }
}

/**
 * Retrieves the teams the authenticated user has access to.
 */
export async function getTeams(token: string): Promise<VercelTeam[]> {
  try {
    const client = createClient(token);
    const response = await client.get<{ teams: VercelTeam[] }>('/v2/teams');
    return response.data.teams || [];
  } catch (err) {
    handleApiError(err, 'fetch teams');
  }
}

/**
 * Retrieves all projects in the selected workspace (personal account or team).
 */
export async function getProjects(
  token: string,
  teamId?: string | null,
  limit = 20
): Promise<{ projects: VercelProject[] }> {
  try {
    const client = createClient(token, teamId);
    const response = await client.get<{ projects: VercelProject[] }>('/v9/projects', {
      params: { limit },
    });
    return response.data;
  } catch (err) {
    handleApiError(err, 'fetch projects');
  }
}

/**
 * Retrieves details for a specific project by name or ID.
 */
export async function getProject(
  token: string,
  projectIdOrName: string,
  teamId?: string | null
): Promise<VercelProject> {
  try {
    const client = createClient(token, teamId);
    const response = await client.get<VercelProject>(
      `/v9/projects/${encodeURIComponent(projectIdOrName)}`
    );
    return response.data;
  } catch (err) {
    handleApiError(err, `fetch project "${projectIdOrName}"`);
  }
}

/**
 * Retrieves deployment history for a project.
 */
export async function getDeployments(
  token: string,
  projectId: string,
  limit = 5,
  teamId?: string | null
): Promise<VercelDeployment[]> {
  try {
    const client = createClient(token, teamId);
    const response = await client.get<{ deployments: VercelDeployment[] }>(
      '/v6/deployments',
      {
        params: { projectId, limit },
      }
    );
    return response.data.deployments || [];
  } catch (err) {
    handleApiError(err, `fetch deployments for project "${projectId}"`);
  }
}

/**
 * Retrieves build & error logs for a specific deployment.
 * Returns formatted string representing the tail of the build log.
 */
export async function getDeploymentLogs(
  token: string,
  deploymentId: string,
  teamId?: string | null,
  limit = 50
): Promise<string> {
  try {
    const client = createClient(token, teamId);
    const response = await client.get<VercelLogEvent[]>(
      `/v2/deployments/${encodeURIComponent(deploymentId)}/events`,
      {
        params: {
          direction: 'tail',
          limit,
        },
      }
    );

    const events = response.data;
    if (!Array.isArray(events) || events.length === 0) {
      return 'No log events available for this deployment.';
    }

    // Extract text messages from events
    const lines = events
      .map((e) => e.payload?.text?.trim())
      .filter((text): text is string => Boolean(text));

    if (lines.length === 0) {
      return 'Log records exist, but contained no terminal text output.';
    }

    // Return the latest lines, capped to 4000 characters for Telegram message limit
    const combined = lines.join('\n');
    if (combined.length > 3800) {
      return '...(truncated)...\n' + combined.slice(-3800);
    }
    return combined;
  } catch (err) {
    handleApiError(err, `fetch logs for deployment "${deploymentId}"`);
  }
}

/**
 * Triggers a redeployment of an existing deployment.
 */
export async function redeploy(
  token: string,
  deploymentId: string,
  projectName: string,
  teamId?: string | null
): Promise<{ id: string; url: string; readyState: string }> {
  try {
    const client = createClient(token, teamId);
    const response = await client.post<{
      id: string;
      url: string;
      readyState: string;
    }>(
      '/v13/deployments',
      {
        name: projectName,
        deploymentId,
      },
      {
        params: { forceNew: '1' },
      }
    );
    return response.data;
  } catch (err) {
    handleApiError(err, `redeploy "${projectName}"`);
  }
}

/**
 * Queries Vercel Web Analytics for 24-hour and 7-day visit metrics.
 * Gracefully handles projects where Web Analytics is disabled.
 */
export async function getWebAnalytics(
  token: string,
  projectId: string,
  teamId?: string | null
): Promise<WebAnalyticsResult> {
  try {
    const client = createClient(token, teamId);
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Fetch 24h visits
    const [res24h, res7d] = await Promise.all([
      client.get<{ data?: { value?: number } }>(
        '/v1/query/web-analytics/visits/count',
        {
          params: {
            projectId,
            from: oneDayAgo,
            to: now,
          },
        }
      ),
      client.get<{ data?: { value?: number } }>(
        '/v1/query/web-analytics/visits/count',
        {
          params: {
            projectId,
            from: sevenDaysAgo,
            to: now,
          },
        }
      ),
    ]);

    return {
      isEnabled: true,
      visits24h: res24h.data?.data?.value ?? 0,
      visits7d: res7d.data?.data?.value ?? 0,
    };
  } catch (err) {
    // If Web Analytics is not enabled or not supported on this project tier, return friendly fallback
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 400 || status === 403 || status === 404) {
        return {
          isEnabled: false,
          visits24h: null,
          visits7d: null,
          message:
            'Web Analytics is not enabled for this project. You can enable it in Project Settings ➔ Analytics on Vercel.',
        };
      }
    }

    return {
      isEnabled: false,
      visits24h: null,
      visits7d: null,
      message: `Unable to fetch analytics: ${(err as Error).message}`,
    };
  }
}
