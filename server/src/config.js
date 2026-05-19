import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SERVER_DIR = path.resolve(__dirname, "..");
export const PROJECT_ROOT = path.resolve(SERVER_DIR, "..");
export const PORT = Number(process.env.PORT || 4242);
export const HOST = process.env.HOST || "0.0.0.0";
export const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173);
export const APP_PIN = process.env.APP_PIN || "";

export const SHARED_ROOT = path.resolve(
  process.env.SHARED_ROOT || path.join(PROJECT_ROOT, "SharedFiles")
);

export const TRASH_DIR = path.join(SHARED_ROOT, ".pocketlan-trash");
export const TEMP_UPLOAD_DIR = path.join(SERVER_DIR, ".uploads");
export const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 4096);

for (const folder of [SHARED_ROOT, TRASH_DIR, TEMP_UPLOAD_DIR]) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

export const SHARED_ROOT_REAL = fs.realpathSync(SHARED_ROOT);

export function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net.address);
}
