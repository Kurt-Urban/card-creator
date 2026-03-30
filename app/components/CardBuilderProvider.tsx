"use client";

import {
  CardLibrarySettings,
  CardLibraryFile,
  CardRecord,
  CardState,
  cardThemes,
  compactCardRecord,
  defaultLibrarySettings,
  defaultCard,
  emptyLibraryFile,
  expandStoredCardRecord,
  findThemeIdForCard,
  ensureCardState,
  getThemeById,
  sortByNewest,
  StoredCardLibraryFile,
  ThemeColorField,
} from "../card-builder";
import { CardPreview, HiddenCardSlot, StaticCardPreview } from "./CardPreview";
import { CardBuilderContext } from "./CardBuilderContext";
import { toPng } from "html-to-image";
import {
  ChangeEvent,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type PermissionMode = "read" | "readwrite";

type PermissionStateValue = "granted" | "prompt" | "denied";

type FileHandleLike = {
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: string | Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type DirectoryEntryLike = {
  kind: "file" | "directory";
};

type DirectoryHandleLike = {
  name?: string;
  getFileHandle: (
    fileName: string,
    options?: { create?: boolean },
  ) => Promise<FileHandleLike>;
  getDirectoryHandle?: (
    directoryName: string,
    options?: { create?: boolean },
  ) => Promise<DirectoryHandleLike>;
  removeEntry?: (
    name: string,
    options?: { recursive?: boolean },
  ) => Promise<void>;
  entries?: () => AsyncIterable<[string, DirectoryEntryLike]>;
  queryPermission?: (descriptor: {
    mode: PermissionMode;
  }) => Promise<PermissionStateValue>;
  requestPermission?: (descriptor: {
    mode: PermissionMode;
  }) => Promise<PermissionStateValue>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<unknown>;
  enchuntedElectron?: {
    git?: GitBridge;
    fs?: ElectronFsBridge;
  };
};

type ElectronDirectoryEntry = {
  name: string;
  kind: "file" | "directory";
};

type ElectronFsBridge = {
  listDirectory: (directoryPath: string) => Promise<ElectronDirectoryEntry[]>;
  getFileHandle: (
    directoryPath: string,
    fileName: string,
    create?: boolean,
  ) => Promise<{ filePath: string }>;
  getDirectoryHandle: (
    directoryPath: string,
    directoryName: string,
    create?: boolean,
  ) => Promise<{ path: string; name: string }>;
  readTextFile: (filePath: string) => Promise<string>;
  writeTextFile: (filePath: string, content: string) => Promise<{ ok: true }>;
  writeBinaryFile: (filePath: string, base64: string) => Promise<{ ok: true }>;
  removeEntry: (
    directoryPath: string,
    entryName: string,
    recursive?: boolean,
  ) => Promise<{ ok: true }>;
};

type GitRepoInfo = {
  repoRoot: string;
  repoName: string;
  branch: string;
  remoteUrl: string | null;
  userName: string | null;
  userEmail: string | null;
};

type GitCommandResult = {
  ok: boolean;
  code?: string;
  message: string;
  details?: string;
  repo?: GitRepoInfo;
};

type GitBridge = {
  pickRepo: () => Promise<GitCommandResult>;
  detectRepo: (folderPath: string) => Promise<GitCommandResult>;
  pullRepo: (folderPath: string) => Promise<GitCommandResult>;
  pushRepo: (
    folderPath: string,
    commitMessage?: string,
  ) => Promise<GitCommandResult>;
};

const DB_NAME = "enchunted-local-storage";
const DB_VERSION = 1;
const DB_STORE = "settings";
const DB_DIRECTORY_KEY = "cards-directory-handle";
const DB_EXPORT_DIRECTORY_KEY = "export-directory-handle";
const LOCAL_CACHE_KEY = "cards-library-cache";
const LOCAL_GIT_REPO_PATH_KEY = "enchunted-git-repo-path";
const LIBRARY_PAGE_SIZE = 24;
const SHEET_COLS = 10;
const SHEET_MIN_ROWS = 2;
const EXCLUDED_DIRECTORY_NAMES = new Set([".git"]);

type CachedLibrarySnapshot = {
  settings: CardLibrarySettings;
  cards: CardRecord[];
  directoryName: string;
  exportDirectoryName: string;
  directoryPathSegments: string[];
};

type LibraryReadResult = {
  fileExists: boolean;
  data: CardLibraryFile;
};

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

function supportsDirectoryBrowsing(handle: DirectoryHandleLike): boolean {
  return (
    typeof handle.getDirectoryHandle === "function" &&
    typeof handle.entries === "function"
  );
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "NotFoundError"
  );
}

function formatFolderPath(rootName: string, pathSegments: string[]): string {
  if (pathSegments.length === 0) {
    return rootName;
  }

  return `${rootName}/${pathSegments.join("/")}`;
}

async function resolveDirectoryFromPath(
  rootHandle: DirectoryHandleLike,
  pathSegments: string[],
): Promise<DirectoryHandleLike> {
  let currentHandle = rootHandle;

  for (const segment of pathSegments) {
    if (!currentHandle.getDirectoryHandle) {
      throw new Error("Directory traversal is not supported by this handle.");
    }

    currentHandle = await currentHandle.getDirectoryHandle(segment, {
      create: false,
    });
  }

  return currentHandle;
}

async function listSubdirectories(
  directoryHandle: DirectoryHandleLike,
): Promise<string[]> {
  if (!directoryHandle.entries) {
    return [];
  }

  const names: string[] = [];
  for await (const [name, entry] of directoryHandle.entries()) {
    if (entry.kind === "directory" && !EXCLUDED_DIRECTORY_NAMES.has(name)) {
      names.push(name);
    }
  }

  return names.sort((a, b) => a.localeCompare(b));
}

async function findFallbackJsonFileName(
  directoryHandle: DirectoryHandleLike,
): Promise<string | null> {
  if (!directoryHandle.entries) {
    return null;
  }

  const jsonNames: string[] = [];
  for await (const [name, entry] of directoryHandle.entries()) {
    if (entry.kind !== "file") {
      continue;
    }

    if (name.toLowerCase().endsWith(".json")) {
      jsonNames.push(name);
    }
  }

  if (jsonNames.length === 0) {
    return null;
  }

  jsonNames.sort((a, b) => a.localeCompare(b));
  return jsonNames[0] ?? null;
}

function sanitizeFolderName(input: string): string {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ");
}

function getLibraryFileName(directoryHandle: DirectoryHandleLike): string {
  const directoryName = sanitizeFolderName(directoryHandle.name ?? "");
  const normalizedDirectoryName = directoryName.replace(/\s+/g, "-");
  const baseName =
    normalizedDirectoryName.length > 0 ? normalizedDirectoryName : "cards";
  return `${baseName}-cards.json`;
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

function normalizeLibrarySettings(settings: unknown): CardLibrarySettings {
  const parsedSettings =
    typeof settings === "object" && settings !== null
      ? (settings as Partial<CardLibrarySettings>)
      : {};
  const normalizedIconSuggestions = Array.isArray(
    parsedSettings.iconSuggestions,
  )
    ? parsedSettings.iconSuggestions
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
  const defaultIcon =
    typeof parsedSettings.defaultIcon === "string" &&
    parsedSettings.defaultIcon.trim().length > 0
      ? parsedSettings.defaultIcon.trim()
      : defaultLibrarySettings.defaultIcon;
  const mergedIconSuggestions = Array.from(
    new Set([...normalizedIconSuggestions, defaultIcon]),
  );

  return {
    iconSuggestions:
      mergedIconSuggestions.length > 0
        ? mergedIconSuggestions
        : defaultLibrarySettings.iconSuggestions,
    defaultIcon,
  };
}

function loadCachedLibrarySnapshot(): CachedLibrarySnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      settings?: unknown;
      cards?: unknown;
      directoryName?: unknown;
      exportDirectoryName?: unknown;
      directoryPathSegments?: unknown;
    };

    const cardsSource = Array.isArray(parsed.cards) ? parsed.cards : [];
    const cards = cardsSource.reduce<CardRecord[]>((acc, entry) => {
      const expanded = expandStoredCardRecord(entry);
      if (!expanded) {
        return acc;
      }

      acc.push(expanded);
      return acc;
    }, []);

    return {
      settings: normalizeLibrarySettings(parsed.settings),
      cards: sortByNewest(cards),
      directoryName:
        typeof parsed.directoryName === "string" ? parsed.directoryName : "",
      exportDirectoryName:
        typeof parsed.exportDirectoryName === "string"
          ? parsed.exportDirectoryName
          : "",
      directoryPathSegments: Array.isArray(parsed.directoryPathSegments)
        ? parsed.directoryPathSegments.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

function saveCachedLibrarySnapshot(snapshot: CachedLibrarySnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const compactCards = snapshot.cards.map((entry) =>
      compactCardRecord(entry),
    );
    window.localStorage.setItem(
      LOCAL_CACHE_KEY,
      JSON.stringify({
        settings: snapshot.settings,
        cards: compactCards,
        directoryName: snapshot.directoryName,
        exportDirectoryName: snapshot.exportDirectoryName,
        directoryPathSegments: snapshot.directoryPathSegments,
      }),
    );
  } catch {
    // Local cache is best-effort; ignore storage quota and serialization errors.
  }
}

async function readLibraryFile(
  directoryHandle: DirectoryHandleLike,
  fileNameOverride?: string,
): Promise<LibraryReadResult> {
  const fileName = fileNameOverride ?? getLibraryFileName(directoryHandle);
  let handle: FileHandleLike;

  try {
    handle = await directoryHandle.getFileHandle(fileName, {
      create: false,
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        fileExists: false,
        data: emptyLibraryFile,
      };
    }

    throw error;
  }

  const file = await handle.getFile();
  const raw = await file.text();

  if (!raw.trim()) {
    return {
      fileExists: true,
      data: emptyLibraryFile,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCardLibraryFile>;
    if (!Array.isArray(parsed.cards)) {
      return {
        fileExists: true,
        data: emptyLibraryFile,
      };
    }

    const cards = parsed.cards.reduce<CardRecord[]>((acc, entry) => {
      const expanded = expandStoredCardRecord(entry);
      if (!expanded) {
        return acc;
      }

      acc.push(expanded);
      return acc;
    }, []);

    return {
      fileExists: true,
      data: {
        version: typeof parsed.version === "number" ? parsed.version : 1,
        settings: normalizeLibrarySettings(parsed.settings),
        cards,
      },
    };
  } catch {
    return {
      fileExists: true,
      data: emptyLibraryFile,
    };
  }
}

async function writeLibraryFile(
  directoryHandle: DirectoryHandleLike,
  payload: {
    version: number;
    settings: CardLibrarySettings;
    cards: CardRecord[];
  },
  fileNameOverride?: string,
) {
  const fileName = fileNameOverride ?? getLibraryFileName(directoryHandle);
  const handle = await directoryHandle.getFileHandle(fileName, {
    create: true,
  });

  const writable = await handle.createWritable();
  const compactPayload: StoredCardLibraryFile = {
    ...payload,
    cards: payload.cards.map((entry) => compactCardRecord(entry)),
  };
  await writable.write(JSON.stringify(compactPayload, null, 2));
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

function getGitBridge(): GitBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as WindowWithDirectoryPicker).enchuntedElectron?.git ?? null;
}

function getElectronFsBridge(): ElectronFsBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as WindowWithDirectoryPicker).enchuntedElectron?.fs ?? null;
}

