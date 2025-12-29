# Phase 1: Workspaces Inventory

## Workspace Package Inventory

| Workspace Path | Package Name | Main Entry | Dev Script | Start Script | Build Script |
|----------------|--------------|------------|------------|--------------|--------------|
| `apps/retail-api` | `@astronote/retail-api` | `src/server.js` | `DOTENV_CONFIG_PATH=../.env node -r dotenv/config --watch src/server.js` | `DOTENV_CONFIG_PATH=../.env node -r dotenv/config src/server.js` | `echo 'No build step required - pure JavaScript'` |
| `apps/retail-worker` | `@astronote/retail-worker` | `src/sms.worker.js` | `DOTENV_CONFIG_PATH=../.env node -r dotenv/config src/sms.worker.js` | N/A | `echo 'No build step required - pure JavaScript'` |
| `apps/retail-web-legacy` | `@astronote/retail-web-legacy` | N/A | `vite` | N/A | `vite build` |
| `apps/shopify-api` | `@astronote/shopify-api` | `index.js` | `nodemon index.js` | `node index.js` | `prisma generate` |
| `apps/web` | `@astronote/web` | N/A | `vite` | N/A | `vite build` |
| `apps/astronote-shopify-extension` | `astronote-sms-marketing-extension` | N/A | N/A | N/A | N/A |

## Root Workspace Configuration

**Root `package.json` workspaces:**
```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

This automatically picks up all workspaces under `apps/`.

## Verdict

✅ **ALL WORKSPACES PROPERLY CONFIGURED**

- All 6 workspaces have unique package names
- All scripts use correct env paths (`DOTENV_CONFIG_PATH=../.env` for retail workspaces)
- Root workspace configuration uses `apps/*` pattern which automatically detects all workspaces

