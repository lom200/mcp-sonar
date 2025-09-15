# mcp-sonar

MCP integration for SonarCloud/SonarQube. Provides tools to search pull request issues via the Model Context Protocol.

## Quick start

### Configure in Cursor
Add one of the two options to your `~/.cursor/mcp.json`.

Option 1: use npx (always latest):
```json
{
  "mcpServers": {
    "mcp-sonar": {
      "command": "npx",
      "args": ["mcp-sonar@latest"],
      "env": {
        "SONAR_TOKEN": "your_sonar_token_here",
        "SONAR_PROJECT": "your_project_key",
        "SONAR_ORGANIZATION": "your_organization"
      }
    }
  }
}
```

Option 2: global install and direct binary:
```bash
npm install -g mcp-sonar
```
```json
{
  "mcpServers": {
    "mcp-sonar": {
      "command": "mcp-sonar",
      "env": {
        "SONAR_TOKEN": "your_sonar_token_here",
        "SONAR_PROJECT": "your_project_key",
        "SONAR_ORGANIZATION": "your_organization"
      }
    }
  }
}
```

Restart Cursor after editing `mcp.json`.

### Get a SonarCloud token
- Go to https://sonarcloud.io
- My Account -> Security -> Generate Tokens
- Create a token with Analyze permissions

## Environment variables
- SONAR_TOKEN: required
- SONAR_BASE: optional, default https://sonarcloud.io
- SONAR_PROJECT: optional default project
- SONAR_ORGANIZATION: optional default organization

## Tools

### `search_pull_request_issues_from_url` - **RECOMMENDED**
Parse a SonarCloud PR issues URL and fetch issues. This is the primary tool for most use cases.

**Usage:**
```
Use mcp-sonar and retrieve issues from https://sonarcloud.io/project/issues?id=your_project&pullRequest=123&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true
```

### `search_pull_request_issues_by_params` - **ADVANCED**
Search PR issues using explicit parameters. Use only when URL parsing is not possible.

**Parameters:**
- `pullRequest` (required): Pull request number
- `componentKeys` (optional): Project key; defaults to SONAR_PROJECT
- `organization` (optional): Org key; defaults to SONAR_ORGANIZATION  
- `statuses` (optional): Statuses filter (e.g., "OPEN,CONFIRMED" or ["OPEN","CONFIRMED"])
- `sinceLeakPeriod` (optional): Defaults to true when not provided

## Development
```bash
git clone https://github.com/lom200/mcp-sonar.git
cd mcp-sonar
npm install
npm run build
node dist/index.js
```

## Security
Never commit your SONAR_TOKEN. Use environment variables or the env section in mcp.json.