function createNotFoundError(message: string) {
  const error = new Error(message);
  error.name = "NotFoundError";
  return error;
}

function createElectronFileHandle(filePath: string): FileHandleLike {
  return {
    getFile: async () => {
      const fsBridge = getElectronFsBridge();
      if (!fsBridge) {
        throw new Error("Electron filesystem bridge is unavailable.");
      }

      const text = await fsBridge.readTextFile(filePath);
      return {
        text: async () => text,
      } as File;
    },
    createWritable: async () => {
      const fsBridge = getElectronFsBridge();
      if (!fsBridge) {
        throw new Error("Electron filesystem bridge is unavailable.");
      }

      return {
        write: async (data: string | Blob) => {
          if (typeof data === "string") {
            await fsBridge.writeTextFile(filePath, data);
            return;
          }

          const bytes = new Uint8Array(await data.arrayBuffer());
          let binary = "";
          for (const value of bytes) {
            binary += String.fromCharCode(value);
          }
          await fsBridge.writeBinaryFile(filePath, btoa(binary));
        },
        close: async () => {},
      };
    },
  };
}

function createElectronDirectoryHandle(
  directoryPath: string,
): DirectoryHandleLike {
  return {
    name:
      directoryPath.split(/[\\/]/).filter(Boolean).pop() ?? "Selected folder",
    getFileHandle: async (fileName, options) => {
      const fsBridge = getElectronFsBridge();
      if (!fsBridge) {
        throw new Error("Electron filesystem bridge is unavailable.");
      }

      try {
        if (!(options?.create ?? false)) {
          const entries = await fsBridge.listDirectory(directoryPath);
          const matchingEntry = entries.find(
            (entry) => entry.kind === "file" && entry.name === fileName,
          );

          if (!matchingEntry) {
            throw createNotFoundError(`File not found: ${fileName}`);
          }
        }

        const result = await fsBridge.getFileHandle(
          directoryPath,
          fileName,
          options?.create ?? false,
        );
        return createElectronFileHandle(result.filePath);
      } catch (error) {
        if (isNotFoundError(error)) {
          throw error;
        }
        throw createNotFoundError(`File not found: ${fileName}`);
      }
    },
    getDirectoryHandle: async (directoryName, options) => {
      const fsBridge = getElectronFsBridge();
      if (!fsBridge) {
        throw new Error("Electron filesystem bridge is unavailable.");
      }

      try {
        if (!(options?.create ?? false)) {
          const entries = await fsBridge.listDirectory(directoryPath);
          const matchingEntry = entries.find(
            (entry) =>
              entry.kind === "directory" && entry.name === directoryName,
          );

          if (!matchingEntry) {
            throw createNotFoundError(`Directory not found: ${directoryName}`);
          }
        }

        const result = await fsBridge.getDirectoryHandle(
          directoryPath,
          directoryName,
          options?.create ?? false,
        );
        return createElectronDirectoryHandle(result.path);
      } catch (error) {
        if (isNotFoundError(error)) {
          throw error;
        }
        throw createNotFoundError(`Directory not found: ${directoryName}`);
      }
    },
    removeEntry: async (name, options) => {
      const fsBridge = getElectronFsBridge();
      if (!fsBridge) {
        throw new Error("Electron filesystem bridge is unavailable.");
      }

      await fsBridge.removeEntry(
        directoryPath,
        name,
        options?.recursive ?? false,
      );
    },
    entries: async function* () {
      const fsBridge = getElectronFsBridge();
      if (!fsBridge) {
        throw new Error("Electron filesystem bridge is unavailable.");
      }

      const entries = await fsBridge.listDirectory(directoryPath);
      for (const entry of entries) {
        yield [entry.name, { kind: entry.kind }];
      }
    },
    queryPermission: async () => "granted",
    requestPermission: async () => "granted",
  };
}

