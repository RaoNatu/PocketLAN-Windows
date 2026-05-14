import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { MAX_UPLOAD_SIZE_MB, TEMP_UPLOAD_DIR } from "../config.js";
import { buildFileMeta } from "../utils/fileMeta.js";
import { HttpError, resolveSafePath, validateEntryName } from "../utils/safePath.js";

const router = Router();

const upload = multer({
  dest: TEMP_UPLOAD_DIR,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 100
  }
});

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.array("files")(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function cleanupTempFiles(files = []) {
  await Promise.all(
    files.map((file) =>
      fs.unlink(file.path).catch(() => {
        // Temp cleanup should not hide the original upload result.
      })
    )
  );
}

router.post("/upload", async (req, res, next) => {
  try {
    await runUpload(req, res);

    const files = req.files || [];
    const overwrite = String(req.body.overwrite || "false") === "true";
    const destinationPath = req.body.path || "";
    const { absolutePath: destinationAbsolutePath } = await resolveSafePath(destinationPath, {
      mustExist: true
    });
    const destinationStats = await fs.stat(destinationAbsolutePath);

    if (!destinationStats.isDirectory()) {
      throw new HttpError(400, "Uploads must target a folder.");
    }

    if (!files.length) {
      throw new HttpError(400, "No files were uploaded.");
    }

    const uploaded = [];
    const conflicts = [];

    for (const file of files) {
      const originalName = validateEntryName(path.basename(file.originalname));
      const targetPath = path.join(destinationAbsolutePath, originalName);

      try {
        await fs.access(targetPath);

        if (!overwrite) {
          conflicts.push(originalName);
          await fs.unlink(file.path);
          continue;
        }

        const targetStats = await fs.stat(targetPath);
        if (targetStats.isDirectory()) {
          conflicts.push(originalName);
          await fs.unlink(file.path);
          continue;
        }

        await fs.unlink(targetPath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }

      await fs.rename(file.path, targetPath);
      uploaded.push(await buildFileMeta(targetPath));
    }

    res.status(conflicts.length ? 409 : 201).json({
      ok: conflicts.length === 0,
      uploaded,
      conflicts
    });
  } catch (error) {
    await cleanupTempFiles(req.files || []);
    next(error);
  }
});

export default router;

