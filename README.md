# PocketLAN

PocketLAN is a private local-network file explorer for your laptop. It lets phones, tablets, and other browsers on the same trusted Wi-Fi browse one configured shared folder, upload files to it, download files from it, preview common media/doc formats, and stream audio/video without using cloud services or an external database.

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

## Security Warning

This app is intended only for trusted private Wi-Fi networks. Do not expose it to the public internet, do not port-forward it from your router, and do not run it on untrusted networks. The backend intentionally listens on `0.0.0.0` so your local devices can reach it, which also means anyone on the same network may be able to try connecting. Set `APP_PIN` when you use it around other people.

## Project Structure

```text
D:\File Explorer\
  server/
    package.json
    src/
      index.js
      config.js
      routes/
        files.js
        upload.js
      utils/
        safePath.js
        fileMeta.js
  client/
    package.json
    src/
      App.jsx
      main.jsx
      components/
      pages/
      hooks/
      utils/
      styles/
  README.md
```

## Install

Open two terminals.

Backend:

```powershell
cd "D:\File Explorer\server"
npm install
```

Frontend:

```powershell
cd "D:\File Explorer\client"
npm install
```

## Run In Development

Terminal 1, backend:

```powershell
cd "D:\File Explorer\server"
npm run dev
```

The backend listens on `0.0.0.0:4242` and prints local/LAN URL examples.

Terminal 2, frontend:

```powershell
cd "D:\File Explorer\client"
npm run dev -- --host 0.0.0.0
```

Open on the laptop:

```text
http://localhost:5173
```

Open on a phone/tablet on the same Wi-Fi:

```text
http://LAPTOP_LOCAL_IP:5173
```

The React app automatically calls the backend at:

```text
http://LAPTOP_LOCAL_IP:4242/api
```

## Set The Shared Folder

If `SHARED_ROOT` is not set, the app creates and uses:

```text
D:\File Explorer\SharedFiles
```

To use another folder in PowerShell:

```powershell
cd "D:\File Explorer\server"
$env:SHARED_ROOT="D:\My Shared Files"
$env:APP_PIN="1234"
npm run dev
```

Only files inside `SHARED_ROOT` are exposed. Paths outside it are rejected.

### Share A Specific Folder

Change the backend `SHARED_ROOT` environment variable before starting the server. Example:

```powershell
cd "D:\File Explorer\server"
$env:SHARED_ROOT="D:\Movies"
npm run dev
```

With a PIN/password:

```powershell
cd "D:\File Explorer\server"
$env:SHARED_ROOT="D:\Movies"
$env:APP_PIN="1234"
npm run dev
```

For another drive or folder, replace `D:\Movies` with the folder you want to share:

```powershell
$env:SHARED_ROOT="E:\Photos\Family"
```

Set `SHARED_ROOT` in the same terminal where you run `npm run dev`; PowerShell environment variables set this way last only for that terminal session.

## Find Your Laptop IP Address On Windows

In PowerShell or Command Prompt:

```powershell
ipconfig
```

Look for your Wi-Fi adapter and copy the `IPv4 Address`, for example:

```text
192.168.1.23
```

Then use:

```text
http://192.168.1.23:5173
```

## Allow Local Ports Through Windows Firewall

If your phone/tablet cannot connect, Windows Defender Firewall may be blocking Node/Vite. You can allow the two local TCP ports from an Administrator PowerShell:

```powershell
netsh advfirewall firewall add rule name="PocketLAN Backend 4242" dir=in action=allow protocol=TCP localport=4242
netsh advfirewall firewall add rule name="PocketLAN Frontend 5173" dir=in action=allow protocol=TCP localport=5173
```

Use these only on trusted private networks. Remove the rules later if you no longer need local device access.

## Optional Production-Style Run

You can build the frontend and let Express serve it from the backend:

```powershell
cd "D:\File Explorer\client"
npm run build

cd "D:\File Explorer\server"
npm start
```

Then open:

```text
http://LAPTOP_LOCAL_IP:4242
```

## Useful Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4242` | Backend port |
| `FRONTEND_PORT` | `5173` | Displayed in backend startup help |
| `SHARED_ROOT` | `../SharedFiles` | Folder exposed by the file explorer |
| `APP_PIN` | empty | Optional PIN/password lock |
| `MAX_UPLOAD_SIZE_MB` | `4096` | Per-file upload size limit |
| `VITE_API_URL` | inferred | Optional frontend API override |

## Notes

- Symbolic links are not exposed, which avoids accidentally escaping the shared root.
- Deletes move files/folders to `.pocketlan-trash` inside the shared root.
- Unknown files remain downloadable even when preview is not available.
- Browser support for formats like `mkv`, `docx`, or `xlsx` depends on the browser; they are still downloadable.
