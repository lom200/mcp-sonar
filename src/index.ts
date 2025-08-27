#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { sonarSearchIssues, sonarGetIssue, sonarListRules, sonarSearchPullRequestIssues } from './sonar.js';

function extractUrlFromArgs(args: unknown): string {
  if (typeof args === 'object' && args !== null && 'random_string' in args) {
    const randomString = (args as { random_string: string }).random_string;
    // Try to parse as JSON first, then fallback to direct string
    try {
      const parsed = JSON.parse(randomString);
      if (typeof parsed === 'string') {
        return parsed;
      } else if (typeof parsed === 'object' && parsed !== null && 'url' in parsed) {
        return parsed.url;
      }
    } catch {
      // If not JSON, treat as direct URL string
      return randomString;
    }
  } else if (typeof args === 'string') {
    return args;
  } else if (typeof args === 'object' && args !== null && 'url' in args) {
    return (args as { url: string }).url;
  }
  throw new Error('URL parameter is required');
}

function parseMcpArgs(args: unknown): any {
  if (typeof args === 'object' && args !== null && 'random_string' in args) {
    const randomString = (args as { random_string: string }).random_string;
    try {
      const parsed = JSON.parse(randomString);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      } else if (typeof parsed === 'string') {
        // If it's a string, try to parse it as URL parameters
        const url = new URL(parsed);
        const params: any = {};
        if (url.searchParams.get('id')) params.componentKeys = url.searchParams.get('id');
        if (url.searchParams.get('pullRequest')) params.pullRequest = url.searchParams.get('pullRequest');
        if (url.searchParams.get('issueStatuses')) params.statuses = url.searchParams.get('issueStatuses')?.split(',');
        if (url.searchParams.get('sinceLeakPeriod')) params.sinceLeakPeriod = url.searchParams.get('sinceLeakPeriod') === 'true';
        return params;
      }
    } catch {
      // If not JSON, try to parse as URL
      try {
        const url = new URL(randomString);
        const params: any = {};
        if (url.searchParams.get('id')) params.componentKeys = url.searchParams.get('id');
        if (url.searchParams.get('pullRequest')) params.pullRequest = url.searchParams.get('pullRequest');
        if (url.searchParams.get('issueStatuses')) params.statuses = url.searchParams.get('issueStatuses')?.split(',');
        if (url.searchParams.get('sinceLeakPeriod')) params.sinceLeakPeriod = url.searchParams.get('sinceLeakPeriod') === 'true';
        return params;
      } catch {
        return { url: randomString };
      }
    }
  }
  return args || {};
}

function formatIssuesResponse(data: any) {
  const summary = {
    total: data.total,
    effortTotal: data.effortTotal,
    debtTotal: data.debtTotal,
    severityBreakdown: {
      critical: data.issues?.filter((i: any) => i.severity === 'CRITICAL').length || 0,
      major: data.issues?.filter((i: any) => i.severity === 'MAJOR').length || 0,
      minor: data.issues?.filter((i: any) => i.severity === 'MINOR').length || 0,
      info: data.issues?.filter((i: any) => i.severity === 'INFO').length || 0
    },
    topIssues: data.issues?.slice(0, 10).map((issue: any) => ({
      key: issue.key,
      severity: issue.severity,
      message: issue.message,
      component: issue.component,
      line: issue.line,
      effort: issue.effort
    })) || []
  };
  
  return {
    content: [{
      type: 'text' as const,
      text: `## SonarCloud Issues Summary\n\n` +
            `**Total Issues:** ${summary.total}\n` +
            `**Total Effort:** ${summary.effortTotal} minutes\n` +
            `**Technical Debt:** ${summary.debtTotal} minutes\n\n` +
            `### Severity Breakdown:\n` +
            `- 🔴 Critical: ${summary.severityBreakdown.critical}\n` +
            `- 🟠 Major: ${summary.severityBreakdown.major}\n` +
            `- 🟡 Minor: ${summary.severityBreakdown.minor}\n` +
            `- ℹ️ Info: ${summary.severityBreakdown.info}\n\n` +
            `### Top Issues:\n` +
            summary.topIssues.map((issue: any) => 
              `- **${issue.severity}** ${issue.message} (${issue.component}:${issue.line})`
            ).join('\n')
    }]
  };
}

function formatPullRequestIssuesResponse(data: any) {
  const criticalCount = data.issues?.filter((i: any) => i.severity === 'CRITICAL').length || 0;
  const majorCount = data.issues?.filter((i: any) => i.severity === 'MAJOR').length || 0;
  
  let recommendation = '';
  if (criticalCount > 0) {
    recommendation = '🚨 **BLOCKING:** Critical issues must be fixed before merge';
  } else if (majorCount > 5) {
    recommendation = '⚠️ **REVIEW NEEDED:** High number of major issues';
  } else {
    recommendation = '✅ **READY:** Issues are manageable';
  }
  
  return {
    content: [{
      type: 'text' as const,
      text: `## Pull Request Analysis\n\n${recommendation}\n\n` +
            `**Issues Found:** ${data.total}\n` +
            `**Critical:** ${criticalCount}\n` +
            `**Major:** ${majorCount}\n\n` +
            `**Recommendation:** ${recommendation}\n\n` +
            `### Issues Summary:\n` +
            formatIssuesResponse(data).content[0].text
    }]
  };
}

