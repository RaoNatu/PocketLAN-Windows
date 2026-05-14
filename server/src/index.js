import fs from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "url";
import filesRouter from "./routes/files.js";
import uploadRouter from "./routes/upload.js";
import {
  APP_PIN,
  FRONTEND_PORT,
  getLanAddresses,
  PORT,
  PROJECT_ROOT,
  SHARED_ROOT
} from "./config.js";
import { HttpError } from "./utils/safePath.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: true,
    credentials: false
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Natu Local Drive",
    sharedRoot: SHARED_ROOT,
    pinEnabled: Boolean(APP_PIN)
  });
});

app.get("/api/auth/status", (_req, res) => {
  res.json({ pinEnabled: Boolean(APP_PIN) });
});

app.post("/api/auth/verify", (req, res) => {
  if (!APP_PIN) {
    res.json({ ok: true });
    return;
  }

  if (String(req.body.pin || "") === APP_PIN) {
    res.json({ ok: true });
    return;
  }

  res.status(401).json({ ok: false, error: "Invalid PIN." });
});

app.use("/api", (req, res, next) => {
  if (!APP_PIN) {
    next();
    return;
  }

  if (String(req.get("x-natu-pin") || req.query.pin || "") === APP_PIN) {
    next();
    return;
  }

  res.status(401).json({ error: "PIN required." });
});

app.use("/api", filesRouter);
app.use("/api", uploadRouter);

const clientDist = path.join(PROJECT_ROOT, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
});

app.use((error, _req, res, _next) => {
  const status = error.status || (error.code === "LIMIT_FILE_SIZE" ? 413 : 500);
  const message =
    error.code === "LIMIT_FILE_SIZE"
      ? "Uploaded file exceeds the configured size limit."
      : error.message || "Unexpected server error.";

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ error: message });
});

app.listen(PORT, "0.0.0.0", () => {
  const lanAddresses = getLanAddresses();
  const firstLan = lanAddresses[0] || "YOUR_LAPTOP_LOCAL_IP";

  console.log("");
  console.log("Natu Local Drive backend is running");
  console.log("-----------------------------------");
  console.log(`Shared root: ${SHARED_ROOT}`);
  console.log(`Local laptop API: http://localhost:${PORT}`);
  console.log(`LAN API example: http://${firstLan}:${PORT}`);
  console.log("");
  console.log("Frontend development server:");
  console.log(`  Local laptop URL: http://localhost:${FRONTEND_PORT}`);
  console.log(`  LAN URL example: http://${firstLan}:${FRONTEND_PORT}`);
  console.log("");
  console.log("Keep this on a trusted private Wi-Fi network only.");
});
