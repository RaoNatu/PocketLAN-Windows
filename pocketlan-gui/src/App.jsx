import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ClipboardCopy,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FolderOpen,
  Link2,
  Loader2,
  Lock,
  Play,
  QrCode,
  RefreshCcw,
  RotateCcw,
  Settings,
  Square,
  Terminal,
  Trash2,
  Wifi,
  X
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const api = window.pocketlan;

const statusStyles = {
  stopped: "border-zinc-700 bg-zinc-800/80 text-zinc-200",
  starting: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  running: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  error: "border-rose-500/40 bg-rose-500/15 text-rose-200"
};

const statusLabels = {
  stopped: "Stopped",
  starting: "Starting",
  running: "Running",
  error: "Error"
};

const LOGO_SRC = "logo.png";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function isValidPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function Section({ icon: Icon, title, action, children, className = "" }) {
  return (
    <section
      className={classNames(
        "rounded-lg border border-zinc-800 bg-zinc-900/78 p-4 shadow-panel sm:p-5",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 text-cyan-200">
            <Icon size={18} />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function IconButton({ title, children, className = "", ...props }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={classNames(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 transition hover:border-cyan-400/60 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ variant = "neutral", children, className = "", ...props }) {
  const variants = {
    start:
      "border-emerald-500/50 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/25",
    stop: "border-rose-500/50 bg-rose-500/18 text-rose-100 hover:bg-rose-500/25",
    neutral:
      "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-cyan-400/60 hover:bg-zinc-800",
    accent:
      "border-cyan-400/50 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/22"
  };

  return (
    <button
      type="button"
      className={classNames(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-left transition hover:border-zinc-700"
    >
      <span className="text-sm font-medium text-zinc-100">{label}</span>
      <span
        className={classNames(
          "relative h-6 w-11 rounded-full border transition",
          checked ? "border-cyan-400/60 bg-cyan-400/35" : "border-zinc-700 bg-zinc-800"
        )}
      >
        <span
          className={classNames(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-zinc-100 transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </span>
    </button>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold",
        statusStyles[status] || statusStyles.stopped
      )}
    >
      {status === "starting" ? <Loader2 size={14} className="animate-spin" /> : null}
      {statusLabels[status] || "Stopped"}
    </span>
  );
}

function LinkRow({ link, onCopy, onOpen, onQr }) {
  return (
    <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center xl:grid-cols-[140px_minmax(0,1fr)_auto]">
      <span className="truncate text-sm font-semibold text-zinc-200">{link.label}</span>
      <span className="truncate font-mono text-sm text-cyan-100">{link.url}</span>
      <div className="flex items-center gap-2 md:justify-end">
        <IconButton title={`Copy ${link.label}`} onClick={() => onCopy(link.url)}>
          <Copy size={16} />
        </IconButton>
        <IconButton title={`Open ${link.label}`} onClick={() => onOpen(link.url)}>
          <ExternalLink size={16} />
        </IconButton>
        <IconButton title={`Show QR for ${link.label}`} onClick={() => onQr(link)}>
          <QrCode size={16} />
        </IconButton>
      </div>
    </div>
  );
}

function QrModal({ link, onClose, onCopy, onOpen }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link.url, {
      width: 340,
      margin: 2,
      color: {
        dark: "#09090b",
        light: "#ffffff"
      }
    }).then((dataUrl) => {
      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [link.url]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-950 p-5 shadow-panel"
        initial={{ y: 18, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 18, scale: 0.98 }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-zinc-100">{link.label}</h3>
            <p className="truncate font-mono text-sm text-cyan-100">{link.url}</p>
          </div>
          <IconButton title="Close QR" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="flex min-h-[340px] items-center justify-center rounded-lg bg-white p-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR code for ${link.url}`} className="h-full w-full" />
          ) : (
            <Loader2 className="animate-spin text-zinc-900" size={28} />
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <PrimaryButton variant="accent" onClick={() => onCopy(link.url)}>
            <Copy size={16} />
            Copy
          </PrimaryButton>
          <PrimaryButton onClick={() => onOpen(link.url)}>
            <ExternalLink size={16} />
            Open
          </PrimaryButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PinSetting({ pinEnabled, appPin, onToggle, onSave }) {
  const [draft, setDraft] = useState(appPin ?? "");
  const [showPin, setShowPin] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync external appPin into draft when it changes from outside
  useEffect(() => {
    setDraft(appPin ?? "");
    setDirty(false);
  }, [appPin]);

  const handleChange = (e) => {
    setDraft(e.target.value);
    setDirty(true);
  };

  const handleSave = () => {
    if (dirty) {
      onSave(draft);
      setDirty(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* Toggle row */}
      <button
        type="button"
        role="switch"
        aria-checked={pinEnabled}
        onClick={() => onToggle(!pinEnabled)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-zinc-900/60"
      >
        <div className="flex items-center gap-3">
          <Lock size={15} className={pinEnabled ? "text-cyan-300" : "text-zinc-500"} />
          <span className="text-sm font-medium text-zinc-100">App PIN protection</span>
        </div>
        <span
          className={classNames(
            "relative h-6 w-11 shrink-0 rounded-full border transition",
            pinEnabled ? "border-cyan-400/60 bg-cyan-400/35" : "border-zinc-700 bg-zinc-800"
          )}
        >
          <span
            className={classNames(
              "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-zinc-100 transition",
              pinEnabled ? "left-6" : "left-1"
            )}
          />
        </span>
      </button>

      {/* PIN input — only when enabled */}
      {pinEnabled && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="mb-2 text-xs text-zinc-500">
            Clients must enter this PIN to access the server.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="app-pin-input"
                type={showPin ? "text" : "password"}
                value={draft}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Enter PIN…"
                maxLength={64}
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 pr-10 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-cyan-400/60 focus:outline-none"
              />
              <button
                type="button"
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-200"
              >
                {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="button"
              disabled={!dirty}
              onClick={handleSave}
              className={classNames(
                "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
                dirty
                  ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/22"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400"
              )}
            >
              <Check size={14} />
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [loaded, setLoaded] = useState(false);
  const [folder, setFolder] = useState("");
  const [port, setPort] = useState("3000");
  const [settings, setSettings] = useState({
    autoStart: false,
    minimizeToTray: true,
    appPin: "",
    pinEnabled: false
  });
  const [server, setServer] = useState({
    status: "stopped",
    error: ""
  });
  const [links, setLinks] = useState({
    links: [],
    tailscaleDetected: false
  });
  const [logs, setLogs] = useState([]);
  const [notice, setNotice] = useState("");
  const [qrLink, setQrLink] = useState(null);
  const logEndRef = useRef(null);
  const noticeTimer = useRef(null);

  const serverActive = server.status === "starting" || server.status === "running";
  const portValid = isValidPort(port);
  const hasFolder = folder.trim().length > 0;
  const visibleLinks = server.status === "running" ? links.links : [];
  const lanLinkCount = visibleLinks.filter((link) => link.type === "lan").length;

  const showNotice = useCallback((message) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 1800);
  }, []);

  const saveSettings = useCallback(async (patch) => {
    const result = await api.saveSettings(patch);
    if (result?.settings) {
      setSettings({
        autoStart: result.settings.autoStart,
        minimizeToTray: result.settings.minimizeToTray,
        appPin: result.settings.appPin ?? "",
        pinEnabled: result.settings.pinEnabled ?? false
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    api.getInitialState().then((state) => {
      if (!mounted) {
        return;
      }

      setFolder(state.settings.lastSelectedFolder || "");
      setPort(String(state.settings.lastUsedPort || 3000));
      setSettings({
        autoStart: Boolean(state.settings.autoStart),
        minimizeToTray: Boolean(state.settings.minimizeToTray),
        appPin: state.settings.appPin ?? "",
        pinEnabled: Boolean(state.settings.pinEnabled)
      });
      setServer(state.server || { status: "stopped" });
      setLogs(state.logs || []);
      setLinks(state.links || { links: [], tailscaleDetected: false });
      setLoaded(true);
    });

    const unsubscribeState = api.onServerState((state) => setServer(state));
    const unsubscribeLog = api.onLog((entry) => {
      setLogs((current) => [...current.slice(-1199), entry]);
    });
    const unsubscribeCleared = api.onLogsCleared(() => setLogs([]));
    const unsubscribeLinks = api.onLinksUpdated((state) => setLinks(state));
    const unsubscribeSettings = api.onSettingsChanged((state) => {
      setFolder(state.lastSelectedFolder || "");
      setPort(String(state.lastUsedPort || 3000));
      setSettings({
        autoStart: Boolean(state.autoStart),
        minimizeToTray: Boolean(state.minimizeToTray),
        appPin: state.appPin ?? "",
        pinEnabled: Boolean(state.pinEnabled)
      });
    });

    return () => {
      mounted = false;
      unsubscribeState();
      unsubscribeLog();
      unsubscribeCleared();
      unsubscribeLinks();
      unsubscribeSettings();
      clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  const handleBrowse = async () => {
    const result = await api.selectFolder();
    if (!result?.canceled && result?.folder) {
      setFolder(result.folder);
      showNotice("Folder saved");
    }
  };

  const handlePortChange = async (event) => {
    const nextPort = event.target.value;
    setPort(nextPort);

    if (isValidPort(nextPort)) {
      await saveSettings({ lastUsedPort: Number(nextPort) });
    }
  };

  const handleStart = async () => {
    const result = await api.startServer({
      folder,
      port: Number(port)
    });

    if (!result?.ok && result?.error) {
      showNotice(result.error);
    }
  };

  const handleStop = async () => {
    await api.stopServer();
  };

  const handleRestart = async () => {
    const result = await api.restartServer({
      folder,
      port: Number(port)
    });

    if (!result?.ok && result?.error) {
      showNotice(result.error);
    }
  };

  const handleCopy = async (text) => {
    await api.copyText(text);
    showNotice("Copied");
  };

  const handleOpen = async (url) => {
    await api.openExternal(url);
  };

  const handleClearLogs = async () => {
    await api.clearLogs();
  };

  const copyLogs = async () => {
    const text = logs
      .map((line) => `[${new Date(line.timestamp).toLocaleTimeString()}] ${line.stream}: ${line.text}`)
      .join("\n");
    await handleCopy(text);
  };

  const logText = useMemo(() => {
    if (!logs.length) {
      return null;
    }

    return logs.map((entry) => (
      <div
        key={entry.id}
        className={classNames(
          "grid grid-cols-[72px_56px_minmax(0,1fr)] gap-2 border-b border-zinc-900 px-3 py-1.5 sm:grid-cols-[84px_70px_minmax(0,1fr)] sm:gap-3",
          entry.stream === "stderr" || entry.stream === "error"
            ? "text-rose-200"
            : entry.stream === "system"
              ? "text-zinc-300"
              : "text-emerald-100"
        )}
      >
        <span className="text-zinc-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
        <span className="uppercase text-zinc-500">{entry.stream}</span>
        <span className="whitespace-pre-wrap break-words">{entry.text}</span>
      </div>
    ));
  }, [logs]);

  if (!loaded) {
    return (
      <main className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-200">
          <Loader2 size={22} className="animate-spin text-cyan-200" />
          <span className="text-sm font-semibold">Loading PocketLAN</span>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-y-auto bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
        <header className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-4 shadow-panel sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={LOGO_SRC}
              alt="PocketLAN"
              className="h-12 w-12 shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 object-cover sm:h-14 sm:w-14"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-zinc-50 sm:text-2xl">PocketLAN</h1>
              <p className="truncate text-sm text-zinc-400">
                {server.status === "running"
                  ? `Sharing ${server.folder || folder}`
                  : "Ready to launch your local file server"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            {notice ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/12 px-3 py-1 text-sm text-cyan-100">
                <Check size={14} />
                {notice}
              </span>
            ) : null}
            <StatusBadge status={server.status} />
          </div>
        </header>

        <div
          data-layout-grid="desktop-shell"
          className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]"
        >
          <div className="flex min-w-0 flex-col gap-5">
            <Section icon={FolderOpen} title="Folder Selection">
              <div className="grid gap-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">Selected folder</div>
                  <div className="min-h-7 break-all font-mono text-sm text-zinc-100">
                    {folder || "No folder selected"}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-zinc-200">Port</span>
                    <input
                      value={port}
                      min="1"
                      max="65535"
                      type="number"
                      onChange={handlePortChange}
                      disabled={serverActive}
                      className={classNames(
                        "h-11 rounded-lg border bg-zinc-950 px-3 text-sm text-zinc-100 transition disabled:cursor-not-allowed disabled:opacity-55",
                        portValid ? "border-zinc-700" : "border-rose-500/70"
                      )}
                    />
                  </label>
                  <PrimaryButton className="w-full sm:w-auto" variant="accent" onClick={handleBrowse} disabled={serverActive}>
                    <FolderOpen size={17} />
                    Browse Folder
                  </PrimaryButton>
                </div>
              </div>
            </Section>

            <Section icon={Wifi} title="Server Controls">
              <div className="grid gap-4">
                {server.status === "error" && server.error ? (
                  <div className="rounded-lg border border-rose-500/35 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
                    {server.error}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <PrimaryButton
                    variant="start"
                    disabled={serverActive || !hasFolder || !portValid}
                    onClick={handleStart}
                  >
                    <Play size={17} />
                    Start Server
                  </PrimaryButton>
                  <PrimaryButton variant="stop" disabled={!serverActive} onClick={handleStop}>
                    <Square size={17} />
                    Stop Server
                  </PrimaryButton>
                  <PrimaryButton disabled={!serverActive} onClick={handleRestart}>
                    <RotateCcw size={17} />
                    Restart Server
                  </PrimaryButton>
                </div>
              </div>
            </Section>

            <Section
              icon={Link2}
              title="Links"
              action={
                <IconButton
                  title="Refresh links"
                  onClick={() => api.refreshLinks(Number(port))}
                  className="shrink-0"
                >
                  <RefreshCcw size={16} />
                </IconButton>
              }
            >
              <div className="grid gap-3">
                {visibleLinks.length ? (
                  visibleLinks.map((link) => (
                    <LinkRow
                      key={`${link.type}-${link.url}`}
                      link={link}
                      onCopy={handleCopy}
                      onOpen={handleOpen}
                      onQr={setQrLink}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-5 text-sm text-zinc-400">
                    Links appear after the server is running.
                  </div>
                )}

                {server.status === "running" && lanLinkCount === 0 ? (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                    No private LAN IPv4 address detected.
                  </div>
                ) : null}

                {server.status === "running" && !links.tailscaleDetected ? (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                    Tailscale not detected.
                  </div>
                ) : null}
              </div>
            </Section>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Section
              icon={Terminal}
              title="Logs"
              className="min-h-[430px] flex-1"
              action={
                <div className="flex items-center gap-2">
                  <IconButton title="Copy logs" onClick={copyLogs} disabled={!logs.length}>
                    <ClipboardCopy size={16} />
                  </IconButton>
                  <IconButton title="Clear logs" onClick={handleClearLogs} disabled={!logs.length}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              }
            >
              <div className="h-[360px] overflow-y-auto rounded-lg border border-zinc-800 bg-black/45 font-mono text-xs leading-5">
                {logText || (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    No logs yet.
                  </div>
                )}
                <div ref={logEndRef} />
              </div>
            </Section>

            <Section icon={Settings} title="Settings">
              <div className="grid gap-3">
                <Toggle
                  label="Auto-start server on app launch"
                  checked={settings.autoStart}
                  onChange={async (checked) => {
                    setSettings((current) => ({ ...current, autoStart: checked }));
                    await saveSettings({ autoStart: checked });
                    showNotice("Settings saved");
                  }}
                />
                <Toggle
                  label="Minimize to tray"
                  checked={settings.minimizeToTray}
                  onChange={async (checked) => {
                    setSettings((current) => ({ ...current, minimizeToTray: checked }));
                    await saveSettings({ minimizeToTray: checked });
                    showNotice("Settings saved");
                  }}
                />
                <PinSetting
                  pinEnabled={settings.pinEnabled}
                  appPin={settings.appPin}
                  onToggle={async (checked) => {
                    setSettings((current) => ({ ...current, pinEnabled: checked }));
                    await saveSettings({ pinEnabled: checked });
                    showNotice("Settings saved");
                  }}
                  onSave={async (pin) => {
                    setSettings((current) => ({ ...current, appPin: pin }));
                    await saveSettings({ appPin: pin });
                    showNotice("PIN saved");
                  }}
                />
              </div>
            </Section>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {qrLink ? (
          <QrModal
            link={qrLink}
            onClose={() => setQrLink(null)}
            onCopy={handleCopy}
            onOpen={handleOpen}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

export default App;
