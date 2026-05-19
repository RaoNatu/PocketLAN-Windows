import fs from "fs/promises";
import path from "path";
import mime from "mime-types";
import { SHARED_ROOT } from "../config.js";
import { getRelativeFromAbsolute } from "./safePath.js";

const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);
const videoExtensions = new Set(["mp4", "webm", "mkv", "mov", "m4v"]);
const audioExtensions = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"]);
const subtitleExtensions = new Set(["vtt", "srt"]);
const textExtensions = new Set(["txt", "md", "log", "rtf"]);
const codeExtensions = new Set([
  "json",
  "js",
  "jsx",
  "ts",
  "tsx",
  "html",
  "css",
  "scss",
  "py",
  "java",
  "cpp",
  "c",
  "cs",
  "go",
  "rs",
  "php",
  "rb",
  "sql",
  "xml",
  "yaml",
  "yml",
  "env",
  "sh",
  "bat",
  "ps1"
]);
const archiveExtensions = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz"]);
const documentExtensions = new Set(["doc", "docx", "odt", "pages"]);
const spreadsheetExtensions = new Set(["xls", "xlsx", "csv", "ods"]);
const presentationExtensions = new Set(["ppt", "pptx", "key", "odp"]);

export function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function detectCategory(extension = "", isDirectory = false) {
  const ext = extension.toLowerCase();

  if (isDirectory) return "folder";
  if (imageExtensions.has(ext)) return "image";
  if (videoExtensions.has(ext)) return "video";
  if (audioExtensions.has(ext)) return "audio";
  if (subtitleExtensions.has(ext)) return "subtitle";
  if (ext === "pdf") return "pdf";
  if (textExtensions.has(ext)) return "text";
  if (codeExtensions.has(ext)) return "code";
  if (archiveExtensions.has(ext)) return "archive";
  if (documentExtensions.has(ext)) return "document";
  if (spreadsheetExtensions.has(ext)) return "spreadsheet";
  if (presentationExtensions.has(ext)) return "presentation";

  return "unknown";
}

export function canPreviewCategory(category) {
  return ["image", "video", "audio", "pdf", "text", "code", "subtitle"].includes(category);
}

export async function buildFileMeta(absolutePath) {
  const stats = await fs.lstat(absolutePath);

  if (stats.isSymbolicLink()) {
    return null;
  }

  const name = path.basename(absolutePath);
  const isDirectory = stats.isDirectory();
  const extension = isDirectory ? "" : path.extname(name).replace(".", "").toLowerCase();
  const category = detectCategory(extension, isDirectory);
  const relativePath = getRelativeFromAbsolute(absolutePath);
  const mimeType = isDirectory ? "inode/directory" : mime.lookup(name) || "application/octet-stream";

  return {
    name,
    path: relativePath,
    type: isDirectory ? "folder" : "file",
    extension,
    mime: mimeType,
    size: isDirectory ? 0 : stats.size,
    sizeFormatted: isDirectory ? "Folder" : formatBytes(stats.size),
    createdAt: stats.birthtime.toISOString(),
    modifiedAt: stats.mtime.toISOString(),
    category,
    canPreview: canPreviewCategory(category)
  };
}

export function getParentPath(relativePath = "") {
  const parent = path.dirname(relativePath.replace(/\//g, path.sep));
  return parent === "." ? "" : parent.split(path.sep).join("/");
}

export function getNameFromPath(relativePath = "") {
  if (!relativePath) return path.basename(SHARED_ROOT);
  return path.basename(relativePath.replace(/\//g, path.sep));
}
