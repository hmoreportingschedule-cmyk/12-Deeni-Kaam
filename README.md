# Reporting & Analise Dashboard — Final Login Fix

This version fixes the browser `Failed to fetch` problem by routing all Google Apps Script requests through a Next.js server-side API route. The browser no longer calls the Google Apps Script URL directly, so Apps Script redirect/CORS behavior does not break login.

## Included
- Next.js + React + Recharts dashboard
- Server-side `/api/gas` proxy to Google Apps Script
- 12 Deeni Kaam dashboard
- Department dashboard
- Login + admin/user management
- Google Sheets backend
- Target 52% / 26%
- Month/year and geographic filters
- Ranking and charts
- Excel template
- TypeScript-safe unique list code (no `[...new Set()]`)

## Google Apps Script URL
Already configured in:
`app/api/gas/route.ts`

## Google Apps Script setup
1. Open Google Sheet → Extensions → Apps Script.
2. Paste `apps-script/Code.gs`.
3. Run `setupSheets()` once and authorize.
4. Deploy → New deployment → Web app.
5. Execute as: Me.
6. Who has access: Anyone.
7. Make sure the deployed URL is the same `/exec` URL configured in `app/api/gas/route.ts`.

## Default admin
Email: `admin@example.com`
Password: `ChangeMe123!`

Run `setupSheets()` once before login. Change the default password after setup.

## Vercel
Upload/replace the project files in GitHub. Then deploy the new commit. No `NEXT_PUBLIC_GAS_API` environment variable is required in this version.

## Important
Do not deploy only an old commit. Confirm the new commit contains:
- `app/api/gas/route.ts`
- `app/page.tsx` using `/api/gas`
- `tsconfig.json`

The server proxy is the permanent fix for the browser-side `Failed to fetch` error caused by direct Apps Script requests.


## Excel Upload
The dashboard now has **Upload Excel** and **Excel Format** buttons. Download the template, fill `Row Data (12 Deeni)` or `Row Data (Department)`, then upload it. The dashboard reads the selected sheet locally in the browser, so it does not need to wait for Google Sheets for uploaded data. Supported files: `.xlsx`, `.xls`, `.csv`.

For the 12 Deeni sheet use these columns: Month, Year, Chain, Region, State, Division, Distric, Pincode, Category, Deeni Activities, Report, Target 52%, Target 26%.
