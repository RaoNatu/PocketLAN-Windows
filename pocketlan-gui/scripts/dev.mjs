import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const devUrl = "http://127.0.0.1:5174";

function bin(name) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  return path.join(root, "node_modules", ".bin", `${name}${suffix}`);
}

function quoteWinArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function spawnLocalBin(command, args, options) {
  if (process.platform !== "win32") {
    return spawn(command, args, options);
  }

  const commandLine = [quoteWinArg(command), ...args.map(quoteWinArg)].join(" ");
  return spawn("cmd.exe", ["/d", "/s", "/c", `"${commandLine}"`], {
    ...options,
    shell: false,
    windowsVerbatimArguments: true,
    windowsHide: true
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVite(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await wait(250);
    }
  }

  throw new Error(`Timed out waiting for Vite at ${url}`);
}

const viteBin = bin("vite");
const electronBin = bin("electron");

if (!fs.existsSync(viteBin) || !fs.existsSync(electronBin)) {
  console.error("Dependencies are missing. Run npm install first.");
  process.exit(1);
}

const vite = spawnLocalBin(viteBin, ["--host", "127.0.0.1", "--port", "5174"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
  windowsHide: true
});

let electronProcess;

function killChildProcess(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  child.kill();
}

function shutdown() {
  killChildProcess(electronProcess);
  killChildProcess(vite);
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

try {
  await waitForVite(devUrl);
  electronProcess = spawnLocalBin(electronBin, ["."], {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devUrl
    }
  });

  electronProcess.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });
} catch (error) {
  console.error(error.message);
  shutdown();
  process.exit(1);
}
