/*
 * stdio entry point: one process, one person, started by someone who already
 * has the keys. Identity comes from EZ_USER_ID -- see identity.ts for why
 * that is acceptable here and not over HTTP.
 *
 * This is the transport to develop against. It needs no tunnel, no Access
 * app and no container, so a tool can be changed and exercised in the time
 * it takes to restart a client.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServiceClient } from '../supabase';
import { envIdentityProvider } from '../identity';
import { createContext } from '../context';
import { createServer } from '../tools';

async function main() {
  const client = createServiceClient();
  const identity = await envIdentityProvider().resolve({});
  const server = createServer(createContext(client, identity));

  await server.connect(new StdioServerTransport());

  // Nothing is logged to stdout: that channel is the protocol. Anything this
  // process wants to say goes to stderr.
  process.stderr.write(`ez-workout MCP (stdio) ready for ${identity.email ?? identity.userId}\n`);
}

main().catch((error) => {
  process.stderr.write(`ez-workout MCP failed to start: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
