# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing/donation site for Sister For Sister Kenya, an NGO. It is a **plain static site** — no framework, no bundler, no package.json, no build step. The entire frontend is three files:

- `index.html` — all markup, all sections (hero, programs, funding-needs tables, donation form, merchandise, contact, footer)
- `styles.css` — all styling (CSS custom properties for the pink/black brand palette at the top)
- `main.js` — all client-side behavior, loaded via a plain `<script src="main.js">` tag (DOMContentLoaded-wrapped, no modules)

Deployment target is Vercel (see `Vercel.json` and the Vercel Analytics snippet at the bottom of `index.html`).

## Running / previewing locally

There is no dev server or build tool configured. To preview the static frontend, serve the directory root with any static file server, e.g.:

```
npx serve .
# or
python3 -m http.server 8000
```

To exercise the payment API routes locally you need the Vercel CLI (`vercel dev`), which reads env vars from `.env` — see the "Payment backend" section below for why the API files need to be moved first.

There are no linters, formatters, or automated tests in this repo.

## Payment architecture (important, currently broken as committed)

The donation form in `index.html` (`#donate`) and its logic in `main.js` call two backend routes by convention:

- `POST /api/mpesa-charge` — triggers a Safaricom Daraja STK push to the donor's phone
- `GET /api/mpesa-status?ref=...` — polled every 5s (up to 12 tries) to check if the STK push completed
- `POST /api/flutterwave` — verifies a Flutterwave card transaction after the hosted checkout modal callback

On Vercel, any file under `api/` is auto-deployed as a serverless function at the matching path, and `Vercel.json` sets `nodejs18.x` for `api/*.js` plus CORS headers for `/api/*`. **However, the actual handler files (`MpesaCharge.js`, `MpesaStatus.js`, `Flutterwave.js`) currently live at the repo root, not inside an `api/` directory, and their filenames don't match the routes the frontend calls.** For the payment flow to actually work when deployed, they need to become:

- `MpesaCharge.js` → `api/mpesa-charge.js`
- `MpesaStatus.js` → `api/mpesa-status.js`
- `Flutterwave.js` → `api/flutterwave.js`

Until that move happens, `fetch('/api/...')` calls in `main.js` will 404, which is why `main.js` has a **demo-mode fallback**: if the M-Pesa fetch throws, or if the Flutterwave public key is still the `FLWPUBK-xxxx...` placeholder, it fakes a successful donation after a short delay instead of erroring. Keep this fallback behavior in mind when touching the donate flow — a "successful" donation in the browser doesn't necessarily mean the backend was reached.

Required env vars (documented in `.env`, also needed in Vercel project settings): `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_TILL_NUMBER`, `MPESA_PASSKEY`, `MPESA_ENV` (`sandbox`/`production`), `FLW_SECRET_KEY`. The Flutterwave *public* key is hardcoded client-side in `main.js` as `FLW_PUBLIC_KEY` (public keys are safe to expose; it's currently still a placeholder).

**Note:** `.env` is currently committed to git and contains what appear to be real Daraja sandbox credentials (consumer key/secret, passkey). Treat this as sensitive and avoid re-committing it if it's ever removed/rotated — it should normally be gitignored.

## Other known rough edges

- The `<script defer src="/<unique-path>/script.js">` tag at the end of `index.html` (added in the "vercel analytics" commit) still has the literal placeholder path — it was never replaced with Vercel's actual injected analytics script path.
- `Flutterwave.js`'s comment block still says "Great for international / diaspora donors" but `main.js`'s own card form note tells users Flutterwave should be swapped for Paystack/PayPal before production — the Flutterwave integration is explicitly a placeholder/demo, not the intended final payment processor.
- Merchandise ordering (`#merchandise`) doesn't go through checkout at all — it builds a WhatsApp/mailto message with the selected color/size/quantity (see the `.merch-order-btn` handlers in `main.js`).
