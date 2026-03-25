# GutLog — TODOs

## Post-V1

### Import Batch Processing
- **What:** Chunked upload to `/api/import` — accept entries in batches of 100 via multiple requests with a client-side upload progress indicator
- **Why:** D1/Cloudflare Workers free plan has a ~1MB request body limit. Large dataset imports (e.g., from another food diary app with months/years of data) will hard-fail without chunking. This is more urgent than with Postgres — it's not just a timeout risk, it's a hard platform limit.
- **Pros:** Enables migration from other food diary apps, resilient to large payloads, works within D1 limits
- **Cons:** Minor complexity in import endpoint + client-side chunking logic, needs progress feedback UX
- **Context:** Current import accepts full JSON payload in one request. Works fine for <100 entries but will fail at the platform level for larger imports. Client splits the payload into chunks of 100, sends sequentially, shows progress bar.
- **Depends on:** Core import/export working (build step 12)

### Automated D1 Backup to R2
- **What:** Cloudflare Cron Trigger that runs weekly, exports all user data to Cloudflare R2 (object storage), keeps last 4 exports (rolling 1-month window)
- **Why:** GutLog stores personal health data — data loss would be painful. D1 provides 30-day time-travel recovery, but an independent backup to R2 is belt-and-suspenders insurance.
- **Pros:** Automated, zero-cost (R2 free tier = 10GB), independent of D1's built-in recovery, user doesn't need to remember to manually export
- **Cons:** Adds a Cron Trigger worker + R2 bucket to the infrastructure. Minor complexity.
- **Context:** With Postgres on Supabase/Railway, backups were handled by the hosting provider. With D1, we get time-travel but an independent backup layer adds confidence for health data. The manual `/api/export` endpoint already exists — the cron just automates calling it and storing the result in R2.
- **Depends on:** Core export API working (build step 12), R2 bucket configured in wrangler.toml

### Dark Mode
- **What:** Add dark mode color tokens to DESIGN.md and implement CSS custom property switching
- **Why:** Many users track gut symptoms at night / early morning. Dark mode reduces eye strain and is expected in health apps.
- **Pros:** Better nighttime UX, modern app expectation, Tailwind `dark:` makes implementation straightforward
- **Cons:** Requires designing a full second color token set (backgrounds, borders, entry type colors, insight/experiment card colors). Need to verify contrast ratios pass WCAG AA in dark mode too.
- **Context:** DESIGN.md currently defines light-mode only. The color system (greens, earth tones, purple insights, green experiments) needs careful dark-mode mapping to maintain warmth. Deferred from V1 design review — all 16 design decisions were made for light mode only.
- **Depends on:** DESIGN.md color tokens implemented in Tailwind config
