import axios from "axios";

const explicitApiUrl = import.meta.env.VITE_API_URL;
const inferredApiPort = import.meta.env.VITE_API_PORT || "4242";
const sameOriginApi = window.location.port === inferredApiPort;
const inferredApiUrl = import.meta.env.DEV && !sameOriginApi
  ? `${window.location.protocol}//${window.location.hostname}:${inferredApiPort}/api`
  : "/api";

export const API_ROOT = (explicitApiUrl || inferredApiUrl).replace(/\/$/, "");
const PIN_STORAGE_KEY = "pocketlan-pin";

export function getStoredPin() {
  return localStorage.getItem(PIN_STORAGE_KEY) || "";
}

export function setStoredPin(pin) {
  if (pin) localStorage.setItem(PIN_STORAGE_KEY, pin);
  else localStorage.removeItem(PIN_STORAGE_KEY);
}

export const api = axios.create({
  baseURL: API_ROOT,
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const pin = getStoredPin();

  if (pin) {
    config.headers["x-pocketlan-pin"] = pin;
  }

  return config;
});

export function fileUrl(route, filePath = "") {
  const params = new URLSearchParams();
  params.set("path", filePath || "");

  const pin = getStoredPin();
  if (pin) params.set("pin", pin);

  return `${API_ROOT}${route}?${params.toString()}`;
}

export async function getAuthStatus() {
  const { data } = await api.get("/auth/status");
  return data;
}

export async function verifyPin(pin) {
  const { data } = await api.post("/auth/verify", { pin });
  return data;
}

export async function listFiles(path = "") {
  const { data } = await api.get("/files", { params: { path } });
  return data;
}

export async function getStorage() {
  const { data } = await api.get("/storage");
  return data;
}

export async function searchFiles(query) {
  const { data } = await api.get("/search", { params: { q: query } });
  return data;
}

export async function getInfo(path) {
  const { data } = await api.get("/info", { params: { path } });
  return data;
}

export async function listSubtitles(path) {
  const { data } = await api.get("/subtitles", { params: { path } });
  return data;
}

export async function createFolder(path, name) {
  const { data } = await api.post("/folder", { path, name });
  return data;
}

export async function renameEntry(path, newName) {
  const { data } = await api.patch("/rename", { path, newName });
  return data;
}

export async function deleteEntry(path) {
  const { data } = await api.delete("/delete", { data: { path } });
  return data;
}

export async function uploadFiles({ files, path, overwrite, onProgress }) {
  const formData = new FormData();
  formData.set("path", path || "");
  formData.set("overwrite", String(Boolean(overwrite)));

  for (const file of files) {
    formData.append("files", file);
  }

  const { data } = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 0,
    onUploadProgress: onProgress
  });

  return data;
}

export async function bulkDownload(paths) {
  const { data } = await api.post(
    "/bulk-download",
    { paths },
    {
      responseType: "blob",
      timeout: 0
    }
  );

  return data;
}
