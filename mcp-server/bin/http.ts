/*
 * HTTP entry point, for the container behind the Cloudflare tunnel.
 *
 * Stateless by design: every request carries its own Cloudflare Access
 * assertion, so every request resolves its own identity and gets its own
 * server instance bound to that person. There is no session to attach a user
 * to, which removes a whole class of bug where a second person's request
 * lands on the first person's session.
 *
 * The port is not published to the host. cloudflared reaches this container
 * by name on the Docker network, exactly as it reaches the SiYuan and
 * Nextcloud MCP servers, so the only route in runs through Access.
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServiceClient, createUserLookup } from '../supabase';
import { accessIdentityProvider, IdentityError } from '../identity';
import { accessVerifierFromEnv } from '../accessJwt';
import { createContext } from '../context';
import { createServer } from '../tools';

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY = 1_000_000;

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) reject(new Error('Request body too large.'));
    });
    req.on('end', () => {
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Body is not JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
}

async function main() {
  // Both of these throw if their configuration is missing, and they are
  // called before the listener starts: a server that cannot verify an
  // assertion must never accept a request, because the fallback would be
  // trusting a header.
  const client = createServiceClient();
  const verify = accessVerifierFromEnv();
  const identityProvider = accessIdentityProvider(verify, createUserLookup(client));

  const http = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/healthz') {
      return send(res, 200, { ok: true });
    }

    if (url.pathname !== '/mcp') {
      return send(res, 404, { error: 'Not found' });
    }

    if (req.method !== 'POST') {
      // No GET stream and no DELETE: a stateless server has no session to
      // resume or tear down.
      res.setHeader('allow', 'POST');
      return send(res, 405, { error: 'Use POST.' });
    }

    let identity;
    try {
      identity = await identityProvider.resolve(req.headers as Record<string, string | string[] | undefined>);
    } catch (error) {
      const status = error instanceof IdentityError ? error.status : 500;
      const why = error instanceof Error && error.cause ? ` (${String(error.cause)})` : '';
      process.stderr.write(`auth refused: ${error instanceof Error ? error.message : error}${why}\n`);
      return send(res, status, { error: error instanceof Error ? error.message : 'Unauthorised' });
    }

    let body: unknown;
    try {
      body = await readBody(req);
    } catch (error) {
      return send(res, 400, { error: error instanceof Error ? error.message : 'Bad request' });
    }

    const server = createServer(createContext(client, identity));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      process.stderr.write(`request failed: ${error instanceof Error ? error.stack : error}\n`);
      if (!res.headersSent) send(res, 500, { error: 'Internal error' });
    }
  });

  http.listen(PORT, () => {
    process.stderr.write(`ez-workout MCP (http) listening on ${PORT}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`ez-workout MCP failed to start: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