function getServer(): McpServer {
  const mcp = new McpServer({ name: 'mcp-sonar', version: '0.1.0' });

  // Add resource to appear in Add Context (configurable)
  const projectKey = process.env.SONAR_PROJECT || 'your-project';
  const organization = process.env.SONAR_ORGANIZATION || 'your-org';
  
  mcp.registerResource('sonar-project-issues', `sonar://${projectKey}/issues`, {
    title: `SonarCloud Issues - ${projectKey}`,
    description: `Current issues in ${projectKey} project`,
    mimeType: 'application/json'
  }, async () => {
    const data = await sonarSearchIssues({ 
      componentKeys: projectKey,
      organization: organization
    });
    return {
      contents: [{
        uri: `sonar://${projectKey}/issues`,
        text: JSON.stringify(data, null, 2),
        mimeType: 'application/json'
      }]
    };
  });

  mcp.registerTool('sonar.search_issues', {
    title: 'Search Issues',
    description: 'Search issues in SonarCloud/SonarQube. statuses supports string "OPEN,CONFIRMED" or array ["OPEN","CONFIRMED"].',
    inputSchema: {
      componentKeys: z.union([z.string(), z.array(z.string())]).optional().describe('Project key(s). If omitted, uses SONAR_PROJECT'),
      projects: z.union([z.string(), z.array(z.string())]).optional().describe('Alternative to componentKeys'),
      pullRequest: z.string().optional().describe('Pull request number as string'),
      statuses: z.union([
        z.string(),
        z.array(z.enum(['OPEN','CONFIRMED','REOPENED','RESOLVED','CLOSED']))
      ]).optional().describe('Issue statuses. Example: "OPEN,CONFIRMED" or ["OPEN","CONFIRMED"]'),
      types: z.union([z.string(), z.array(z.string())]).optional().describe('Issue types filter'),
      severities: z.union([z.string(), z.array(z.string())]).optional().describe('Severity filter'),
      ps: z.number().int().optional().describe('Page size'),
      p: z.number().int().optional().describe('Page index'),
      organization: z.string().optional().describe('Organization key. If omitted, uses SONAR_ORGANIZATION'),
      sinceLeakPeriod: z.boolean().optional().describe('Limit to current leak period')
    }
  }, async (args: unknown) => {
    const data = await sonarSearchIssues(args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  mcp.registerTool('sonar.search_pull_request_issues_from_url', {
    title: 'PR Issues from URL',
    description: 'Search PR issues by parsing a SonarCloud PR issues page URL (copy-paste full browser URL).',
    inputSchema: {
      url: z.string().url().describe('Full SonarCloud PR issues URL')
    }
  }, async (args: unknown) => {
    try {
      const url = extractUrlFromArgs(args);
      console.error(`Extracted URL: ${url}`);
      const data = await sonarSearchPullRequestIssues(url);
      return formatPullRequestIssuesResponse(data);
    } catch (error) {
      console.error(`Error in search_pull_request_issues_from_url: ${error}`);
      return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
    }
  });

  mcp.registerTool('sonar.search_pull_request_issues_by_params', {
    title: 'PR Issues by Params',
    description: 'Search PR issues using explicit params. Examples: statuses: "OPEN,CONFIRMED" OR ["OPEN","CONFIRMED"]. If componentKeys/org omitted, env defaults are used.',
    inputSchema: {
      componentKeys: z.string().optional().describe('Project key; defaults to SONAR_PROJECT'),
      organization: z.string().optional().describe('Org key; defaults to SONAR_ORGANIZATION'),
      pullRequest: z.string().describe('Pull request number'),
      statuses: z.union([
        z.string(),
        z.array(z.enum(['OPEN','CONFIRMED','REOPENED','RESOLVED','CLOSED']))
      ]).optional().describe('Statuses filter'),
      sinceLeakPeriod: z.boolean().optional().describe('Defaults to true when not provided')
    }
  }, async (args: unknown) => {
    try {
      const params = parseMcpArgs(args) as any;
      console.error(`Parsed params: ${JSON.stringify(params)}`);
      if (!params.componentKeys) params.componentKeys = process.env.SONAR_PROJECT;
      if (!params.organization) params.organization = process.env.SONAR_ORGANIZATION;
      if (!params.statuses) params.statuses = 'OPEN,CONFIRMED';
      if (params.sinceLeakPeriod === undefined) params.sinceLeakPeriod = true;
      if (!params.pullRequest) throw new Error('pullRequest parameter is required');
      const data = await sonarSearchIssues(params);
      return formatPullRequestIssuesResponse(data);
    } catch (error) {
      console.error(`Error in search_pull_request_issues_by_params: ${error}`);
      return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
    }
  });

  mcp.registerTool('sonar.get_issue', {
    title: 'Get Issue',
    description: 'Get a single issue by key',
    inputSchema: {
      key: z.string().describe('Issue key, e.g. AXabc123')
    }
  }, async (args: unknown) => {
    const data = await sonarGetIssue(args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  mcp.registerTool('sonar.list_rules', {
    title: 'List Rules',
    description: 'List SonarCloud/SonarQube rules with optional filters',
    inputSchema: {
      languages: z.union([z.string(), z.array(z.string())]).optional().describe('Language keys like ts, js, csharp'),
      repositories: z.union([z.string(), z.array(z.string())]).optional().describe('Repository keys'),
      q: z.string().optional().describe('Query string'),
      ps: z.number().int().optional().describe('Page size'),
      p: z.number().int().optional().describe('Page index'),
      organization: z.string().optional().describe('Defaults to SONAR_ORGANIZATION')
    }
  }, async (args: unknown) => {
    const data = await sonarListRules(args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  return mcp;
}

async function main() {
  const mcp = getServer();
  const transport = new StdioServerTransport();
  
  await mcp.connect(transport);
  
  // eslint-disable-next-line no-console
  console.error('MCP sonar server running on stdio');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


