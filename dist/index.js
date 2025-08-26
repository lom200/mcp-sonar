#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { sonarSearchIssues, sonarGetIssue, sonarListRules } from './sonar.js';
function getServer() {
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
        description: 'Search issues in SonarCloud/SonarQube'
    }, async (args) => {
        const data = await sonarSearchIssues(args);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    });
    mcp.registerTool('sonar.get_issue', {
        description: 'Get a single issue by key'
    }, async (args) => {
        const data = await sonarGetIssue(args);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    });
    mcp.registerTool('sonar.list_rules', {
        description: 'List SonarCloud/SonarQube rules'
    }, async (args) => {
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
