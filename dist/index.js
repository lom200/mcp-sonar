#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { sonarSearchIssues, sonarGetIssue, sonarListRules } from './sonar.js';
function getServer() {
    const mcp = new McpServer({ name: 'mcp-sonar', version: '0.1.0' });
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
