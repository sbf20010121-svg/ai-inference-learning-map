---
name: cloud-sync-security
description: Maintain the optional GitHub private learning-notes sync safely, including secrets, user authentication, conflict resolution and browser import/export compatibility.
---

# Private learning-data sync maintenance

When touching `cloud-sync-worker.js`, `site/js/cloud-sync.js`, `site/cloud-sync.css`, `site/cloud-config.json`, or `docs/cloud-sync-setup.md`:

1. **Public != personal.** Keep the existing public course repository as it is; store notes and progress **only** in the user's separate GitHub Private repository. Verify private visibility before every remote read and write. Never sync internal/company secrets.
2. **Secrets server-side only.** No PAT, OAuth Client Secret, or `SESSION_HMAC_KEY` in HTML/JS static assets, public GitHub commits, screenshot or chat. Require Cloudflare Worker secrets; browser holds only a short-lived signed session token, not the GitHub API Token.
3. **Authenticate.** OAuth state must be verified; fetch `/user` server-side and compare to `ALLOWED_LOGIN`. Restrict CORS to the exact Pages origin; avoid open redirects. No write route without a valid signed session.
4. **Protect progress.** Keep exported JSON schema format/version and original browser progress keys. Preserve old local data even while offline. Never auto-overwrite a remote SHA changed by another device: HTTP 409 must show a conflict with explicit choices. Encourage exporting local backups before destructive choices.
5. **No false success.** Distinguish local saved, queued, cloud written, conflicts, expired session, and not configured. Successful `npm test` does **not** establish real cloud deployment or a working GitHub OAuth app. Perform live OAuth plus private repo write/read acceptance testing after owner completes setup.
6. **Personal permissions.** A separate GitHub App connector may require authorization to the new Private repo before ChatGPT can read it. Do not assume user browser OAuth grants ChatGPT permission.
7. **Regression.** Run `npm test` and browser checks for existing course navigation, notes, dark mode, and mobile layout. Avoid requiring any cloud service for ordinary site learning.
