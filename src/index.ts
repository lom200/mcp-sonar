import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { sonarSearchIssues, sonarGetIssue, sonarListRules } from './sonar.js';

type TransportMap = Record<string, StreamableHTTPServerTransport>;

function getServer(): McpServer {
  const mcp = new McpServer({ name: 'mcp-sonar', version: '0.1.0' });

  mcp.registerTool('sonar.search_issues', { description: 'Search issues in Sonar' }, async (args: unknown) => {
    const data = await sonarSearchIssues(args as any);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  });

  mcp.registerTool('sonar.get_issue', { description: 'Get a single issue by key' }, async (args: unknown) => {
    const data = await sonarGetIssue(args as any);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  });

  mcp.registerTool('sonar.list_rules', { description: 'List rules' }, async (args: unknown) => {
    const data = await sonarListRules(args as any);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  });

  return mcp;
}

function isInitialize(body: any): boolean {
  if (!body) return false;
  const check = (msg: any) => typeof msg === 'object' && msg !== null && msg.method === 'initialize';
  return Array.isArray(body) ? body.some(check) : check(body);
}

async function start() {
  const host = '0.0.0.0';
  const portArgIndex = process.argv.findIndex((a) => a === '--port');
  const port = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : 3000;

  const transports: TransportMap = {};

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname !== '/') {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }

      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

      if (req.method === 'GET') {
        if (!sessionId || !transports[sessionId]) {
          res.statusCode = 400;
          res.end('Invalid or missing session ID');
          return;
        }
        await transports[sessionId].handleRequest(req as any, res as any);
        return;
      }

      if (req.method === 'DELETE') {
        if (!sessionId || !transports[sessionId]) {
          res.statusCode = 400;
          res.end('Invalid or missing session ID');
          return;
        }
        await transports[sessionId].handleRequest(req as any, res as any);
        return;
      }

      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(Buffer.from(c)));
        req.on('end', async () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let body: any;
          try {
            body = JSON.parse(raw);
          } catch {
            res.statusCode = 400;
            res.end('Invalid JSON');
            return;
          }

          if (sessionId) {
            const transport = transports[sessionId];
            if (!transport) {
              res.statusCode = 400;
              res.end('Unknown session');
              return;
            }
            await transport.handleRequest(req as any, res as any, body);
            return;
          }

          if (!isInitialize(body)) {
            res.statusCode = 400;
            res.end('Bad Request: No valid session ID provided');
            return;
          }

          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid: string) => {
              transports[sid] = transport;
            },
            onclose: () => {
              const sid = (transport as any).sessionId as string | undefined;
              if (sid && transports[sid]) delete transports[sid];
            }
          } as any);

          const mcp = getServer();
          await mcp.connect(transport as any);
          await transport.handleRequest(req as any, res as any, body);
          return;
        });
        return;
      }

      res.statusCode = 405;
      res.setHeader('Allow', 'GET, POST, DELETE');
      res.end('Method Not Allowed');
    } catch (err) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`MCP server (streamable-http) listening on http://${host}:${port}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


