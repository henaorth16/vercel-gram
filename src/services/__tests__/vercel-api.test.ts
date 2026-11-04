import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  verifyUser,
  getTeams,
  getProjects,
  getProject,
  getDeployments,
  getDeploymentLogs,
  redeploy,
  getWebAnalytics,
} from '../vercel-api.js';

vi.mock('axios');

describe('Vercel REST API Client', () => {
  const token = 'test_token_123';
  const teamId = 'team_abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifyUser should return user profile', async () => {
    const mockUser = { id: 'usr_1', username: 'alex', email: 'alex@example.com' };
    const mockGet = vi.fn().mockResolvedValue({ data: { user: mockUser } });
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);

    const user = await verifyUser(token);
    expect(user).toEqual(mockUser);
    expect(mockGet).toHaveBeenCalledWith('/v2/user');
  });

  it('getTeams should return teams list', async () => {
    const mockTeams = [{ id: 'team_1', slug: 'my-team', name: 'My Team' }];
    const mockGet = vi.fn().mockResolvedValue({ data: { teams: mockTeams } });
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);

    const teams = await getTeams(token);
    expect(teams).toEqual(mockTeams);
    expect(mockGet).toHaveBeenCalledWith('/v2/teams');
  });

  it('getProjects should include limit and teamId', async () => {
    const mockProjects = [{ id: 'prj_1', name: 'app' }];
    const mockGet = vi.fn().mockResolvedValue({ data: { projects: mockProjects } });
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);

    const res = await getProjects(token, teamId, 10);
    expect(res.projects).toEqual(mockProjects);
    expect(mockGet).toHaveBeenCalledWith('/v9/projects', { params: { limit: 10 } });
  });

  it('getProject should fetch single project by name or ID', async () => {
    const mockProject = { id: 'prj_1', name: 'my-web-app' };
    const mockGet = vi.fn().mockResolvedValue({ data: mockProject });
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);

    const res = await getProject(token, 'my-web-app', teamId);
    expect(res).toEqual(mockProject);
    expect(mockGet).toHaveBeenCalledWith('/v9/projects/my-web-app');
  });

  it('getDeployments should fetch deployment history', async () => {
    const mockDeployments = [
      { uid: 'dpl_1', name: 'app', state: 'READY', readyState: 'READY' },
    ];
    const mockGet = vi.fn().mockResolvedValue({ data: { deployments: mockDeployments } });
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);

    const res = await getDeployments(token, 'prj_1', 5, teamId);
    expect(res).toEqual(mockDeployments);
    expect(mockGet).toHaveBeenCalledWith('/v6/deployments', {
      params: { projectId: 'prj_1', limit: 5 },
    });
  });

  it('getDeploymentLogs should format log text', async () => {
    const mockEvents = [
      { created: 1, payload: { text: 'Building...' } },
      { created: 2, payload: { text: 'Error: Cannot find module ./App' } },
    ];
    const mockGet = vi.fn().mockResolvedValue({ data: mockEvents });
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);

    const logs = await getDeploymentLogs(token, 'dpl_1');
    expect(logs).toContain('Building...');
    expect(logs).toContain('Error: Cannot find module ./App');
  });

  it('redeploy should trigger deployment with forceNew=1', async () => {
    const mockResp = { id: 'dpl_2', url: 'https://app-new.vercel.app', readyState: 'BUILDING' };
    const mockPost = vi.fn().mockResolvedValue({ data: mockResp });
    vi.mocked(axios.create).mockReturnValue({ post: mockPost } as any);

    const res = await redeploy(token, 'dpl_1', 'my-app', teamId);
    expect(res).toEqual(mockResp);
    expect(mockPost).toHaveBeenCalledWith(
      '/v13/deployments',
      { name: 'my-app', deploymentId: 'dpl_1' },
      { params: { forceNew: '1' } }
    );
  });

  it('getWebAnalytics should gracefully handle disabled analytics without throwing', async () => {
    const axiosError: any = new Error('Request failed with status code 404');
    axiosError.isAxiosError = true;
    axiosError.response = { status: 404 };

    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const mockGet = vi.fn().mockRejectedValue(axiosError);
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);

    const analytics = await getWebAnalytics(token, 'prj_1');
    expect(analytics.isEnabled).toBe(false);
    expect(analytics.visits24h).toBeNull();
    expect(analytics.message).toContain('Web Analytics is not enabled');
  });
});
