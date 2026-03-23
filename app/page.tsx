"use client";

import { toPng } from "html-to-image";
import Image from "next/image";
import {
  ChangeEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type CardState = {
  title: string;
  icon: string;
  description: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  artBackground: string;
  panelBackground: string;
  frameAccent: string;
  titleColor: string;
  bodyTextColor: string;
};

type CardRecord = {
  id: string;
  name: string;
  card: CardState;
  artImage: string | null;
  updatedAt: string;
};

type CardLibraryFile = {
  version: number;
  cards: CardRecord[];
};

type PermissionMode = "read" | "readwrite";

type PermissionStateValue = "granted" | "prompt" | "denied";

type FileHandleLike = {
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: string | Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type DirectoryHandleLike = {
  name?: string;
  getFileHandle: (
    fileName: string,
    options?: { create?: boolean },
  ) => Promise<FileHandleLike>;
  queryPermission?: (descriptor: {
    mode: PermissionMode;
  }) => Promise<PermissionStateValue>;
  requestPermission?: (descriptor: {
    mode: PermissionMode;
  }) => Promise<PermissionStateValue>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<unknown>;
};

const DB_NAME = "enchunted-local-storage";
const DB_VERSION = 1;
const DB_STORE = "settings";
const DB_DIRECTORY_KEY = "cards-directory-handle";
const DB_EXPORT_DIRECTORY_KEY = "export-directory-handle";
const CARD_JSON_FILE = "cards.json";

const defaultCard: CardState = {
  title: "Title",
  icon: "💧",
  description: "Description",
  footerLeft: "0",
  footerCenter: "0",
  footerRight: "0",
  artBackground: "#3f0004",
  panelBackground: "#324379",
  frameAccent: "#4fa2ff",
  titleColor: "#f6f7ff",
  bodyTextColor: "#f8f9ff",
};

const iconSuggestions = ["💧", "🔥", "🌿", "☠", "⚡", "❄", "✨", "🛡"];

const emptyLibraryFile: CardLibraryFile = {
  version: 1,
  cards: [],
};

type CardPreviewProps = {
  card: CardState;
  artImage: string | null;
};

function CardPreview({ card, artImage }: CardPreviewProps) {
  return (
    <article className="relative h-[448px] w-[320px] shrink-0 rounded-[28px] border-8 border-black bg-linear-to-b from-slate-900 via-slate-950 to-black p-2 shadow-[0_30px_80px_rgba(0,0,0,0.65)] sm:h-[504px] sm:w-[360px] lg:h-[546px] lg:w-[390px]">
      <div className="relative flex h-full flex-col gap-2 overflow-hidden rounded-[20px] border-2 border-slate-800 bg-slate-900 p-3">
        <header
          className="flex h-10 shrink-0 items-center justify-between rounded-xl border-2 px-3 py-1 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.06)]"
          style={{
            borderColor: card.frameAccent,
            background:
              "linear-gradient(135deg, rgba(20,28,65,0.95), rgba(57,78,140,0.95))",
          }}
        >
          <h1
            className="min-w-0 truncate text-lg font-semibold tracking-wide"
            style={{ color: card.titleColor }}
          >
            {card.title || "Untitled"}
          </h1>
          <span
            className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm"
            style={{
              borderColor: card.frameAccent,
              color: card.titleColor,
              backgroundColor: "rgba(0, 0, 0, 0.35)",
            }}
          >
            {card.icon || "★"}
          </span>
        </header>

        <div
          className="relative min-h-0 flex-[0_0_45%] overflow-hidden rounded-xl border-2"
          style={{
            borderColor: card.frameAccent,
            backgroundColor: card.artBackground,
          }}
        >
          {artImage ? (
            <Image
              src={artImage}
              alt="Card art"
              fill
              sizes="390px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-8xl opacity-70">{card.icon || "★"}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.5)_100%)]" />
        </div>

        <div
          className="relative min-h-0 flex-1 rounded-xl border-2 p-4"
          style={{
            borderColor: card.frameAccent,
            background:
              "linear-gradient(160deg, rgba(50,67,121,0.98), rgba(33,45,87,0.96))",
            backgroundColor: card.panelBackground,
          }}
        >
          <p
            className="h-full overflow-y-auto text-lg leading-relaxed"
            style={{ color: card.bodyTextColor }}
          >
            {card.description || "Add your card description here."}
          </p>
        </div>

        <footer
          className="grid h-10 shrink-0 grid-cols-3 rounded-xl border-2 px-4 py-1 text-2xl font-semibold"
          style={{
            borderColor: card.frameAccent,
            background:
              "linear-gradient(135deg, rgba(33,46,95,0.95), rgba(48,64,124,0.95))",
            color: card.titleColor,
          }}
        >
          <span>{card.footerLeft}</span>
          <span className="text-center">{card.footerCenter}</span>
          <span className="text-right">{card.footerRight}</span>
        </footer>
      </div>
    </article>
  );
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveStoredDirectoryHandle(
  handle: DirectoryHandleLike,
  key: string = DB_DIRECTORY_KEY,
) {
  const db = await openHandleDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(handle, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

async function loadStoredDirectoryHandle(
  key: string = DB_DIRECTORY_KEY,
): Promise<DirectoryHandleLike | null> {
  const db = await openHandleDb();

  const handle = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });

  db.close();

  return isDirectoryHandle(handle) ? handle : null;
}

function isDirectoryHandle(value: unknown): value is DirectoryHandleLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "getFileHandle" in value &&
    typeof (value as { getFileHandle?: unknown }).getFileHandle === "function"
  );
}

