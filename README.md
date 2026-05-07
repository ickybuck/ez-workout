# ez-workout

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-sjbzkdgb)

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create local env file:
   ```bash
   cp .env.example .env
   ```
3. Set required values in `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Start the app:
   ```bash
   npm run dev
   ```

## Security notes

- `VITE_*` values are embedded in the frontend bundle and are **not secret**.
- Use only the **Supabase publishable/anon** key in `VITE_SUPABASE_ANON_KEY`.
- **Never** put a Supabase secret/service-role key in frontend env vars or commit it to git.

## Deploy notes

- Configure the same two required env vars in your hosting provider.
- Add your production URL to Supabase Auth redirect URL settings.
- Keep separate Supabase projects for staging and production.


## Codex Cloud quick start (no terminal required)

If you're using Codex Cloud and only see a diff/review screen:

1. Ask the agent in chat to set up `.env` locally.
2. Keep real keys in `.env` only (private), not in committed files.
3. Use `.env.example` as a template for teammates.
4. Review the diff and click **Create PR** when ready.

### Safety checklist

- `.env` is ignored by git.
- `VITE_*` vars only use publishable values.
- Never commit `sb_secret...` keys.
