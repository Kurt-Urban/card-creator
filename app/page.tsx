"use client";

import {
  CardLibrarySettings,
  CardLibraryFile,
  CardRecord,
  CardState,
  cardThemes,
  defaultLibrarySettings,
  defaultCard,
  emptyLibraryFile,
  ensureCardState,
  getThemeById,
  sortByNewest,
  ThemeColorField,
} from "./card-builder";
import { IconManagerSection } from "./components/IconManagerSection";
import { LibrarySection } from "./components/LibrarySection";
import { TextAndStatsSection } from "./components/TextAndStatsSection";
import { ThemeAppearanceSection } from "./components/ThemeAppearanceSection";
import { toPng } from "html-to-image";
import Image from "next/image";
import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
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
const LIBRARY_PAGE_SIZE = 24;

type CardPreviewProps = {
  card: CardState;
  artImage: string | null;
  onArtOffsetChange?: (x: number, y: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function CardPreview({ card, artImage, onArtOffsetChange }: CardPreviewProps) {
  const cardBase = card.cardBackground || defaultCard.cardBackground;
  const panelBase = card.panelBackground || defaultCard.panelBackground;
  const artFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [isDraggingArt, setIsDraggingArt] = useState(false);
  const canDragArt = Boolean(artImage && onArtOffsetChange);
  const descriptionVerticalAlign: Record<
    CardState["descriptionPosition"],
    string
  > = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end",
  };

  const handleArtPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDragArt || !onArtOffsetChange) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startOffsetX: card.artOffsetX,
      startOffsetY: card.artOffsetY,
    };
    setIsDraggingArt(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleArtPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDragArt || !onArtOffsetChange || !dragStateRef.current) {
      return;
    }

    if (event.pointerId !== dragStateRef.current.pointerId) {
      return;
    }

    const frame = artFrameRef.current;
    if (!frame) {
      return;
    }

    const { width, height } = frame.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      return;
    }

    const deltaXPercent =
      ((event.clientX - dragStateRef.current.startPointerX) / width) * 100;
    const deltaYPercent =
      ((event.clientY - dragStateRef.current.startPointerY) / height) * 100;

    onArtOffsetChange(
      clamp(dragStateRef.current.startOffsetX + deltaXPercent, 0, 100),
      clamp(dragStateRef.current.startOffsetY + deltaYPercent, 0, 100),
    );
  };

  const handleArtPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !dragStateRef.current ||
      event.pointerId !== dragStateRef.current.pointerId
    ) {
      return;
    }

    dragStateRef.current = null;
    setIsDraggingArt(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <article
      className="relative h-[448px] w-[320px] shrink-0 rounded-[28px] border-8 border-black p-2 shadow-[0_30px_80px_rgba(0,0,0,0.65)] sm:h-[504px] sm:w-[360px] lg:h-[546px] lg:w-[390px]"
      style={{
        backgroundColor: cardBase,
        backgroundImage: `linear-gradient(170deg, ${cardBase}, rgba(0,0,0,0.85))`,
      }}
    >
      <div
        className="relative flex h-full flex-col gap-2 overflow-hidden rounded-[20px] border-2 p-3"
        style={{
          borderColor: card.frameAccent,
          backgroundColor: cardBase,
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.25))",
        }}
      >
        <header
          className="flex h-10 shrink-0 items-center justify-between rounded-xl border-2 px-3 py-1 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.06)]"
          style={{
            borderColor: card.frameAccent,
            backgroundColor: panelBase,
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
          ref={artFrameRef}
          className="relative min-h-0 flex-[0_0_45%] overflow-hidden rounded-xl border-2"
          style={{
            borderColor: card.frameAccent,
            backgroundColor: card.artBackground,
            touchAction: canDragArt ? "none" : "auto",
            cursor: canDragArt ? "pointer" : "default",
          }}
          onPointerDown={handleArtPointerDown}
          onPointerMove={handleArtPointerMove}
          onPointerUp={handleArtPointerUp}
          onPointerCancel={handleArtPointerUp}
          onDragStart={(event) => {
            event.preventDefault();
          }}
        >
          {artImage ? (
            <Image
              src={artImage}
              alt="Card art"
              fill
              sizes="390px"
              className={
                isDraggingArt
                  ? "pointer-events-none select-none object-cover"
                  : "select-none object-cover"
              }
              style={{
                objectPosition: `${card.artOffsetX}% ${card.artOffsetY}%`,
              }}
              draggable={false}
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
            backgroundColor: panelBase,
            backgroundImage:
              "linear-gradient(155deg, rgba(255,255,255,0.08), rgba(0,0,0,0.15))",
          }}
        >
          <div
            className="flex h-full flex-col overflow-y-auto"
            style={{
              justifyContent:
                descriptionVerticalAlign[card.descriptionPosition],
            }}
          >
            <p
              className="w-full whitespace-pre-wrap text-lg leading-relaxed"
              style={{
                color: card.bodyTextColor,
                textAlign: card.descriptionAlign,
              }}
            >
              {card.description || "Add your card description here."}
            </p>
          </div>
        </div>

        <footer
          className="grid h-10 shrink-0 grid-cols-3 rounded-xl border-2 px-4 py-1 text-2xl font-semibold"
          style={{
            borderColor: card.frameAccent,
            backgroundColor: panelBase,
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

    const parsedSettings =
      typeof parsed.settings === "object" && parsed.settings !== null
        ? (parsed.settings as Partial<CardLibrarySettings>)
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
      version: typeof parsed.version === "number" ? parsed.version : 1,
      settings: {
        iconSuggestions:
          mergedIconSuggestions.length > 0
            ? mergedIconSuggestions
            : defaultLibrarySettings.iconSuggestions,
        defaultIcon,
      },
      cards: parsed.cards.reduce<CardRecord[]>((acc, entry) => {
        if (typeof entry !== "object" || entry === null) {
          return acc;
        }

        const candidate = entry as Partial<CardRecord>;
        const normalizedCard = ensureCardState(candidate.card);

        if (
          typeof candidate.id !== "string" ||
          typeof candidate.name !== "string" ||
          typeof candidate.updatedAt !== "string" ||
          !normalizedCard
        ) {
          return acc;
        }

        acc.push({
          id: candidate.id,
          name: candidate.name,
          updatedAt: candidate.updatedAt,
          artImage:
            typeof candidate.artImage === "string" ? candidate.artImage : null,
          card: normalizedCard,
        });
        return acc;
      }, []),
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

  const [isPickerSupported, setIsPickerSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsPickerSupported(
      "showDirectoryPicker" in (window as WindowWithDirectoryPicker),
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

  const reloadCardsFromFolder = async (
    nextHandle: DirectoryHandleLike,
    statusPrefix = "Loaded",
  ) => {
    const data = await readLibraryFile(nextHandle);
    const sorted = sortByNewest(data.cards);
    setLibrarySettings(data.settings);
    setLibraryCards(sorted);
    setCurrentLibraryPage(1);
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
        ...currentLibrary,
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

      nextLibrary.settings = librarySettings;

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
    const normalizedCard = ensureCardState(record.card);
    if (!normalizedCard) {
      setStorageMessage("This card entry is invalid and could not be loaded.");
      return;
    }

    const iconFromCard = normalizedCard.icon.trim();
    let loadMessage = `Loaded ${record.name} from cards.json.`;
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
      loadMessage = `Loaded ${record.name} from cards.json. Restored missing icon ${iconFromCard} to the folder icon list.`;
    }

    setCard(normalizedCard);
    setArtImage(record.artImage);
    setSelectedThemeId("");
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
          <CardPreview
            card={card}
            artImage={artImage}
            onArtOffsetChange={updateArtOffset}
          />
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
                <TextAndStatsSection
                  card={card}
                  iconManager={
                    <IconManagerSection
                      icon={card.icon}
                      iconSuggestions={librarySettings.iconSuggestions}
                      defaultIcon={librarySettings.defaultIcon}
                      newIconValue={newIconValue}
                      onIconSelect={(icon) => {
                        setCard((current) => ({ ...current, icon }));
                      }}
                      onNewIconValueChange={setNewIconValue}
                      onAddIcon={addLibraryIcon}
                      onRemoveIcon={removeLibraryIcon}
                      onReorderIcons={reorderLibraryIcons}
                    />
                  }
                  onFieldChange={onFieldChange}
                  onDescriptionAlignChange={(descriptionAlign) => {
                    setCard((current) => ({ ...current, descriptionAlign }));
                  }}
                  onDescriptionPositionChange={(descriptionPosition) => {
                    setCard((current) => ({
                      ...current,
                      descriptionPosition,
                    }));
                  }}
                />

                <div className="space-y-3 xl:col-span-2">
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
                    <button
                      type="button"
                      onClick={() => {
                        updateArtOffset(50, 50);
                      }}
                      className="rounded-lg border w-72 border-slate-700 px-3 py-2 text-sm transition hover:border-slate-300"
                    >
                      Center image
                    </button>
                  </div>
                </div>

                <ThemeAppearanceSection
                  card={card}
                  selectedThemeId={selectedThemeId}
                  isColorControlsOpen={isColorControlsOpen}
                  onThemeChange={applyTheme}
                  onToggleColorControls={() => {
                    setIsColorControlsOpen((current) => !current);
                  }}
                  onColorFieldChange={onThemeColorFieldChange}
                />
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    clearArt();
                    setCard({
                      ...defaultCard,
                      icon: librarySettings.defaultIcon,
                    });
                    setSelectedThemeId(cardThemes[0].id);
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
            <LibrarySection
              directoryConnected={Boolean(directoryHandle)}
              directoryHandleAvailable={Boolean(directoryHandle)}
              libraryCards={libraryCards}
              paginatedLibraryCards={paginatedLibraryCards}
              currentLibraryPage={currentLibraryPage}
              totalLibraryPages={totalLibraryPages}
              pageSize={LIBRARY_PAGE_SIZE}
              isExporting={isExporting}
              isExportFolderBusy={isExportFolderBusy}
              exportDirectoryHandleAvailable={Boolean(exportDirectoryHandle)}
              onPickExportFolder={() => {
                void pickExportFolder();
              }}
              onExportAll={() => {
                void exportAllCardsAsPng();
              }}
              onReload={() => {
                if (!directoryHandle) {
                  return;
                }

                void reloadCardsFromFolder(directoryHandle, "Reloaded");
              }}
              onPageChange={setCurrentLibraryPage}
              onLoadRecord={loadRecordToBuilder}
              onExportRecord={(entry) => {
                void exportCardAsPng(entry.card, entry.artImage);
              }}
            />
          )}
        </section>
      </div>
    </main>
  );
}
