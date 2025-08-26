import { request } from 'undici';
function ensureEnv() {
    const token = process.env.SONAR_TOKEN;
    if (!token) {
        throw new Error('SONAR_TOKEN is required');
    }
    const baseUrl = process.env.SONAR_BASE || 'https://sonarcloud.io';
    const authHeader = `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
    return { baseUrl, authHeader };
}
function appendParams(url, params) {
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null)
            continue;
        if (Array.isArray(value)) {
            if (value.length > 0)
                url.searchParams.append(key, value.join(','));
        }
        else {
            url.searchParams.append(key, String(value));
        }
    }
}
async function doGet(endpoint, query) {
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
    return res.body.json();
}
function parseInput(input) {
    if (typeof input === 'string') {
        try {
            return JSON.parse(input);
        }
        catch {
            return {};
        }
    }
    return input || {};
}
export async function sonarSearchIssues(input) {
    const params = parseInput(input);
    // If no organization provided, add default one from our tests
    if (!params.organization && !params.projects && !params.componentKeys && !params.assignees && !params.issues) {
        params.componentKeys = 'zandahealth_repo';
        params.pullRequest = '15001';
        params.statuses = 'OPEN,CONFIRMED';
    }
    return doGet('/api/issues/search', params);
}
export async function sonarGetIssue(input) {
    const params = parseInput(input);
    if (!params.key)
        throw new Error('key is required');
    return doGet('/api/issues/show', { key: params.key });
}
export async function sonarListRules(input) {
    const params = parseInput(input);
    // Add default organization if not provided
    if (!params.organization) {
        params.organization = 'zanda';
    }
    return doGet('/api/rules/search', params);
}
