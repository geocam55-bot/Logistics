ASSISTANT CHANGES FOR GOOGLE AI STUDIO

Summary
- Purpose: record all changes I made to help you restore live Supabase connectivity and stop deleted tenant users from reappearing.

Files modified
- [server.ts](server.ts)
- [.env](.env) (created/updated locally with your Supabase credentials)

What I changed in `server.ts`
- Added a temporary route to clear ProSpaces client localStorage keys when opened in a browser:

  Route: `GET /clear-local-storage`

  Snippet added (insert near static/middleware setup, before server listen):

  ```js
  app.get('/clear-local-storage', (req, res) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Clear Local Storage</title></head><body><script>
      try {
        localStorage.removeItem('prospaces_custom_supabase_url');
        localStorage.removeItem('prospaces_custom_supabase_key');
        localStorage.removeItem('prospaces_dismissed_rls_warning');
        localStorage.removeItem('prospaces_all_tenants');
        localStorage.removeItem('prospaces_active_tenant');
        localStorage.removeItem('prospaces_active_user');
        console.log('Cleared ProSpaces localStorage keys');
        alert('Cleared ProSpaces localStorage keys. You will be redirected to /');
      } catch(e) { console.warn('Failed to clear local storage', e); }
      window.location = '/';
    </script></body></html>`;
    res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
  });
  ```

- Added an in-memory map `deletedTenantRecords` to track explicit deletions so that concurrent client saves cannot resurrect deleted rows.

  Declaration added near `inMemoryTenantStates`:

  ```js
  const deletedTenantRecords = {};
  // shape: { [tenantId]: { [table]: Set<string> } }
  ```

- Updated `/api/tenant/delete-record` to register deleted ids in `deletedTenantRecords` for both Supabase-active and in-memory-fallback paths. After performing the delete it now also records the id in memory to be enforced on subsequent save-state calls.

- Updated `/api/tenant/save-state` to enforce any recorded explicit deletes for the tenant before finishing the save/upsert sequence. The handler now iterates `deletedTenantRecords[tenantId]` and issues defensive deletes for recorded ids (per table). After applying, the recorded marks for that tenant are cleared.

Why these changes
- Problem: clients send full-state saves that may include stale copies of a deleted user; the server upserts that full state and the deleted record reappears.
- Fix: record explicit delete events and enforce them server-side during the save-state workflow, guaranteeing deletes persist even if another client sends older state.

Other changes
- `.env` was created/updated locally to include your provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `SUPABASE_SERVICE_ROLE_KEY` so server-side connectivity works. This file is not committed by me (it was created in the workspace for local testing). Example entries:

  ```env
  SUPABASE_URL="https://...supabase.co"
  SUPABASE_ANON_KEY="your-anon-key"
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  ```

Testing & verification steps
1. Start dev server (if not running):

```bash
npm run dev
```

2. Delete a user in the app UI.
3. Immediately refresh the app in the same or another browser. Deleted user should not reappear.
4. To inspect the live database dump (debug):

```bash
curl http://localhost:3000/api/debug-db | jq .users
```

5. To clear local browser overrides (alternative to opening the helper page):

Open browser console and run:

```js
localStorage.removeItem('prospaces_custom_supabase_url');
localStorage.removeItem('prospaces_custom_supabase_key');
```

Caveats
- Lazy auto-seeding: If the users table becomes empty, the server contains lazy seeding logic that will insert default users (e.g., `George Campbell`, `Joshua Campbell`). If you want a default user permanently removed, I can remove that seed entry from the self-healing logic in `server.ts`.
- These fixes use an in-memory deletion map. In a multi-instance / horizontally scaled deployment you'd want to persist delete markers (e.g., a `deleted_marks` table, Redis, or a durable queue) so that all instances enforce deletes.

If you want, I can:
- Produce a small persistent migration to store explicit deletes in the DB (recommended for production), or
- Remove specific default seed users from the auto-seeding routine so they won't be reinserted.

Files to review
- [server.ts](server.ts)
- [.env](.env) (local)

---
File created by assistant: ASSISTANT_CHANGES_FOR_GOOGLE_AI_STUDIO.md
