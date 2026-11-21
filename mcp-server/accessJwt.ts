/*
 * Verifying a Cloudflare Access assertion.
 *
 * Cloudflare puts a signed JWT on every request it lets through, in
 * Cf-Access-Jwt-Assertion. Reading the email out of it without checking the
 * signature is a common and bad shortcut: this container is reachable from
 * the tunnel, so an unverified header is a request to be whoever you like.
 * Three things are checked, and all three matter:
 *
 *   signature  against Cloudflare's published JWKS for the team domain
 *   audience   the specific Access app's AUD tag -- without this, a token
 *              minted for any other app on the same team domain (the
 *              WordPress admins, the Nextcloud MCP) would be accepted here
 *   expiry     jose enforces exp/nbf by default
 *
 * The JWKS is fetched lazily and cached by jose, with its own rotation
 * handling, so this does not add a network round trip per request.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AccessClaims {
  email: string | null;
}

export interface AccessVerifierConfig {
  /** e.g. "thepetersens" or the full "thepetersens.cloudflareaccess.com". */
  teamDomain: string;
  /** The Access application's AUD tag. Not optional, deliberately. */
  audience: string;
}

function issuerFor(teamDomain: string): string {
  const host = teamDomain.includes('.') ? teamDomain : `${teamDomain}.cloudflareaccess.com`;
  return `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}

export function createAccessVerifier(config: AccessVerifierConfig) {
  const issuer = issuerFor(config.teamDomain);
  const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));

  return async function verify(token: string): Promise<AccessClaims> {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: config.audience,
    });

    const email = typeof payload.email === 'string' ? payload.email : null;
    return { email };
  };
}

/*
 * Reads the verifier's configuration from the environment, refusing to start
 * without it. A server that cannot verify assertions must not come up at all
 * in HTTP mode -- the alternative is an endpoint that accepts anyone who can
 * reach it, which is exactly the failure this file exists to prevent.
 */
export function accessVerifierFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();

  const missing = [
    !teamDomain && 'CF_ACCESS_TEAM_DOMAIN',
    !audience && 'CF_ACCESS_AUD',
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(
      `Cannot verify Cloudflare Access assertions without ${missing.join(' and ')}. ` +
        'Refusing to start in HTTP mode.',
    );
  }

  return createAccessVerifier({ teamDomain: teamDomain!, audience: audience! });
}
