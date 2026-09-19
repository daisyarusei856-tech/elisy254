# ELISY254 PRO

A production-oriented Render/Node foundation for ELISY254.

## What is real
- Real Deriv public tick WebSocket connection from the browser.
- Real dynamic digit ranking from received ticks.
- Real OAuth 2.0 + PKCE server flow when Deriv credentials are configured.
- Real admin authentication.
- Admin bot create/edit/delete and file upload UI.
- Persistent local SQLite database for simple deployments.

## Important Render persistence note
Render's ephemeral filesystem can reset on redeploy/restart. For production bot files/database, use a persistent disk or replace the storage layer with managed Postgres + object storage. The included app works for development and a persistent-disk deployment.

## Environment
Required for OAuth:
BASE_URL=https://your-service.onrender.com
DERIV_CLIENT_ID=...
DERIV_REDIRECT_URI=https://your-service.onrender.com/auth/deriv/callback
SESSION_SECRET=long-random-secret

For partner-attributed signup:
DERIV_SIGNUP_TRACKING_TOKEN=your token from Deriv Partners
DERIV_AFFILIATE_ID=your affiliate ID

Admin:
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-immediately

## Render
1. Push this folder to GitHub.
2. Render -> New -> Web Service.
3. Select the repository.
4. Build: npm install
5. Start: node server.js
6. Add the environment variables above.
7. Set Deriv redirect URI to exactly https://YOUR-SERVICE.onrender.com/auth/deriv/callback.
8. Open the site.

## Deriv
The app uses the current Deriv OAuth 2.0 authorization-code + PKCE flow. The OAuth token exchange is server-side.
Public market data uses Deriv's public WebSocket, so digit analysis can work without a user account.
Account-scoped trading requires an authenticated user token and explicit trading implementation/confirmation. This project does not silently place real trades.

## Admin
Open /admin. Login with ADMIN_EMAIL and ADMIN_PASSWORD.
Admin can:
- create bot
- upload bot file
- set name
- set description
- choose accent color
- set active/inactive
- edit
- delete
- download/view bot files

Do not expose ADMIN_PASSWORD in frontend code.
