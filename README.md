# Reporting & Analise Dashboard — Vercel + Google Sheets

## Build fix included
- The TypeScript `Set` iteration build error is permanently addressed by using `Array.from(new Set(...))` and an explicit `tsconfig.json` with ES2017 + `downlevelIteration`. Vercel will therefore not depend on an auto-generated ES5 TypeScript target.

## What is included
- Excel formula-ready template: `Reporting_Analise_Dashboard_Template.xlsx`
- Next.js dashboard for Vercel
- Google Apps Script API for Google Sheets
- Login with admin/user roles
- Admin user creation/update
- 12 Deeni Kaam and Department dashboard tabs
- Filters: Chain, Level, Region, State, Division, District
- Month/Year, Quarter, Target 52%/26%
- Month-to-month comparison
- Average-to-month view
- Quarter comparison structure
- Activity, Region, State, Division and District ranking
- Graph + KPI cards
- District as base reporting grain

## Google Sheet setup
1. Create a Google Sheet.
2. Open Extensions → Apps Script.
3. Paste `apps-script/Code.gs`.
4. Run `setupSheets()` once and authorize it.
5. Deploy → New deployment → Web app.
6. Execute as: Me. Who has access: Anyone.
7. Copy the `/exec` URL.
8. Create `.env.local` from `.env.example` and set:
   NEXT_PUBLIC_GAS_API=YOUR_EXEC_URL

The script creates:
- `Users`
- `Row Data (12 Deeni)`
- `Row Data (Department)`
- `Geo Master`
- `Activity Master`
- `Department Master`

## Default login
After setup, `setupSheets()` creates an admin account:
- Email: admin@example.com
- Password: ChangeMe123!

Change this password immediately by creating/updating the admin user from the app.

## Vercel
```bash
npm install
npm run build
```
Push to GitHub, import the repository into Vercel, and add:
`NEXT_PUBLIC_GAS_API` = your Apps Script `/exec` URL.

## Data model
For 12 Deeni:
Month | Year | Chain | Region | State | Division | Distric | Pincode | Category | Activity | Report | Target52 | Target26

For Department:
Month | Year | Department | Frequency | Region | State | Division | Distric | Pincode | Activity/Work | Report | Target | Achievement

## Important
The sample geography/activity values are placeholders. Replace the master sheets with your complete India Region → State → Division → District → Pincode hierarchy. The web dashboard aggregates from district rows, so entering one row per district/activity/month is the recommended grain.

For production security, restrict the Apps Script deployment/access strategy and rotate the default admin password before use.
