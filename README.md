# mcp-sonar

MCP integration for SonarCloud/SonarQube. Provides tools to search issues, get a single issue, and list rules via the Model Context Protocol.

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
Available tools:
- `search_pull_request_issues_from_url`: parse a SonarCloud PR issues URL and fetch issues
- `search_pull_request_issues_by_params`: search PR issues using explicit parameters
- `debug_ping`: simple ping tool for testing connectivity

Example (PR issues from URL):
```
Use mcp-sonar and retrieve issues from https://sonarcloud.io/project/issues?id=your_project&pullRequest=123&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true
```

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