function toCardId(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled-card"
  );
}

function sortByNewest(cards: CardRecord[]): CardRecord[] {
  return [...cards].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

async function ensureDirectoryPermission(
  handle: DirectoryHandleLike,
  shouldPrompt: boolean,
): Promise<boolean> {
  if (handle.queryPermission) {
    const state = await handle.queryPermission({ mode: "readwrite" });
    if (state === "granted") {
      return true;
    }

    if (!shouldPrompt) {
      return false;
    }
  }

  if (shouldPrompt && handle.requestPermission) {
    const state = await handle.requestPermission({ mode: "readwrite" });
    return state === "granted";
  }

  return !handle.queryPermission;
}

async function readLibraryFile(
  directoryHandle: DirectoryHandleLike,
): Promise<CardLibraryFile> {
  const handle = await directoryHandle.getFileHandle(CARD_JSON_FILE, {
    create: true,
  });
  const file = await handle.getFile();
  const raw = await file.text();

  if (!raw.trim()) {
    return emptyLibraryFile;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CardLibraryFile>;
    if (!Array.isArray(parsed.cards)) {
      return emptyLibraryFile;
    }

    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      cards: parsed.cards.filter(
        (entry): entry is CardRecord =>
          typeof entry === "object" &&
          entry !== null &&
          typeof entry.id === "string" &&
          typeof entry.name === "string" &&
          typeof entry.updatedAt === "string" &&
          typeof entry.card === "object",
      ),
    };
  } catch {
    return emptyLibraryFile;
  }
}

