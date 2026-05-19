# PocketLAN

PocketLAN is a private local-network file explorer for your laptop. It lets phones, tablets, and other browsers on the same trusted Wi-Fi browse one selected folder, upload files, download files, preview common media and document formats, and stream audio/video without a cloud service or external database.

## Clean Project Layout

```text
PocketLAN/
  client/          React web app
  server/          Express file server and API
  pocketlan-gui/   Windows Electron launcher
  scripts/         Root development helpers
  package.json     Root commands
  README.md
  .gitignore
```

Generated folders such as `node_modules`, `dist`, `release`, `SharedFiles`, `server/.uploads`, and `graphify-out` are intentionally ignored. They can be recreated by installing dependencies, building, or running the app.

## Features

- Browse folders inside one configured shared root.
- Upload multiple files with progress and overwrite confirmation.
- Download single files or zip selected files/folders.
- Stream audio/video with HTTP range support for seeking.
- Preview images, PDFs, audio, video, text, and code files.
- Search recursively by file name.
- Sort, filter, multi-select, and switch between grid/list/compact/gallery/detail layouts.
- Optional PIN/password gate using `APP_PIN`.
- Safe path handling to prevent path traversal outside the shared root.
- Delete moves items into `.pocketlan-trash` inside the shared root.
- Optional Windows GUI for choosing a folder, starting/stopping the server, copying LAN links, and viewing logs.

## Security Warning

PocketLAN is intended only for trusted private Wi-Fi networks. Do not expose it to the public internet, do not port-forward it from your router, and do not run it on untrusted networks. The backend listens on `0.0.0.0` by default so local devices can reach it, which also means other people on the same network may be able to connect. Set `APP_PIN` when you use it around other people.

## Install

From the project root:

```powershell
cd "D:\File Explorer\PocketLAN"
npm run install:all
```

Install one part at a time if needed:

```powershell
npm install --prefix server
npm install --prefix client
npm install --prefix pocketlan-gui
```

## Run In Development

Start the backend and web client together:

```powershell
cd "D:\File Explorer\PocketLAN"
npm run dev
```

Open the web app on the laptop:

```text
http://localhost:5173
```

Open it from another device on the same Wi-Fi:

```text
http://LAPTOP_LOCAL_IP:5173
```

Run the Windows GUI:

```powershell
cd "D:\File Explorer\PocketLAN"
npm run dev:gui
```

Run individual parts:

```powershell
npm run dev:server
npm run dev:client
```

## Shared Folder

If `SHARED_ROOT` is not set, PocketLAN creates and uses:

```text
D:\File Explorer\PocketLAN\SharedFiles
```

Use another folder for the web/server workflow:

```powershell
cd "D:\File Explorer\PocketLAN"
$env:SHARED_ROOT="D:\Movies"
$env:APP_PIN="1234"
npm run dev
```

Only files inside `SHARED_ROOT` are exposed. Paths outside it are rejected.

## Ports And API URL

Useful environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4242` | Backend port |
| `HOST` | `0.0.0.0` | Backend bind address |
| `FRONTEND_PORT` | `5173` | Frontend Vite port used by the root dev script |
| `FRONTEND_HOST` | `0.0.0.0` | Frontend Vite bind address |
| `SHARED_ROOT` | `./SharedFiles` | Folder exposed by the file explorer |
| `APP_PIN` | empty | Optional PIN/password lock |
| `MAX_UPLOAD_SIZE_MB` | `4096` | Per-file upload size limit |
| `VITE_API_URL` | inferred | Optional frontend API override |
| `VITE_API_PORT` | `4242` | API port used by the frontend in development |

Example:

```powershell
cd "D:\File Explorer\PocketLAN"
$env:PORT="5050"
$env:FRONTEND_PORT="5173"
npm run dev
```

## Build

Build the web client:

```powershell
cd "D:\File Explorer\PocketLAN"
npm run build
```

Build the Windows installer:

```powershell
cd "D:\File Explorer\PocketLAN"
npm run build:exe
```

The installer is written to:

```text
D:\File Explorer\PocketLAN\pocketlan-gui\release\PocketLAN Setup 1.0.0.exe
```

## Firewall

If your phone or tablet cannot connect, Windows Defender Firewall may be blocking Node/Vite. From an Administrator PowerShell, allow the local ports you use:

```powershell
netsh advfirewall firewall add rule name="PocketLAN Backend 4242" dir=in action=allow protocol=TCP localport=4242
netsh advfirewall firewall add rule name="PocketLAN Frontend 5173" dir=in action=allow protocol=TCP localport=5173
```

Use these only on trusted private networks.

## Repository

```powershell
git clone https://github.com/RaoNatu/PocketLAN.git
cd PocketLAN
npm run install:all
npm run dev
```
