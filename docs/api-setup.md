# External service setup

Copy `.env.example` to `.env.local`. Restart Next.js and the scan worker after changing environment variables. Never commit keys, paste them into screenshots, or prefix secret variables with `NEXT_PUBLIC_`.

## Supabase

Create a project at [Supabase](https://supabase.com/dashboard). Use the project URL, public anon key (or a compatible publishable key in the same configured public-key variable), and the server-side service-role key. The public key identifies the project and relies on RLS for authorization; the service-role key bypasses RLS and must never reach the browser.

Apply the migration and optional directory seed. Set the Auth Site URL to the app's URL and add `http://localhost:3000/auth/callback` and the deployed `/auth/callback` as allowed redirect URLs. For local verification using `127.0.0.1`, add that exact origin too. Configure email confirmation and a production SMTP sender. See [Supabase SSR documentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

## Tavily (default)

Create an account at [Tavily](https://app.tavily.com/) and copy a free-tier key to `TAVILY_API_KEY`. Set `WEB_SEARCH_PROVIDER=tavily`. The adapter uses [basic search](https://docs.tavily.com/documentation/api-reference/endpoint/search), three results per query, without generated answers or raw-content API extras. The app caps selected queries at fifteen; temporarily lower the environment cap for development. Free tiers have quotas and policies that can change. No auto-upgrade or paid plan is required by this application.

Missing keys, rate limits and provider downtime become report warnings. Repository and academic comparisons continue.

## OpenAlex

Create a free account/key through [OpenAlex](https://openalex.org/) and set `OPENALEX_API_KEY`. The [API reference](https://help.openalex.org/api/) documents the `api_key` query parameter, search, work metadata, open-access locations and abstracts. The app can attempt requests without a key, but configuring the free key is recommended for the intended allowance. Academic requests are capped at ten per scan. Abstract-only comparisons are labeled explicitly; no publisher paywalls are bypassed.

## DeepSeek

Create an account and API key at [DeepSeek](https://platform.deepseek.com/). Set `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL=deepseek-v4-flash`, or another model enabled for your account that supports the configured JSON response format. The adapter uses `https://api.deepseek.com/chat/completions` and structured JSON as documented in the [official API guide](https://api-docs.deepseek.com/).

The default model follows the project brief and remains configurable. Model availability and pricing must be verified in your own account. Only up to twenty strongest flagged excerpt pairs are sent, with each side capped at 1,800 characters. The AI cannot change the numerical score or introduce new sources. Missing access or malformed responses produce an unavailable-guidance state with a separate retry action. Automated tests use mocks and incur no API charges.

## Brave (optional)

Obtain a key from [Brave Search API](https://brave.com/search/api/), set `BRAVE_SEARCH_API_KEY`, then set `WEB_SEARCH_PROVIDER=brave`. Verify current access/pricing before selecting it. The app does not require Brave and does not automatically switch to it. A selected-but-unconfigured Brave provider produces a useful warning, while repository and OpenAlex checking continue.

## Cost and privacy controls

- Environment caps: 15 web queries, 10 academic queries, 20 AI analyses, with lower positive values supported.
- Institution settings: daily per-user scan limit, provider toggles and upload size limit.
- Exact duplicate queries are removed within each scan. No persistent search-query cache stores private thesis passages across users.
- Temporary HTTP failures retry with bounded exponential backoff. Retries can consume additional requests; query caps are logical queries, not a guarantee of raw HTTP request count.
- Public search results are discovery evidence, not a score or proof of plagiarism.
- No application setting purchases credits, enables an automatic payment upgrade, or sends the entire thesis to DeepSeek.