function formatGitUserLabel(repo: GitRepoInfo | null): string {
  if (!repo) {
    return "No local git user found";
  }

  if (repo.userName && repo.userEmail) {
    return `${repo.userName} <${repo.userEmail}>`;
  }

  return repo.userName ?? repo.userEmail ?? "No local git user found";
}

function buildGitMessage(prefix: string, repo: GitRepoInfo): string {
  const identitySuffix =
    repo.userName || repo.userEmail
      ? `Using ${formatGitUserLabel(repo)} from local git config.`
      : "No local git user name/email was found; push and pull may still work through SSH or stored credentials.";

  return `${prefix} ${identitySuffix}`;
}

function persistGitRepoPath(path: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (path) {
    window.localStorage.setItem(LOCAL_GIT_REPO_PATH_KEY, path);
    return;
  }

  window.localStorage.removeItem(LOCAL_GIT_REPO_PATH_KEY);
}

type CardBuilderProviderProps = {
  children: ReactNode;
};

export function CardBuilderProvider({ children }: CardBuilderProviderProps) {
  const [card, setCard] = useState<CardState>(defaultCard);
  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    cardThemes[0].id,
  );
  const [isColorControlsOpen, setIsColorControlsOpen] = useState(false);
  const [librarySettings, setLibrarySettings] = useState<CardLibrarySettings>(
    defaultLibrarySettings,
  );
  const [newIconValue, setNewIconValue] = useState("");
  const [artImage, setArtImage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"builder" | "library">(
    "builder",
  );
  const [currentLibraryPage, setCurrentLibraryPage] = useState(1);
  const [libraryCards, setLibraryCards] = useState<CardRecord[]>([]);
  const [rootDirectoryHandle, setRootDirectoryHandle] =
    useState<DirectoryHandleLike | null>(null);
  const [directoryHandle, setDirectoryHandle] =
    useState<DirectoryHandleLike | null>(null);
  const [directoryName, setDirectoryName] = useState<string>("");
  const [directoryPathSegments, setDirectoryPathSegments] = useState<string[]>(
    [],
  );
  const [subdirectories, setSubdirectories] = useState<string[]>([]);
  const [cardsFileExists, setCardsFileExists] = useState(false);
  const [isNavigatingDirectories, setIsNavigatingDirectories] = useState(false);
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
    "Choose a local folder to store {dirName}-cards.json",
  );
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [sheetSlots, setSheetSlots] = useState<(CardRecord | null)[]>([]);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [mismatchedJsonFileName, setMismatchedJsonFileName] = useState<
    string | null
  >(null);
  const [gitRepo, setGitRepo] = useState<GitRepoInfo | null>(null);
  const [gitMessage, setGitMessage] = useState(
    "Git sync is available only in the Electron desktop app.",
  );
  const [isGitAvailable, setIsGitAvailable] = useState(false);
  const [isGitBusy, setIsGitBusy] = useState(false);

  const [isPickerSupported, setIsPickerSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsPickerSupported(
      "showDirectoryPicker" in (window as WindowWithDirectoryPicker),
    );

    const gitAvailable = Boolean(getGitBridge());
    setIsGitAvailable(gitAvailable);
    setGitMessage(
      gitAvailable
        ? "Connect a git repo to enable pull and push with your local git credentials."
        : "Git sync is available only in the Electron desktop app.",
    );
  }, []);

  const totalLibraryPages = Math.max(
    1,
    Math.ceil(libraryCards.length / LIBRARY_PAGE_SIZE),
  );
  const paginatedLibraryCards = useMemo(() => {
    const startIndex = (currentLibraryPage - 1) * LIBRARY_PAGE_SIZE;
    return libraryCards.slice(startIndex, startIndex + LIBRARY_PAGE_SIZE);
  }, [currentLibraryPage, libraryCards]);

  const currentPathLabel = useMemo(() => {
    return formatFolderPath(
      directoryName || "Selected folder",
      directoryPathSegments,
    );
  }, [directoryName, directoryPathSegments]);

  const canGoUp = directoryPathSegments.length > 0;

  const reloadCardsFromFolder = useCallback(
    async (nextHandle: DirectoryHandleLike, statusPrefix = "Loaded") => {
      const libraryFileName = getLibraryFileName(nextHandle);
      const [libraryResult, childDirectories, fallbackJsonFileName] =
        await Promise.all([
          readLibraryFile(nextHandle),
          listSubdirectories(nextHandle),
          findFallbackJsonFileName(nextHandle),
        ]);
      const sorted = sortByNewest(libraryResult.data.cards);
      setLibrarySettings(libraryResult.data.settings);
      setLibraryCards(sorted);
      setCardsFileExists(libraryResult.fileExists);
      setMismatchedJsonFileName(
        !libraryResult.fileExists && fallbackJsonFileName !== libraryFileName
          ? fallbackJsonFileName
          : null,
      );
      setSubdirectories(childDirectories);
      setCurrentLibraryPage(1);

      if (!libraryResult.fileExists) {
        setStorageMessage(
          childDirectories.length > 0
            ? `No ${libraryFileName} in this folder. Choose a subdirectory or save a card to create one.`
            : `No ${libraryFileName} in this folder yet. Save a card to create one.`,
        );
        return;
      }

      setStorageMessage(
        `${statusPrefix} ${sorted.length} card${sorted.length === 1 ? "" : "s"}.`,
      );
    },
    [],
  );

  const openDirectoryHandle = useCallback(
    async (
      nextHandle: DirectoryHandleLike,
      nextDirectoryName?: string,
      statusPrefix = "Loaded",
    ) => {
      setRootDirectoryHandle(nextHandle);
      setDirectoryHandle(nextHandle);
      setDirectoryName(
        nextDirectoryName ?? nextHandle.name ?? "Selected folder",
      );
      setDirectoryPathSegments([]);
      await reloadCardsFromFolder(nextHandle, statusPrefix);
    },
    [reloadCardsFromFolder],
  );

  useEffect(() => {
    const cachedSnapshot = loadCachedLibrarySnapshot();
    if (!cachedSnapshot) {
      return;
    }

    setLibrarySettings(cachedSnapshot.settings);
    setLibraryCards(cachedSnapshot.cards);
    setCurrentLibraryPage(1);

    if (cachedSnapshot.directoryName) {
      setDirectoryName(cachedSnapshot.directoryName);
      setDirectoryPathSegments(cachedSnapshot.directoryPathSegments);
      setStorageMessage(
        `Recovered cache from ${cachedSnapshot.directoryName}. Reconnect to sync with disk.`,
      );
    }

    if (cachedSnapshot.exportDirectoryName) {
      setExportDirectoryName(cachedSnapshot.exportDirectoryName);
    }
  }, []);

  useEffect(() => {
    saveCachedLibrarySnapshot({
      settings: librarySettings,
      cards: libraryCards,
      directoryName,
      exportDirectoryName,
      directoryPathSegments,
    });
  }, [
    librarySettings,
    libraryCards,
    directoryName,
    exportDirectoryName,
    directoryPathSegments,
  ]);

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

        setRootDirectoryHandle(storedHandle);
        const rootName = storedHandle.name ?? "Selected folder";
        setDirectoryName(rootName);

        const cachedSnapshot = loadCachedLibrarySnapshot();
        const restoredPath = cachedSnapshot?.directoryPathSegments ?? [];

        let resolvedHandle = storedHandle;
        let resolvedPath = restoredPath;

        if (
          restoredPath.length > 0 &&
          supportsDirectoryBrowsing(storedHandle)
        ) {
          try {
            resolvedHandle = await resolveDirectoryFromPath(
              storedHandle,
              restoredPath,
            );
          } catch {
            resolvedPath = [];
            resolvedHandle = storedHandle;
          }
        }

        setDirectoryPathSegments(resolvedPath);
        setDirectoryHandle(resolvedHandle);
        await reloadCardsFromFolder(resolvedHandle, "Synced");
      } catch {
        setStorageMessage("Could not restore folder access.");
      }
    };

    void restoreFolder();
  }, [reloadCardsFromFolder]);

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

  useEffect(() => {
    const restoreGitRepo = async () => {
      if (!isGitAvailable || typeof window === "undefined") {
        return;
      }

      const bridge = getGitBridge();
      const storedRepoPath = window.localStorage.getItem(
        LOCAL_GIT_REPO_PATH_KEY,
      );

      if (!bridge || !storedRepoPath) {
        return;
      }

      setIsGitBusy(true);
      try {
        const result = await bridge.detectRepo(storedRepoPath);
        if (result.ok && result.repo) {
          setGitRepo(result.repo);
          persistGitRepoPath(result.repo.repoRoot);
          await openDirectoryHandle(
            createElectronDirectoryHandle(result.repo.repoRoot),
            result.repo.repoName,
            "Synced",
          );
          setGitMessage(
            buildGitMessage("Reconnected to saved git repo.", result.repo),
          );
          return;
        }

        persistGitRepoPath(null);
        setGitRepo(null);
        setGitMessage(result.message);
      } catch {
        setGitMessage("Could not restore the previously connected git repo.");
      } finally {
        setIsGitBusy(false);
      }
    };

    void restoreGitRepo();
  }, [isGitAvailable, openDirectoryHandle]);

  useEffect(() => {
    setIsColorControlsOpen(selectedThemeId === "");
  }, [selectedThemeId]);

  useEffect(() => {
    setCurrentLibraryPage((current) => Math.min(current, totalLibraryPages));
  }, [totalLibraryPages]);

  const onFieldChange =
    (key: keyof CardState) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
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
    setCard((current) => ({
      ...current,
      artOffsetX: defaultCard.artOffsetX,
      artOffsetY: defaultCard.artOffsetY,
    }));
  };

  const updateArtOffset = (x: number, y: number) => {
    setCard((current) => ({
      ...current,
      artOffsetX: x,
      artOffsetY: y,
    }));
  };

  const persistLibrarySettings = async (nextSettings: CardLibrarySettings) => {
    if (!directoryHandle) {
      return;
    }

    try {
      const granted = await ensureDirectoryPermission(directoryHandle, true);
      if (!granted) {
        setStorageMessage(
          "Cannot update icon settings without folder permission.",
        );
        return;
      }

      const currentLibrary = await readLibraryFile(directoryHandle);
      await writeLibraryFile(directoryHandle, {
        ...currentLibrary.data,
        settings: nextSettings,
      });
      setStorageMessage("Updated folder icon settings.");
    } catch {
      setStorageMessage("Could not persist icon settings.");
    }
  };

  const addLibraryIcon = () => {
    const icon = newIconValue.trim();
    if (!icon) {
      return;
    }

    if (librarySettings.iconSuggestions.includes(icon)) {
      setNewIconValue("");
      return;
    }

    const nextSettings: CardLibrarySettings = {
      ...librarySettings,
      iconSuggestions: [...librarySettings.iconSuggestions, icon],
    };
    setLibrarySettings(nextSettings);
    setNewIconValue("");
    void persistLibrarySettings(nextSettings);
  };

  const reorderLibraryIcons = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= librarySettings.iconSuggestions.length ||
      toIndex >= librarySettings.iconSuggestions.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const nextIconSuggestions = [...librarySettings.iconSuggestions];
    const [movedIcon] = nextIconSuggestions.splice(fromIndex, 1);
    if (!movedIcon) {
      return;
    }

    nextIconSuggestions.splice(toIndex, 0, movedIcon);

    const nextSettings: CardLibrarySettings = {
      iconSuggestions: nextIconSuggestions,
      defaultIcon: nextIconSuggestions[0],
    };

    setLibrarySettings(nextSettings);
    void persistLibrarySettings(nextSettings);
  };

  const removeLibraryIcon = (icon: string) => {
    if (librarySettings.iconSuggestions.length <= 1) {
      setStorageMessage(
        "At least one icon must remain in the folder icon list.",
      );
      return;
    }

    const nextIconSuggestions = librarySettings.iconSuggestions.filter(
      (value) => value !== icon,
    );

    const nextDefaultIcon =
      librarySettings.defaultIcon === icon
        ? nextIconSuggestions[0]
        : librarySettings.defaultIcon;

    const nextSettings: CardLibrarySettings = {
      iconSuggestions: nextIconSuggestions,
      defaultIcon: nextDefaultIcon,
    };

    setLibrarySettings(nextSettings);
    if (card.icon === icon) {
      setCard((current) => ({ ...current, icon: nextDefaultIcon }));
    }
    void persistLibrarySettings(nextSettings);
  };

  const onThemeColorFieldChange =
    (key: ThemeColorField) => (event: ChangeEvent<HTMLInputElement>) => {
      setSelectedThemeId("");
      onFieldChange(key)(event);
    };

  const applyTheme = (themeId: string) => {
    const theme = getThemeById(themeId);
    if (!theme) {
      return;
    }

    setSelectedThemeId(theme.id);
    setCard((current) => ({
      ...current,
      cardBackground: theme.cardBackground,
      artBackground: theme.artBackground,
      panelBackground: theme.panelBackground,
      frameAccent: theme.frameAccent,
      titleColor: theme.titleColor,
      bodyTextColor: theme.bodyTextColor,
    }));
  };

  const navigateToPath = async (
    rootHandle: DirectoryHandleLike,
    rootName: string,
    nextPathSegments: string[],
    statusPrefix = "Loaded",
  ) => {
    setIsNavigatingDirectories(true);

    try {
      const resolvedHandle = await resolveDirectoryFromPath(
        rootHandle,
        nextPathSegments,
      );
      setDirectoryHandle(resolvedHandle);
      setDirectoryPathSegments(nextPathSegments);
      setDirectoryName(rootName);
      await reloadCardsFromFolder(resolvedHandle, statusPrefix);
    } catch {
      setStorageMessage("Could not open that directory.");
    } finally {
      setIsNavigatingDirectories(false);
    }
  };

  const openSubdirectory = async (subdirectoryName: string) => {
    if (!rootDirectoryHandle) {
      return;
    }

    const rootName = rootDirectoryHandle.name ?? "Selected folder";
    const nextPath = [...directoryPathSegments, subdirectoryName];
    await navigateToPath(rootDirectoryHandle, rootName, nextPath, "Loaded");
  };

  const goUpDirectory = async () => {
    if (!rootDirectoryHandle || directoryPathSegments.length === 0) {
      return;
    }

    const rootName = rootDirectoryHandle.name ?? "Selected folder";
    const nextPath = directoryPathSegments.slice(0, -1);
    await navigateToPath(rootDirectoryHandle, rootName, nextPath, "Loaded");
  };

  const refreshCurrentDirectory = async () => {
    if (!directoryHandle) {
      return;
    }

    setIsNavigatingDirectories(true);
    try {
      await reloadCardsFromFolder(directoryHandle, "Reloaded");
    } finally {
      setIsNavigatingDirectories(false);
    }
  };

  const connectGitRepo = async () => {
    const bridge = getGitBridge();
    if (!bridge) {
      setGitMessage("Git sync is available only in the Electron desktop app.");
      return;
    }

    if (gitRepo) {
      const confirmed = window.confirm(
        `Disconnect from ${gitRepo.repoName} and choose a different git repo?`,
      );
      if (!confirmed) {
        setGitMessage(`Kept ${gitRepo.repoName} as the active git repo.`);
        return;
      }
    }

    setIsGitBusy(true);
    try {
      const result = await bridge.pickRepo();
      if (result.ok && result.repo) {
        setGitRepo(result.repo);
        persistGitRepoPath(result.repo.repoRoot);
        await openDirectoryHandle(
          createElectronDirectoryHandle(result.repo.repoRoot),
          result.repo.repoName,
          "Connected and loaded",
        );
        setGitMessage(
          buildGitMessage(`Connected to ${result.repo.repoName}.`, result.repo),
        );
        return;
      }

      if (result.code !== "cancelled") {
        setGitMessage(result.message);
      }
    } catch {
      setGitMessage("Could not connect to a git repo.");
    } finally {
      setIsGitBusy(false);
    }
  };

  const pullGitRepo = async () => {
    const bridge = getGitBridge();
    if (!bridge || !gitRepo) {
      setGitMessage("Connect a git repo before pulling changes.");
      return;
    }

    const confirmed = window.confirm(
      `Pull the latest changes into ${gitRepo.repoName} on branch ${gitRepo.branch}?`,
    );
    if (!confirmed) {
      setGitMessage(`Cancelled pull for ${gitRepo.repoName}.`);
      return;
    }

    setIsGitBusy(true);
    try {
      const result = await bridge.pullRepo(gitRepo.repoRoot);
      if (result.repo) {
        setGitRepo(result.repo);
        persistGitRepoPath(result.repo.repoRoot);
      }

      setGitMessage(
        result.ok && result.repo
          ? buildGitMessage(result.message, result.repo)
          : result.message,
      );
    } catch {
      setGitMessage("Git pull failed unexpectedly.");
    } finally {
      setIsGitBusy(false);
    }
  };

  const pushGitRepo = async (commitMessage?: string) => {
    const bridge = getGitBridge();
    if (!bridge || !gitRepo) {
      setGitMessage("Connect a git repo before pushing changes.");
      return;
    }

    const confirmed = window.confirm(
      `Push local commits from ${gitRepo.repoName} on branch ${gitRepo.branch} to the remote?`,
    );
    if (!confirmed) {
      setGitMessage(`Cancelled push for ${gitRepo.repoName}.`);
      return;
    }

    setIsGitBusy(true);
    try {
      const result = await bridge.pushRepo(
        gitRepo.repoRoot,
        commitMessage?.trim() ?? "",
      );
      if (result.repo) {
        setGitRepo(result.repo);
        persistGitRepoPath(result.repo.repoRoot);
      }

      setGitMessage(
        result.ok && result.repo
          ? buildGitMessage(result.message, result.repo)
          : result.message,
      );
    } catch {
      setGitMessage("Git push failed unexpectedly.");
    } finally {
      setIsGitBusy(false);
    }
  };

  const migrateJsonFileToDirectoryFormat = async (fileName: string) => {
    if (!directoryHandle) {
      setStorageMessage("Select a folder first.");
      return;
    }

    const targetFileName = getLibraryFileName(directoryHandle);
    if (fileName === targetFileName) {
      await refreshCurrentDirectory();
      return;
    }

    setIsNavigatingDirectories(true);
    try {
      const granted = await ensureDirectoryPermission(directoryHandle, true);
      if (!granted) {
        setStorageMessage("Cannot migrate JSON without folder permission.");
        return;
      }

      const sourceLibraryResult = await readLibraryFile(
        directoryHandle,
        fileName,
      );
      if (!sourceLibraryResult.fileExists) {
        setStorageMessage("That JSON file no longer exists.");
        await reloadCardsFromFolder(directoryHandle, "Reloaded");
        return;
      }

      await writeLibraryFile(
        directoryHandle,
        sourceLibraryResult.data,
        targetFileName,
      );

      if (directoryHandle.removeEntry) {
        await directoryHandle.removeEntry(fileName);
      }

      await reloadCardsFromFolder(directoryHandle, "Loaded");
      setStorageMessage(
        `Renamed ${fileName} to ${targetFileName} and loaded the library.`,
      );
    } catch {
      setStorageMessage("Could not migrate that JSON file.");
    } finally {
      setIsNavigatingDirectories(false);
    }
  };

  const createSubdirectory = async (rawName: string) => {
    if (!directoryHandle || !directoryHandle.getDirectoryHandle) {
      setStorageMessage(
        "This folder does not support creating subdirectories.",
      );
      return;
    }

    const name = sanitizeFolderName(rawName);
    if (!name) {
      setStorageMessage("Folder name cannot be empty.");
      return;
    }

    if (EXCLUDED_DIRECTORY_NAMES.has(name)) {
      setStorageMessage(
        `${name} is reserved and cannot be created from the app.`,
      );
      return;
    }

    setIsNavigatingDirectories(true);
    try {
      await directoryHandle.getDirectoryHandle(name, { create: true });
      await reloadCardsFromFolder(directoryHandle, "Reloaded");
      setStorageMessage(`Created folder ${name}.`);
    } catch {
      setStorageMessage("Could not create that folder.");
    } finally {
      setIsNavigatingDirectories(false);
    }
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

      setRootDirectoryHandle(selectedHandle);
      setDirectoryHandle(selectedHandle);
      setDirectoryName(selectedHandle.name ?? "Selected folder");
      setDirectoryPathSegments([]);
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

      const nextLibraryResult = await readLibraryFile(directoryHandle);
      if (!nextLibraryResult.fileExists) {
        const libraryFileName = getLibraryFileName(directoryHandle);
        const confirmed = window.confirm(
          `No ${libraryFileName} exists in ${currentPathLabel}. Create it and save this card?`,
        );
        if (!confirmed) {
          setStorageMessage(
            `Save cancelled. ${libraryFileName} was not created in ${currentPathLabel}.`,
          );
          return;
        }
      }

      const nextLibrary = {
        ...nextLibraryResult.data,
        cards: [...nextLibraryResult.data.cards],
      };
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

      nextLibrary.settings = librarySettings;

      await writeLibraryFile(directoryHandle, nextLibrary);
      const sorted = sortByNewest(nextLibrary.cards);
      setLibraryCards(sorted);
      setCardsFileExists(true);
      const libraryFileName = getLibraryFileName(directoryHandle);
      setStorageMessage(
        existingIndex >= 0
          ? `Updated ${nextRecord.name} in ${libraryFileName}.`
          : `Saved ${nextRecord.name} to ${libraryFileName}.`,
      );
      setActiveView("library");
    } catch {
      setStorageMessage("Save failed. Check folder permissions and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecord = async (record: CardRecord) => {
    if (!directoryHandle) {
      setStorageMessage("Select a folder first.");
      return;
    }

    const libraryFileName = getLibraryFileName(directoryHandle);
    const confirmed = window.confirm(
      `Delete ${record.name} from ${libraryFileName}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      const granted = await ensureDirectoryPermission(directoryHandle, true);
      if (!granted) {
        setStorageMessage("Cannot delete without folder write permission.");
        return;
      }

      const nextLibraryResult = await readLibraryFile(directoryHandle);
      const remainingCards = nextLibraryResult.data.cards.filter(
        (entry) => entry.id !== record.id,
      );

      if (remainingCards.length === nextLibraryResult.data.cards.length) {
        setStorageMessage(`${record.name} was already removed.`);
        return;
      }

      if (remainingCards.length === 0) {
        if (directoryHandle.removeEntry) {
          await directoryHandle.removeEntry(libraryFileName);
          setLibraryCards([]);
          setCardsFileExists(false);
          setCurrentLibraryPage(1);
          setStorageMessage(
            `Deleted ${record.name}. Removed empty ${libraryFileName}.`,
          );
          return;
        }

        setStorageMessage(
          `Deleted ${record.name}, but this folder handle cannot remove ${libraryFileName}.`,
        );
      }

      const nextLibrary = {
        ...nextLibraryResult.data,
        cards: remainingCards,
        settings: librarySettings,
      };

      await writeLibraryFile(directoryHandle, nextLibrary);
      const sorted = sortByNewest(remainingCards);
      setLibraryCards(sorted);
      setCardsFileExists(true);
      setCurrentLibraryPage((current) =>
        Math.min(current, Math.max(1, Math.ceil(sorted.length / LIBRARY_PAGE_SIZE))),
      );
      setStorageMessage(`Deleted ${record.name} from ${libraryFileName}.`);
    } catch {
      setStorageMessage("Delete failed. Check folder permissions and try again.");
    }
  };

  const loadRecordToBuilder = (record: CardRecord) => {
    const normalizedCard = ensureCardState(record.card);
    if (!normalizedCard) {
      setStorageMessage("This card entry is invalid and could not be loaded.");
      return;
    }

    const iconFromCard = normalizedCard.icon.trim();
    const libraryFileName = directoryHandle
      ? getLibraryFileName(directoryHandle)
      : "{dirName}-cards.json";
    let loadMessage = `Loaded ${record.name} from ${libraryFileName}.`;
    if (
      iconFromCard &&
      !librarySettings.iconSuggestions.includes(iconFromCard)
    ) {
      const nextSettings: CardLibrarySettings = {
        ...librarySettings,
        iconSuggestions: [...librarySettings.iconSuggestions, iconFromCard],
      };
      setLibrarySettings(nextSettings);
      void persistLibrarySettings(nextSettings);
      loadMessage = `Loaded ${record.name} from ${libraryFileName}. Restored missing icon ${iconFromCard} to the folder icon list.`;
    }

    setCard(normalizedCard);
    setArtImage(record.artImage);
    setSelectedThemeId(findThemeIdForCard(normalizedCard) ?? "");
    setActiveView("builder");
    setStorageMessage(loadMessage);
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

  const exportLibrarySheet = async () => {
    if (libraryCards.length === 0) {
      setStorageMessage("No saved cards to export as sheet.");
      return;
    }

    setIsExporting(true);

    try {
      const totalSlots = Math.max(
        SHEET_MIN_ROWS * SHEET_COLS,
        Math.ceil((libraryCards.length + 1) / SHEET_COLS) * SHEET_COLS,
      );
      const emptyCount = totalSlots - libraryCards.length - 1;
      const slots: (CardRecord | null)[] = [
        ...libraryCards,
        null, // hidden card placed directly after last card
        ...Array<null>(emptyCount).fill(null),
      ];

      setSheetSlots(slots);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      if (!sheetRef.current) {
        setStorageMessage("Sheet export target was not ready.");
        return;
      }

      const dataUrl = await toPng(sheetRef.current, {
        cacheBust: true,
        pixelRatio: 1,
      });

      downloadDataUrlAsPng(dataUrl, "card-sheet");
      const rows = totalSlots / SHEET_COLS;
      setStorageMessage(
        `Exported ${libraryCards.length} card${
          libraryCards.length === 1 ? "" : "s"
        } as TTS sheet PNG (${SHEET_COLS}×${rows} grid).`,
      );
    } catch {
      setStorageMessage("Sheet PNG export failed.");
    } finally {
      setIsExporting(false);
      setSheetSlots([]);
    }
  };

  const cardBuilderContextValue = {
    activeView,
    setActiveView,
    isFolderBusy,
    directoryConnected: Boolean(directoryHandle),
    pickCardsFolder,
    isSaving,
    saveCurrentCard,
    canSaveCard: Boolean(directoryHandle),
    isExporting,
    exportCurrentCard: async () => {
      await exportCardAsPng(card, artImage);
    },
    directoryLabel: directoryHandle ? currentPathLabel : "Not connected",
    exportDirectoryLabel: exportDirectoryName || "Not selected",
    storageMessage,
    gitMessage,
    isGitAvailable,
    isGitBusy,
    gitRepoConnected: Boolean(gitRepo),
    gitRepoLabel: gitRepo ? gitRepo.repoName : "Not connected",
    gitBranchLabel: gitRepo?.branch ?? "-",
    gitUserLabel: formatGitUserLabel(gitRepo),
    card,
    artImage,
    librarySettings,
    newIconValue,
    selectedThemeId,
    isColorControlsOpen,
    isPickerSupported,
    onFieldChange,
    updateDescriptionAlign: (
      descriptionAlign: CardState["descriptionAlign"],
    ) => {
      setCard((current) => ({ ...current, descriptionAlign }));
    },
    updateDescriptionPosition: (
      descriptionPosition: CardState["descriptionPosition"],
    ) => {
      setCard((current) => ({ ...current, descriptionPosition }));
    },
    setCardIcon: (icon: string) => {
      setCard((current) => ({ ...current, icon }));
    },
    setNewIconValue,
    addLibraryIcon,
    removeLibraryIcon,
    reorderLibraryIcons,
    onArtUpload,
    clearArt,
    centerArt: () => {
      updateArtOffset(50, 50);
    },
    updateArtOffset,
    applyTheme,
    toggleColorControls: () => {
      setIsColorControlsOpen((current) => !current);
    },
    onThemeColorFieldChange,
    resetBuilder: () => {
      clearArt();
      setCard({
        ...defaultCard,
        icon: librarySettings.defaultIcon,
      });
      setSelectedThemeId(cardThemes[0].id);
    },
    directoryHandleAvailable: Boolean(directoryHandle),
    cardsFileExists,
    mismatchedJsonFileName,
    currentPathLabel,
    subdirectories,
    canGoUp,
    isNavigatingDirectories,
    libraryCards,
    paginatedLibraryCards,
    currentLibraryPage,
    totalLibraryPages,
    pageSize: LIBRARY_PAGE_SIZE,
    isExportFolderBusy,
    exportDirectoryHandleAvailable: Boolean(exportDirectoryHandle),
    pickExportFolder: async () => {
      await pickExportFolder();
    },
    exportAllCardsAsPng,
    exportLibrarySheet,
    connectGitRepo,
    pullGitRepo,
    pushGitRepo,
    refreshCurrentDirectory,
    migrateJsonFileToDirectoryFormat,
    goUpDirectory,
    openSubdirectory,
    createSubdirectory,
    setCurrentLibraryPage,
    loadRecordToBuilder,
    exportRecordAsPng: async (entry: CardRecord) => {
      await exportCardAsPng(entry.card, entry.artImage);
    },
    deleteRecord,
  };

  return (
    <CardBuilderContext.Provider value={cardBuilderContextValue}>
      <div
        className="pointer-events-none fixed -left-2499.75 top-0 opacity-0"
        aria-hidden="true"
      >
        <div ref={exportRef}>
          <CardPreview card={exportCardState} artImage={exportArtImage} />
        </div>
      </div>
      <div
        className="pointer-events-none fixed -left-2499.75 top-0 opacity-0"
        aria-hidden="true"
      >
        <div
          ref={sheetRef}
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: SHEET_COLS * 320,
          }}
        >
          {sheetSlots.map((slot, index) => {
            const isHiddenSlot = index === libraryCards.length;
            if (slot !== null) {
              return (
                <StaticCardPreview
                  key={slot.id}
                  card={slot.card}
                  artImage={slot.artImage}
                />
              );
            }
            if (isHiddenSlot) {
              return <HiddenCardSlot key="__hidden__" />;
            }
            return (
              <div
                key={`__empty_${index}__`}
                style={{ width: 320, height: 448, flexShrink: 0 }}
              />
            );
          })}
        </div>
      </div>
      {children}
    </CardBuilderContext.Provider>
  );
}
