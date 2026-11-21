import { describe, it, expect, vi } from 'vitest';
import { envIdentityProvider, accessIdentityProvider, IdentityError } from './identity';

const ok = async () => ({ email: 'eric@example.com' });
const found: (id: string) => (email: string) => Promise<string | null> = (id) => async () => id;
const none = async () => null;

describe('envIdentityProvider', () => {
  it('takes the user from the environment', async () => {
    const id = await envIdentityProvider({ EZ_USER_ID: 'u-1', EZ_USER_EMAIL: 'a@b.c' } as never).resolve({});
    expect(id).toEqual({ userId: 'u-1', email: 'a@b.c', source: 'env' });
  });

  it('refuses to guess when EZ_USER_ID is missing', async () => {
    // The whole point: no default user. A mistyped env file must fail loudly
    // rather than write one person's sets into another person's history.
    await expect(envIdentityProvider({} as never).resolve({})).rejects.toThrow(/EZ_USER_ID/);
  });
});

describe('accessIdentityProvider', () => {
  it('maps a verified assertion to a Supabase user', async () => {
    const id = await accessIdentityProvider(ok, found('u-9')).resolve({
      'cf-access-jwt-assertion': 'token',
    });
    expect(id).toEqual({ userId: 'u-9', email: 'eric@example.com', source: 'access-jwt' });
  });

  it('rejects a request with no assertion', async () => {
    await expect(accessIdentityProvider(ok, found('u-9')).resolve({})).rejects.toThrow(/No Cloudflare Access/);
  });

  it('rejects an assertion that does not verify', async () => {
    const bad = async () => {
      throw new Error('signature');
    };
    await expect(
      accessIdentityProvider(bad, found('u-9')).resolve({ 'cf-access-jwt-assertion': 'forged' }),
    ).rejects.toThrow(/did not verify/);
  });

  it('never falls back to the environment when the assertion is absent', async () => {
    // Guards the rule that makes the service_role key survivable: no header,
    // no request. Even with EZ_USER_ID set in the same process.
    process.env.EZ_USER_ID = 'u-env';
    try {
      await expect(accessIdentityProvider(ok, found('u-9')).resolve({})).rejects.toBeInstanceOf(IdentityError);
    } finally {
      delete process.env.EZ_USER_ID;
    }
  });

  it('refuses someone through the policy who has no account, with 403 not 401', async () => {
    // Access and Supabase are separate directories. Being allowed through the
    // tunnel is not the same as having a user row, and answering 401 would
    // send them round the login loop again for no reason.
    const err: unknown = await accessIdentityProvider(ok, none)
      .resolve({ 'cf-access-jwt-assertion': 'token' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(IdentityError);
    expect((err as IdentityError).status).toBe(403);
  });

  it('looks the email up in lower case', async () => {
    // Access returns whatever the identity provider holds; Postgres
    // comparisons are case sensitive, so a capitalised address would miss.
    const lookup = vi.fn(async () => 'u-9');
    await accessIdentityProvider(async () => ({ email: 'Eric@Example.COM' }), lookup).resolve({
      'cf-access-jwt-assertion': 'token',
    });
    expect(lookup).toHaveBeenCalledWith('eric@example.com');
  });

  it('takes the first value when the header arrives repeated', async () => {
    const id = await accessIdentityProvider(ok, found('u-9')).resolve({
      'cf-access-jwt-assertion': ['token', 'second'],
    });
    expect(id.userId).toBe('u-9');
  });
});
