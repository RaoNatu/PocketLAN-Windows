import fs from "fs/promises";
import path from "path";
import { SHARED_ROOT, SHARED_ROOT_REAL, TRASH_DIR } from "../config.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function toUrlPath(relativePath = "") {
  return relativePath.split(path.sep).filter(Boolean).join("/");
}

export function normalizeRelativePath(input = "") {
  const raw = String(input || "").replace(/\0/g, "").trim();

  if (!raw || raw === "." || raw === "/") {
    return "";
  }

  const withForwardSlashes = raw.replace(/\\/g, "/");

  if (/^[a-zA-Z]:/.test(withForwardSlashes) || withForwardSlashes.startsWith("//")) {
    throw new HttpError(400, "Absolute paths are not allowed.");
  }

  const withoutLeadingSlash = withForwardSlashes.replace(/^\/+/, "");
  const parts = withoutLeadingSlash.split("/").filter(Boolean);

  if (parts.some((part) => part === ".." || part === ".")) {
    throw new HttpError(400, "Path traversal is not allowed.");
  }

  return parts.join(path.sep);
}

export function ensureInsideRoot(targetPath, rootPath = SHARED_ROOT) {
  const relative = path.relative(rootPath, targetPath);

  if (relative && (relative.startsWith("..") || path.isAbsolute(relative))) {
    throw new HttpError(403, "Requested path is outside the shared root.");
  }
}

export function getRelativeFromAbsolute(absolutePath) {
  ensureInsideRoot(absolutePath);
  return toUrlPath(path.relative(SHARED_ROOT, absolutePath));
}

export async function resolveSafePath(input = "", options = {}) {
  const { mustExist = false, allowRoot = true } = options;
  const normalized = normalizeRelativePath(input);

  if (!allowRoot && !normalized) {
    throw new HttpError(400, "The shared root cannot be used for this action.");
  }

  const absolutePath = path.resolve(SHARED_ROOT, normalized);
  ensureInsideRoot(absolutePath);

  if (mustExist) {
    let realPath;
    try {
      realPath = await fs.realpath(absolutePath);
    } catch {
      throw new HttpError(404, "Path was not found.");
    }

    ensureInsideRoot(realPath, SHARED_ROOT_REAL);

    return {
      absolutePath,
      realPath,
      relativePath: getRelativeFromAbsolute(absolutePath)
    };
  }

  const parent = path.dirname(absolutePath);
  let parentRealPath;
  try {
    parentRealPath = await fs.realpath(parent);
  } catch {
    throw new HttpError(404, "Parent folder was not found.");
  }

  ensureInsideRoot(parentRealPath, SHARED_ROOT_REAL);

  return {
    absolutePath,
    realPath: absolutePath,
    relativePath: getRelativeFromAbsolute(absolutePath)
  };
}

export function validateEntryName(name) {
  const value = String(name || "").replace(/\0/g, "").trim();

  if (!value) {
    throw new HttpError(400, "A name is required.");
  }

  if (value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new HttpError(400, "Names cannot contain path separators or traversal markers.");
  }

  if (/[<>:"|?*]/.test(value)) {
    throw new HttpError(400, "Names cannot contain Windows-reserved characters.");
  }

  return value;
}

export function isTrashPath(relativePath = "") {
  const trashRelative = getRelativeFromAbsolute(TRASH_DIR);
  return relativePath === trashRelative || relativePath.startsWith(`${trashRelative}/`);
}

export function buildBreadcrumbs(relativePath = "") {
  const parts = toUrlPath(relativePath).split("/").filter(Boolean);
  const breadcrumbs = [{ name: "Home", path: "" }];
  let cursor = "";

  for (const part of parts) {
    cursor = cursor ? `${cursor}/${part}` : part;
    breadcrumbs.push({ name: part, path: cursor });
  }

  return breadcrumbs;
}

