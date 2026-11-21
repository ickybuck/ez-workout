/*
 * Who is asking.
 *
 * The app is multi-user -- workout_templates, exercise_defaults and
 * user_settings all carry a user_id, and exercises is a shared library -- so
 * this server cannot be built around one person. But it also cannot read
 * identity from its own inputs: a tool argument saying "I am Eric" is a claim
 * by the model, not a fact, and the model is downstream of whatever it has
 * been reading.
 *
 * So identity arrives out of band, from the transport, and there are exactly
 * two transports:
 *
 *   stdio  the process was started by a person at a terminal who already has
 *          the keys. EZ_USER_ID is as trustworthy as the shell that set it.
 *   http   Cloudflare Access authenticated the human before the request
 *          reached the tunnel and stamped a signed assertion on it. That
 *          signature is the only thing worth trusting, so it is verified
 *          properly -- see accessJwt.ts -- and the email inside it is mapped
 *          to a Supabase user.
 *
 * There is deliberately no third path and no fallback. An HTTP request with
 * no valid assertion fails; it does not quietly become the env user. That
 * matters more here than in most places, because the database client this
 * identity feeds holds a service_role key, so a wrong answer is not "access
 * denied", it is somebody else's training history.
 */

export type IdentitySource = 'env' | 'access-jwt';

export interface Identity {
  /** auth.users.id. Everything downstream scopes on this and nothing else. */
  userId: string;
  /** For log lines and error messages. Null when stdio did not supply one. */
  email: string | null;
  source: IdentitySource;
}

export interface IdentityProvider {
  resolve(headers: Record<string, string | string[] | undefined>): Promise<Identity>;
}

/** Resolves an email to auth.users.id, or null when nobody matches. */
export type UserLookup = (email: string) => Promise<string | null>;

export class IdentityError extends Error {
  /** HTTP status to answer with. 401 means "authenticate"; 403 means "not you". */
  readonly status: number;

  constructor(message: string, status = 401, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'IdentityError';
    this.status = status;
  }
}

/*
 * stdio: trust the environment, but insist it is actually set.
 *
 * An unset EZ_USER_ID used to be tempting to treat as "the only user", back
 * when there was one. Defaulting here would silently write Marilyn's sets into
 * Eric's history on a mistyped env file, so it throws instead.
 */
export function envIdentityProvider(env: NodeJS.ProcessEnv = process.env): IdentityProvider {
  return {
    async resolve() {
      const userId = env.EZ_USER_ID?.trim();
      if (!userId) {
        throw new IdentityError(
          'EZ_USER_ID is not set. The stdio transport takes its identity from the environment.',
          500,
        );
      }
      return { userId, email: env.EZ_USER_EMAIL?.trim() || null, source: 'env' };
    },
  };
}

/*
 * http: the email comes from a verified Cloudflare Access assertion.
 *
 * verify() is injected rather than imported so the tests can exercise the
 * mapping and the refusals without standing up a JWKS endpoint. The real
 * implementation is accessJwt.ts and it does check the signature, the
 * audience and the expiry -- a header-shaped string is not evidence of
 * anything, and this container is reachable from the tunnel.
 */
export function accessIdentityProvider(
  verify: (token: string) => Promise<{ email: string | null }>,
  lookup: UserLookup,
): IdentityProvider {
  return {
    async resolve(headers) {
      const raw = headers['cf-access-jwt-assertion'];
      const token = Array.isArray(raw) ? raw[0] : raw;
      if (!token) {
        throw new IdentityError('No Cloudflare Access assertion on the request.');
      }

      let email: string | null;
      try {
        ({ email } = await verify(token));
      } catch (cause) {
        // The client is told only that the assertion failed -- whether it was
        // the signature, the audience or the expiry is of most use to someone
        // probing it. The reason is kept on `cause` so the server can log it.
        throw new IdentityError('Cloudflare Access assertion did not verify.', 401, { cause });
      }

      if (!email) {
        throw new IdentityError('Access assertion carries no email.');
      }

      // Access and Supabase are two directories. Being allowed through the
      // policy says nothing about having an account in the app.
      const userId = await lookup(email.toLowerCase());
      if (!userId) {
        throw new IdentityError(`No ez-workout account for ${email}.`, 403);
      }

      return { userId, email, source: 'access-jwt' };
    },
  };
}
