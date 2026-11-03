# 🛡️ CyberVault — Student File Sharing

A one-page, hacker-themed file vault for students. Upload a file with your name and it appears instantly in the live vault feed for everyone. Every file self-destructs 48 hours after upload.

## Features

- **Hacker UI**: pitch black, neon green/cyan, monospace font, scanlines and a glitch title. Built with React (Vite), Tailwind CSS v4 and Lucide icons.
- **Upload terminal**: student name plus a drag-and-drop file picker, an upload progress bar and terminal-style status lines (`[ERROR: STORAGE_QUOTA_EXCEEDED]`).
- **Live vault feed**: Server-Sent Events push every change to all open browsers with no reload. Each file shows a countdown to its deletion.
- **Storage rules**: 50MB per file, 50MB total across all active files, and auto-delete after 48h.
- **Security**: API key, CORS allowlist, rate limits, helmet headers, an extension allowlist, magic-byte checks and name sanitisation.
- **Project tracking log**: a collapsible terminal that shows `server/data/changelog.json`.

## Quick start

```bash
npm run install:all     # installs root, server and client deps
npm run dev             # API on :4000, client on http://localhost:5173
```

Production (one process serves the API and the built client):

```bash
cp server/.env.example server/.env    # set API_KEY, CORS_ORIGINS
cp client/.env.example client/.env    # set VITE_API_KEY to the same key
npm run build && npm start            # http://localhost:4000
```

Without `.env` files both sides fall back to the dev key `dev-cybervault-key`.

## Project structure

```text
├── client/                 React + Vite + Tailwind frontend
│   └── src/
│       ├── App.jsx         Layout + SSE subscription
│       ├── api.js          Axios client, stream, helpers
│       └── components/     Header, UploadTerminal, VaultFeed, ChangeLog
├── server/                 Express backend
│   ├── src/
│   │   ├── server.js       Routes, upload pipeline, SSE, cleanup timer
│   │   ├── store.js        JSON metadata store, lock, expiry purge
│   │   ├── security.js     API key, sanitisers, file signature checks
│   │   └── config.js       Limits and paths
│   ├── scripts/log.js      CLI to append to the project tracking log
│   ├── data/changelog.json Project tracking log
│   └── uploads/            Stored files (git-ignored)
└── docs/                   Detailed documentation
```

## API

All routes need the `x-api-key` header. `/api/stream` also accepts `?key=`.

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | `/api/files` | Active files, used bytes and quota |
| GET | `/api/stream` | SSE stream of the same snapshot on every change |
| POST | `/api/upload` | multipart: `studentName`, `file` |
| GET | `/api/files/:id/download` | Download a file as an attachment |
| GET | `/api/changelog` | Project tracking log, newest first |

## Docs

See [docs/](docs/) for features, setup, security, file management and the tracking system.
