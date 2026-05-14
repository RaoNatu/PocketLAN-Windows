import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";
import mime from "mime-types";
import { Router } from "express";
import { SHARED_ROOT, TRASH_DIR } from "../config.js";
import {
  buildBreadcrumbs,
  getRelativeFromAbsolute,
  HttpError,
  isTrashPath,
  resolveSafePath,
  toUrlPath,
  validateEntryName
} from "../utils/safePath.js";
import { buildFileMeta, getNameFromPath, getParentPath } from "../utils/fileMeta.js";

const router = Router();

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

function inlineDisposition(filename) {
  return `inline; filename="${String(filename).replace(/"/g, "'")}"`;
}

function createDownloadUrl(relativePath) {
  return `/api/download?path=${encodeURIComponent(relativePath)}`;
}

function createMediaUrl(relativePath) {
  return `/api/media?path=${encodeURIComponent(relativePath)}`;
}

function createPreviewUrl(relativePath) {
  return `/api/preview?path=${encodeURIComponent(relativePath)}`;
}

async function assertFile(absolutePath) {
  const stats = await fsp.stat(absolutePath);
  if (!stats.isFile()) {
    throw new HttpError(400, "This action requires a file.");
  }
  return stats;
}

async function getDirectoryItems(absolutePath) {
  const entries = await fsp.readdir(absolutePath, { withFileTypes: true });
  const items = await Promise.all(
    entries
      .filter((entry) => entry.name !== ".pocketlan-trash")
      .map((entry) => buildFileMeta(path.join(absolutePath, entry.name)))
  );

  return items.filter(Boolean);
}

async function getStorageSummary() {
  let size = 0;
  let files = 0;
  let folders = 0;
  let truncated = false;
  const maxEntries = 7500;

  async function walk(folder) {
    if (files + folders > maxEntries) {
      truncated = true;
      return;
    }

    const entries = await fsp.readdir(folder, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === ".pocketlan-trash" || entry.isSymbolicLink()) continue;

      const absolutePath = path.join(folder, entry.name);

      if (entry.isDirectory()) {
        folders += 1;
        await walk(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        const stats = await fsp.stat(absolutePath);
        files += 1;
        size += stats.size;
      }
    }
  }

  await walk(SHARED_ROOT);

  return { files, folders, size, truncated };
}

