import { request } from 'undici';

export type SearchIssuesInput = {
  componentKeys?: string | string[];
  projects?: string | string[];
  pullRequest?: string;
  statuses?: string | string[];
  types?: string | string[];
  severities?: string | string[];
  ps?: number;
  p?: number;
};

export type GetIssueInput = { key: string };

export type ListRulesInput = {
  languages?: string | string[];
  repositories?: string | string[];
  q?: string;
  ps?: number;
  p?: number;
};

function ensureEnv(): { baseUrl: string; authHeader: string } {
  const token = process.env.SONAR_TOKEN;
  if (!token) {
    throw new Error('SONAR_TOKEN is required');
  }
  const baseUrl = process.env.SONAR_BASE || 'https://sonarcloud.io';
  const authHeader = `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
  return { baseUrl, authHeader };
}

function appendParams(url: URL, params: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) url.searchParams.append(key, value.join(','));
    } else {
      url.searchParams.append(key, String(value));
    }
  }
}

async function doGet<T>(endpoint: string, query: Record<string, unknown>): Promise<T> {
  const { baseUrl, authHeader } = ensureEnv();
  const url = new URL(endpoint, baseUrl);
  appendParams(url, query);
  const res = await request(url.toString(), {
    method: 'GET',
    headers: { Authorization: authHeader, Accept: 'application/json' }
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const body = await res.body.text();
    throw new Error(`Sonar API error ${res.statusCode}: ${body}`);
  }
  return res.body.json() as Promise<T>;
}

export async function sonarSearchIssues(input: SearchIssuesInput) {
  return doGet('/api/issues/search', input);
}

export async function sonarGetIssue(input: GetIssueInput) {
  if (!input?.key) throw new Error('key is required');
  return doGet('/api/issues/show', { key: input.key });
}

export async function sonarListRules(input: ListRulesInput) {
  return doGet('/api/rules/search', input);
}


