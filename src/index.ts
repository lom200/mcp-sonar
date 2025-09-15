#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { sonarSearchIssues, sonarSearchPullRequestIssues } from './sonar.js';

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
      }
    } catch {
      // If not JSON, treat as direct parameter object
      return {};
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

  // Main tool - register first for priority
  // Category: Primary, URL-based, Recommended
  mcp.registerTool('search_pull_request_issues_from_url', {
    title: 'PR Issues from URL',
    description: '**RECOMMENDED** - Use this for most cases. Search PR issues by parsing a SonarCloud PR issues page URL (copy-paste full browser URL).',
    inputSchema: {
      url: z.string().describe('Full SonarCloud PR issues URL')
    }
  }, async (args: unknown) => {
    try {
      const url = extractUrlFromArgs(args);
      // eslint-disable-next-line no-console
      console.error(`Extracted URL: ${url}`);
      if (process.env.MCP_LOCAL_ECHO === '1') {
        // eslint-disable-next-line no-console
        console.error('MCP_LOCAL_ECHO is ON: returning echo response');
        return { content: [{ type: 'text', text: `ECHO: ${url}` }] };
      }
      const data = await sonarSearchPullRequestIssues(url);
      return formatPullRequestIssuesResponse(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error in search_pull_request_issues_from_url: ${error}`);
      return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
    }
  });

  // Advanced tool - register second
  // Category: Advanced, Parameter-based, Fallback
  mcp.registerTool('search_pull_request_issues_by_params', {
    title: 'PR Issues by Params',
    description: '**ADVANCED** - Use only when URL parsing is not possible. Search PR issues using explicit params. Examples: statuses: "OPEN,CONFIRMED" OR ["OPEN","CONFIRMED"]. If componentKeys/org omitted, env defaults are used.',
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
      // eslint-disable-next-line no-console
      console.error(`Parsed params: ${JSON.stringify(params)}`);
      
      // Validate that we have meaningful parameters
      if (!params.pullRequest) {
        throw new Error('pullRequest parameter is required for advanced search');
      }
      
      // Check if this looks like a URL-based request that should use the main tool instead
      const hasUrlLikeParams = params.url || (typeof args === 'string' && args.includes('sonarcloud.io'));
      if (hasUrlLikeParams) {
        return { 
          content: [{ 
            type: 'text', 
            text: '⚠️ **RECOMMENDATION**: This appears to be a URL-based request. Please use the "PR Issues from URL" tool instead for better results.' 
          }] 
        };
      }
      
      if (!params.componentKeys) params.componentKeys = process.env.SONAR_PROJECT;
      if (!params.organization) params.organization = process.env.SONAR_ORGANIZATION;
      if (!params.statuses) params.statuses = 'OPEN,CONFIRMED';
      if (params.sinceLeakPeriod === undefined) params.sinceLeakPeriod = true;
      
      const data = await sonarSearchIssues(params);
      return formatPullRequestIssuesResponse(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error in search_pull_request_issues_by_params: ${error}`);
      return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
    }
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