function streamFileWithRange(req, res, absolutePath, stats, contentType) {
  const range = req.headers.range;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);

  if (!range) {
    res.setHeader("Content-Length", stats.size);
    fs.createReadStream(absolutePath).pipe(res);
    return;
  }

  const [startText, endText] = range.replace(/bytes=/, "").split("-");
  const start = Number.parseInt(startText, 10);
  const end = endText ? Number.parseInt(endText, 10) : stats.size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stats.size) {
    res.status(416).setHeader("Content-Range", `bytes */${stats.size}`).end();
    return;
  }

  const chunkSize = end - start + 1;
  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`);
  res.setHeader("Content-Length", chunkSize);
  fs.createReadStream(absolutePath, { start, end }).pipe(res);
}

async function addToArchive(archive, absolutePath, zipBaseName) {
  const stats = await fsp.lstat(absolutePath);

  if (stats.isSymbolicLink()) return;

  if (stats.isDirectory()) {
    const entries = await fsp.readdir(absolutePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === ".pocketlan-trash") continue;
      await addToArchive(archive, path.join(absolutePath, entry.name), `${zipBaseName}/${entry.name}`);
    }

    return;
  }

  if (stats.isFile()) {
    archive.file(absolutePath, { name: zipBaseName });
  }
}

router.get(
  "/files",
  asyncHandler(async (req, res) => {
    const { absolutePath, relativePath } = await resolveSafePath(req.query.path, { mustExist: true });
    const stats = await fsp.stat(absolutePath);

    if (!stats.isDirectory()) {
      throw new HttpError(400, "Path is not a folder.");
    }

    const items = await getDirectoryItems(absolutePath);

    res.json({
      path: relativePath,
      name: getNameFromPath(relativePath),
      parentPath: relativePath ? getParentPath(relativePath) : null,
      breadcrumbs: buildBreadcrumbs(relativePath),
      items
    });
  })
);

router.get(
  "/storage",
  asyncHandler(async (_req, res) => {
    res.json(await getStorageSummary());
  })
);

router.get(
  "/download",
  asyncHandler(async (req, res) => {
    const { absolutePath } = await resolveSafePath(req.query.path, { mustExist: true, allowRoot: false });
    const stats = await assertFile(absolutePath);
    res.setHeader("Content-Length", stats.size);
    res.download(absolutePath, path.basename(absolutePath));
  })
);

router.post(
  "/bulk-download",
  asyncHandler(async (req, res) => {
    const requestedPaths = Array.isArray(req.body.paths) ? req.body.paths : [];

    if (!requestedPaths.length) {
      throw new HttpError(400, "At least one file or folder path is required.");
    }

    res.attachment("pocketlan-selection.zip");
    const archive = archiver("zip", { zlib: { level: 7 } });

    archive.on("error", (error) => {
      throw error;
    });

    archive.pipe(res);

    for (const requestedPath of requestedPaths) {
      const { absolutePath, relativePath } = await resolveSafePath(requestedPath, {
        mustExist: true,
        allowRoot: false
      });

      if (isTrashPath(relativePath)) continue;

      await addToArchive(archive, absolutePath, getNameFromPath(relativePath));
    }

    await archive.finalize();
  })
);

router.get(
  "/media",
  asyncHandler(async (req, res) => {
    const { absolutePath } = await resolveSafePath(req.query.path, { mustExist: true, allowRoot: false });
    const stats = await assertFile(absolutePath);
    const contentType = mime.lookup(absolutePath) || "application/octet-stream";
    streamFileWithRange(req, res, absolutePath, stats, contentType);
  })
);

router.get(
  "/preview",
  asyncHandler(async (req, res) => {
    const { absolutePath } = await resolveSafePath(req.query.path, { mustExist: true, allowRoot: false });
    const stats = await assertFile(absolutePath);
    const contentType = mime.lookup(absolutePath) || "application/octet-stream";

    if (contentType.startsWith("audio/") || contentType.startsWith("video/")) {
      streamFileWithRange(req, res, absolutePath, stats, contentType);
      return;
    }

    res.setHeader("Content-Type", contentType.startsWith("text/") ? `${contentType}; charset=utf-8` : contentType);
    res.setHeader("Content-Disposition", inlineDisposition(path.basename(absolutePath)));
    res.setHeader("Content-Length", stats.size);
    fs.createReadStream(absolutePath).pipe(res);
  })
);

router.post(
  "/folder",
  asyncHandler(async (req, res) => {
    const parentPath = req.body.path || "";
    const folderName = validateEntryName(req.body.name);
    const { absolutePath: parentAbsolutePath } = await resolveSafePath(parentPath, { mustExist: true });
    const stats = await fsp.stat(parentAbsolutePath);

    if (!stats.isDirectory()) {
      throw new HttpError(400, "Parent path is not a folder.");
    }

    const targetPath = path.join(parentAbsolutePath, folderName);
    const targetRelativePath = toUrlPath(path.relative(SHARED_ROOT, targetPath));

    if (isTrashPath(targetRelativePath)) {
      throw new HttpError(400, "This folder name is reserved.");
    }

    try {
      await fsp.mkdir(targetPath);
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new HttpError(409, "A file or folder with that name already exists.");
      }
      throw error;
    }

    res.status(201).json(await buildFileMeta(targetPath));
  })
);

router.patch(
  "/rename",
  asyncHandler(async (req, res) => {
    const newName = validateEntryName(req.body.newName);
    const { absolutePath, relativePath } = await resolveSafePath(req.body.path, {
      mustExist: true,
      allowRoot: false
    });

    if (isTrashPath(relativePath)) {
      throw new HttpError(400, "Trash items cannot be renamed through this API.");
    }

    const targetPath = path.join(path.dirname(absolutePath), newName);
    const targetRelativePath = getRelativeFromAbsolute(targetPath);

    if (isTrashPath(targetRelativePath)) {
      throw new HttpError(400, "This name is reserved.");
    }

    try {
      await fsp.access(targetPath);
      throw new HttpError(409, "A file or folder with that name already exists.");
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.code !== "ENOENT") throw error;
    }

    await fsp.rename(absolutePath, targetPath);
    res.json(await buildFileMeta(targetPath));
  })
);

router.delete(
  "/delete",
  asyncHandler(async (req, res) => {
    const { absolutePath, relativePath } = await resolveSafePath(req.body.path, {
      mustExist: true,
      allowRoot: false
    });

    if (isTrashPath(relativePath)) {
      throw new HttpError(400, "Trash items cannot be deleted through this API.");
    }

    await fsp.mkdir(TRASH_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const targetPath = path.join(TRASH_DIR, `${stamp}-${path.basename(absolutePath)}`);
    await fsp.rename(absolutePath, targetPath);

    res.json({ ok: true, movedToTrash: true });
  })
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit || 250), 1000);
    const results = [];

    if (!query) {
      res.json({ query, results });
      return;
    }

    async function walk(folder) {
      if (results.length >= limit) return;

      const entries = await fsp.readdir(folder, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= limit) break;
        if (entry.name === ".pocketlan-trash" || entry.isSymbolicLink()) continue;

        const absolutePath = path.join(folder, entry.name);

        if (entry.name.toLowerCase().includes(query)) {
          const meta = await buildFileMeta(absolutePath);
          if (meta) results.push(meta);
        }

        if (entry.isDirectory()) {
          await walk(absolutePath);
        }
      }
    }

    await walk(SHARED_ROOT);
    res.json({ query, results });
  })
);

router.get(
  "/info",
  asyncHandler(async (req, res) => {
    const { absolutePath, relativePath } = await resolveSafePath(req.query.path, {
      mustExist: true,
      allowRoot: false
    });
    const meta = await buildFileMeta(absolutePath);

    if (!meta) {
      throw new HttpError(400, "Symbolic links are not exposed.");
    }

    res.json({
      ...meta,
      fullRelativePath: relativePath,
      downloadUrl: meta.type === "file" ? createDownloadUrl(relativePath) : null,
      mediaUrl: meta.type === "file" ? createMediaUrl(relativePath) : null,
      previewUrl: meta.canPreview ? createPreviewUrl(relativePath) : null
    });
  })
);

export default router;
