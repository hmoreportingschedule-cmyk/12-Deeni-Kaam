# 12 Deeni Kaam Report Dashboard — Professional Vercel Starter

## Features
- Attractive login page based on the supplied reference image
- Secure server-side login session using HTTP-only cookie
- Dashboard date picker: Month + Year
- Live DD-MM-YYYY and HH:MM:SS
- Report By Table / Report By Graph
- Connected dropdowns: Deeni Activities → Fields → Region → State → Division → District
- 26% / 52% target selector
- India → Region → State → Division → District reporting hierarchy
- KPI cards: Total Report, Target, Achievement, Target Gap, Performance Status
- CSV export
- Google Sheets CSV export URL or local CSV source
- Server-side data loading so the browser does not directly download the full Google Sheet
- 5-minute server cache per Vercel function instance

## 1. Install
npm install

## 2. Configure
Copy `.env.example` to `.env.local` and set:
DASHBOARD_USERNAME
DASHBOARD_PASSWORD
DASHBOARD_SESSION_SECRET
DATA_SOURCE_URL

For Google Sheets, use:
https://docs.google.com/spreadsheets/d/YOUR_ID/export?format=csv

You can also provide multiple comma-separated source URLs.

For local CSV:
DATA_SOURCE_URL=local

Then replace `public/data/report.csv` with your real CSV.

## 3. Run
npm run dev

## 4. Vercel
Add the same environment variables in Project Settings → Environment Variables and redeploy. Vercel environment variables are configured per environment and changes require a new deployment to take effect.

## Expected data columns
Month, Year, Category, Deeni Activities, Fields, Multiple Field Name, Multiple Field Value, Chain, Department, Region, State, Division, District, Report Value, Target 26% (Value), Target 52% (Value)

The parser also accepts common alternatives such as `Fileds`, `Deeni Kaam`, `Report`, `Value`, `Target 26%`, and `Target 52%`.

## Login
Default development credentials:
Username: admin
Password: change-me

Change these before production.


### Fields & Category Master
The dashboard now includes the uploaded `Fileds With Category(1).xlsx` hierarchy as `public/data/fields-category.json`, used for Category → Deeni Activities → Fields filters.