async function writeLibraryFile(
  directoryHandle: DirectoryHandleLike,
  payload: CardLibraryFile,
) {
  const handle = await directoryHandle.getFileHandle(CARD_JSON_FILE, {
    create: true,
  });

  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Image conversion failed."));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function wait(durationMs: number) {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export default function Home() {
  const [card, setCard] = useState<CardState>(defaultCard);
  const [artImage, setArtImage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"builder" | "library">(
    "builder",
  );
  const [libraryCards, setLibraryCards] = useState<CardRecord[]>([]);
  const [directoryHandle, setDirectoryHandle] =
    useState<DirectoryHandleLike | null>(null);
  const [directoryName, setDirectoryName] = useState<string>("");
  const [exportDirectoryHandle, setExportDirectoryHandle] =
    useState<DirectoryHandleLike | null>(null);
  const [exportDirectoryName, setExportDirectoryName] = useState<string>("");
  const [isFolderBusy, setIsFolderBusy] = useState(false);
  const [isExportFolderBusy, setIsExportFolderBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportCardState, setExportCardState] =
    useState<CardState>(defaultCard);
  const [exportArtImage, setExportArtImage] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState(
    "Choose a local folder to store cards.json",
  );
  const exportRef = useRef<HTMLDivElement | null>(null);

  const isPickerSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return "showDirectoryPicker" in (window as WindowWithDirectoryPicker);
  }, []);

  const reloadCardsFromFolder = async (
    nextHandle: DirectoryHandleLike,
    statusPrefix = "Loaded",
  ) => {
    const data = await readLibraryFile(nextHandle);
    const sorted = sortByNewest(data.cards);
    setLibraryCards(sorted);
    setStorageMessage(
      `${statusPrefix} ${sorted.length} card${sorted.length === 1 ? "" : "s"}.`,
    );
  };

  useEffect(() => {
    const restoreFolder = async () => {
      if (typeof window === "undefined" || !("indexedDB" in window)) {
        return;
      }

      try {
        const storedHandle = await loadStoredDirectoryHandle();
        if (!storedHandle) {
          return;
        }

        const hasPermission = await ensureDirectoryPermission(
          storedHandle,
          false,
        );

        if (!hasPermission) {
          setStorageMessage(
            "Folder found from last session. Click reconnect to grant access.",
          );
          setDirectoryName(storedHandle.name ?? "Selected folder");
          return;
        }

        setDirectoryHandle(storedHandle);
        setDirectoryName(storedHandle.name ?? "Selected folder");
        await reloadCardsFromFolder(storedHandle, "Synced");
      } catch {
        setStorageMessage("Could not restore folder access.");
      }
    };

    void restoreFolder();
  }, []);

  useEffect(() => {
    const restoreExportFolder = async () => {
      if (typeof window === "undefined" || !("indexedDB" in window)) {
        return;
      }

      try {
        const storedHandle = await loadStoredDirectoryHandle(
          DB_EXPORT_DIRECTORY_KEY,
        );
        if (!storedHandle) {
          return;
        }

        const hasPermission = await ensureDirectoryPermission(
          storedHandle,
          false,
        );

        if (!hasPermission) {
          setExportDirectoryName(storedHandle.name ?? "Selected export folder");
          return;
        }

        setExportDirectoryHandle(storedHandle);
        setExportDirectoryName(storedHandle.name ?? "Selected export folder");
      } catch {
        setStorageMessage("Could not restore export folder access.");
      }
    };

    void restoreExportFolder();
  }, []);

  const onFieldChange =
    (key: keyof CardState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setCard((current) => ({ ...current, [key]: event.target.value }));
    };

  const onArtUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const nextImage = await fileToDataUrl(file);
      setArtImage(nextImage);
    } catch {
      setStorageMessage("Could not read that image file.");
    }
  };

  const clearArt = () => {
    setArtImage(null);
  };

  const pickCardsFolder = async () => {
    if (!isPickerSupported || typeof window === "undefined") {
      setStorageMessage(
        "This browser does not support local folder access. Use a Chromium-based browser.",
      );
      return;
    }

    const pickerWindow = window as WindowWithDirectoryPicker;
    if (!pickerWindow.showDirectoryPicker) {
      return;
    }

    setIsFolderBusy(true);

    try {
      const selectedHandle = await pickerWindow.showDirectoryPicker();
      if (!isDirectoryHandle(selectedHandle)) {
        setStorageMessage("Invalid folder handle returned.");
        return;
      }

      const granted = await ensureDirectoryPermission(selectedHandle, true);
      if (!granted) {
        setStorageMessage("Folder permission was not granted.");
        return;
      }

      if ("indexedDB" in window) {
        await saveStoredDirectoryHandle(selectedHandle);
      }

      setDirectoryHandle(selectedHandle);
      setDirectoryName(selectedHandle.name ?? "Selected folder");
      await reloadCardsFromFolder(selectedHandle, "Connected and loaded");
    } catch {
      setStorageMessage("Folder selection was cancelled or failed.");
    } finally {
      setIsFolderBusy(false);
    }
  };

  const pickExportFolder = async (): Promise<DirectoryHandleLike | null> => {
    if (!isPickerSupported || typeof window === "undefined") {
      setStorageMessage(
        "This browser does not support local folder access. Use a Chromium-based browser.",
      );
      return null;
    }

    const pickerWindow = window as WindowWithDirectoryPicker;
    if (!pickerWindow.showDirectoryPicker) {
      return null;
    }

    setIsExportFolderBusy(true);

    try {
      const selectedHandle = await pickerWindow.showDirectoryPicker();
      if (!isDirectoryHandle(selectedHandle)) {
        setStorageMessage("Invalid export folder handle returned.");
        return null;
      }

      const granted = await ensureDirectoryPermission(selectedHandle, true);
      if (!granted) {
        setStorageMessage("Export folder permission was not granted.");
        return null;
      }

      if ("indexedDB" in window) {
        await saveStoredDirectoryHandle(
          selectedHandle,
          DB_EXPORT_DIRECTORY_KEY,
        );
      }

      setExportDirectoryHandle(selectedHandle);
      setExportDirectoryName(selectedHandle.name ?? "Selected export folder");
      setStorageMessage(
        `Export folder set to ${selectedHandle.name ?? "selected folder"}.`,
      );
      return selectedHandle;
    } catch {
      setStorageMessage("Export folder selection was cancelled or failed.");
      return null;
    } finally {
      setIsExportFolderBusy(false);
    }
  };

  const saveCurrentCard = async () => {
    if (!directoryHandle) {
      setStorageMessage("Select a folder first.");
      return;
    }

    setIsSaving(true);

    try {
      const granted = await ensureDirectoryPermission(directoryHandle, true);
      if (!granted) {
        setStorageMessage("Cannot save without folder write permission.");
        return;
      }

      const nextLibrary = await readLibraryFile(directoryHandle);
      const id = toCardId(card.title);
      const now = new Date().toISOString();

      const nextRecord: CardRecord = {
        id,
        name: card.title.trim() || "Untitled card",
        card,
        artImage,
        updatedAt: now,
      };

      const existingIndex = nextLibrary.cards.findIndex(
        (entry) => entry.id === id,
      );
      if (existingIndex >= 0) {
        nextLibrary.cards[existingIndex] = nextRecord;
      } else {
        nextLibrary.cards.push(nextRecord);
      }

      await writeLibraryFile(directoryHandle, nextLibrary);
      const sorted = sortByNewest(nextLibrary.cards);
      setLibraryCards(sorted);
      setStorageMessage(
        existingIndex >= 0
          ? `Updated ${nextRecord.name} in cards.json.`
          : `Saved ${nextRecord.name} to cards.json.`,
      );
      setActiveView("library");
    } catch {
      setStorageMessage("Save failed. Check folder permissions and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const loadRecordToBuilder = (record: CardRecord) => {
    setCard(record.card);
    setArtImage(record.artImage);
    setActiveView("builder");
    setStorageMessage(`Loaded ${record.name} from cards.json.`);
  };

  const renderNodeToDataUrl = async (
    elementRef: RefObject<HTMLDivElement | null>,
  ) => {
    if (!elementRef.current) {
      setStorageMessage("Export target was not ready.");
      return null;
    }

    return toPng(elementRef.current, {
      cacheBust: true,
      pixelRatio: 2,
    });
  };

  const downloadDataUrlAsPng = (dataUrl: string, fileName: string) => {
    const link = document.createElement("a");
    link.download = `${toCardId(fileName)}.png`;
    link.href = dataUrl;
    link.click();
  };

  const writeDataUrlToFolder = async (
    folderHandle: DirectoryHandleLike,
    fileName: string,
    dataUrl: string,
  ) => {
    const fileHandle = await folderHandle.getFileHandle(
      `${toCardId(fileName)}.png`,
      {
        create: true,
      },
    );
    const writable = await fileHandle.createWritable();
    const blob = await fetch(dataUrl).then((response) => response.blob());
    await writable.write(blob);
    await writable.close();
  };

  const exportCardAsPng = async (
    nextCard: CardState,
    nextArtImage: string | null,
  ) => {
    setIsExporting(true);

    try {
      setExportCardState(nextCard);
      setExportArtImage(nextArtImage);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const dataUrl = await renderNodeToDataUrl(exportRef);
      if (!dataUrl) {
        setStorageMessage("PNG export failed.");
        return;
      }

      downloadDataUrlAsPng(dataUrl, nextCard.title || "untitled-card");
      setStorageMessage(
        `Exported ${nextCard.title || "Untitled card"} as PNG.`,
      );
    } catch {
      setStorageMessage("PNG export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportAllCardsAsPng = async () => {
    if (libraryCards.length === 0) {
      setStorageMessage("No saved cards available for export.");
      return;
    }

    setIsExporting(true);

    try {
      let targetHandle = exportDirectoryHandle;
      if (!targetHandle) {
        targetHandle = await pickExportFolder();
      }

      if (!targetHandle) {
        return;
      }

      const granted = await ensureDirectoryPermission(targetHandle, true);
      if (!granted) {
        setStorageMessage(
          "Cannot write PNGs without export folder permission.",
        );
        return;
      }

      for (const entry of libraryCards) {
        setExportCardState(entry.card);
        setExportArtImage(entry.artImage);

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });

        const dataUrl = await renderNodeToDataUrl(exportRef);
        if (!dataUrl) {
          throw new Error("Export target unavailable");
        }

        await writeDataUrlToFolder(
          targetHandle,
          entry.name || entry.id,
          dataUrl,
        );
        await wait(200);
      }

      setStorageMessage(
        `Exported ${libraryCards.length} cards to ${targetHandle.name ?? "export folder"}.`,
      );
    } catch {
      setStorageMessage("Batch PNG export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-indigo-950 px-4 py-8 text-slate-100 md:px-8">
      <div
        className="pointer-events-none fixed -left-[9999px] top-0 opacity-0"
        aria-hidden="true"
      >
        <div ref={exportRef}>
          <CardPreview card={exportCardState} artImage={exportArtImage} />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 lg:flex-row">
        <section className="flex w-full justify-center lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:w-105 lg:items-start">
          <CardPreview card={card} artImage={artImage} />
        </section>

        <section className="w-full rounded-3xl border border-slate-700/80 bg-slate-900/70 p-4 backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/70 p-1">
              <button
                type="button"
                onClick={() => setActiveView("builder")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeView === "builder"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                Builder
              </button>
              <button
                type="button"
                onClick={() => setActiveView("library")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeView === "library"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                Library
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={pickCardsFolder}
                disabled={isFolderBusy}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFolderBusy
                  ? "Opening..."
                  : directoryHandle
                    ? "Reconnect folder"
                    : "Choose cards folder"}
              </button>
              {activeView === "builder" && (
                <>
                  <button
                    type="button"
                    onClick={saveCurrentCard}
                    disabled={!directoryHandle || isSaving}
                    className="rounded-lg border border-cyan-500/80 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save card"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void exportCardAsPng(card, artImage);
                    }}
                    disabled={isExporting}
                    className="rounded-lg border border-emerald-500/80 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isExporting ? "Exporting..." : "Save as PNG"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/70 p-3 text-sm text-slate-300">
            <p>Folder: {directoryName || "Not connected"}</p>
            <p>Export PNG folder: {exportDirectoryName || "Not selected"}</p>
            <p className="mt-1 text-slate-400">{storageMessage}</p>
          </div>

          {activeView === "builder" ? (
            <>
              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="space-y-3">
                  <label
                    className="text-sm font-medium text-slate-200"
                    htmlFor="title"
                  >
                    Title
                  </label>
                  <input
                    id="title"
                    value={card.title}
                    onChange={onFieldChange("title")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
                  />
                </div>

                <div className="space-y-3">
                  <label
                    className="text-sm font-medium text-slate-200"
                    htmlFor="icon"
                  >
                    Icon
                  </label>
                  <div className="flex gap-3">
                    <input
                      id="icon"
                      value={card.icon}
                      onChange={onFieldChange("icon")}
                      maxLength={2}
                      className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-xl text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
                    />
                    <div className="flex flex-wrap gap-2">
                      {iconSuggestions.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setCard((current) => ({ ...current, icon: value }))
                          }
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xl transition hover:border-cyan-300"
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 xl:col-span-2">
                  <label
                    className="text-sm font-medium text-slate-200"
                    htmlFor="description"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={card.description}
                    onChange={onFieldChange("description")}
                    rows={5}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
                  />
                </div>

                <div className="space-y-3">
                  <label
                    className="text-sm font-medium text-slate-200"
                    htmlFor="artImage"
                  >
                    Art image
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="artImage"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        void onArtUpload(event);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500 file:px-3 file:py-1 file:font-medium file:text-slate-950"
                    />
                    <button
                      type="button"
                      onClick={clearArt}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm transition hover:border-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-2 text-sm font-medium text-slate-200">
                    Art background
                    <input
                      type="color"
                      value={card.artBackground}
                      onChange={onFieldChange("artBackground")}
                      className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-200">
                    Panel color
                    <input
                      type="color"
                      value={card.panelBackground}
                      onChange={onFieldChange("panelBackground")}
                      className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-4 xl:col-span-2">
                  <label className="space-y-2 text-sm font-medium text-slate-200">
                    Frame accent
                    <input
                      type="color"
                      value={card.frameAccent}
                      onChange={onFieldChange("frameAccent")}
                      className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-200">
                    Title text
                    <input
                      type="color"
                      value={card.titleColor}
                      onChange={onFieldChange("titleColor")}
                      className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-200">
                    Body text
                    <input
                      type="color"
                      value={card.bodyTextColor}
                      onChange={onFieldChange("bodyTextColor")}
                      className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-4 xl:col-span-2">
                  <label className="space-y-2 text-sm font-medium text-slate-200">
                    Left stat
                    <input
                      value={card.footerLeft}
                      onChange={onFieldChange("footerLeft")}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-200">
                    Center stat
                    <input
                      value={card.footerCenter}
                      onChange={onFieldChange("footerCenter")}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-200">
                    Right stat
                    <input
                      value={card.footerRight}
                      onChange={onFieldChange("footerRight")}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    clearArt();
                    setCard(defaultCard);
                  }}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-300 hover:text-white"
                >
                  Reset builder
                </button>
                {!isPickerSupported && (
                  <span className="text-sm text-amber-300">
                    Local folder saving requires a Chromium-based browser.
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-wide text-slate-100">
                  Saved Cards
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void pickExportFolder();
                    }}
                    disabled={isExportFolderBusy}
                    className="rounded-lg border border-emerald-400/70 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isExportFolderBusy
                      ? "Choosing..."
                      : exportDirectoryHandle
                        ? "Change export folder"
                        : "Choose export folder"}
                  </button>
                  {libraryCards.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        void exportAllCardsAsPng();
                      }}
                      disabled={isExporting}
                      className="rounded-lg border border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isExporting ? "Exporting..." : "Export all PNGs"}
                    </button>
                  )}
                  {directoryHandle && (
                    <button
                      type="button"
                      onClick={() => {
                        void reloadCardsFromFolder(directoryHandle, "Reloaded");
                      }}
                      className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300 hover:text-white"
                    >
                      Reload from JSON
                    </button>
                  )}
                </div>
              </div>

              {!directoryHandle ? (
                <p className="rounded-xl border border-amber-500/40 bg-amber-900/20 p-4 text-sm text-amber-200">
                  Choose a folder first, then cards will be read from cards.json
                  in that folder.
                </p>
              ) : libraryCards.length === 0 ? (
                <p className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-4 text-sm text-slate-300">
                  No saved cards found yet. Save one from the builder tab.
                </p>
              ) : (
                <div className="max-h-[68vh] overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-950/60 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {libraryCards.map((entry) => (
                      <div
                        key={entry.id}
                        className="group rounded-xl border border-slate-700 bg-slate-900 p-3 text-left transition hover:border-cyan-300"
                      >
                        <button
                          type="button"
                          onClick={() => loadRecordToBuilder(entry)}
                          className="block w-full text-left"
                        >
                          <div className="mb-3 w-full aspect-5/7 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                            <div
                              className="relative h-full w-full"
                              style={{
                                backgroundColor: entry.card.artBackground,
                              }}
                            >
                              {entry.artImage ? (
                                <Image
                                  src={entry.artImage}
                                  alt={entry.name}
                                  fill
                                  sizes="180px"
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-5xl opacity-70">
                                  {entry.card.icon || "★"}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="truncate text-sm font-semibold text-slate-100 group-hover:text-cyan-200">
                            {entry.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {new Date(entry.updatedAt).toLocaleString()}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void exportCardAsPng(entry.card, entry.artImage);
                          }}
                          disabled={isExporting}
                          className="mt-3 w-full rounded-lg border border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isExporting ? "Exporting..." : "Export PNG"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
