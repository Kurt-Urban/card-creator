"use client";

import { createContext, useContext } from "react";
import {
  CardLibrarySettings,
  CardRecord,
  CardState,
  ThemeColorField,
} from "../card-builder";

type CardBuilderContextValue = {
  activeView: "builder" | "library";
  setActiveView: (view: "builder" | "library") => void;
  isFolderBusy: boolean;
  directoryConnected: boolean;
  pickCardsFolder: () => Promise<void>;
  isSaving: boolean;
  saveCurrentCard: () => Promise<void>;
  canSaveCard: boolean;
  isExporting: boolean;
  exportCurrentCard: () => Promise<void>;
  directoryLabel: string;
  exportDirectoryLabel: string;
  storageMessage: string;
  card: CardState;
  artImage: string | null;
  librarySettings: CardLibrarySettings;
  newIconValue: string;
  selectedThemeId: string;
  isColorControlsOpen: boolean;
  isPickerSupported: boolean;
  onFieldChange: (
    key: keyof CardState,
  ) => (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  updateDescriptionAlign: (
    descriptionAlign: CardState["descriptionAlign"],
  ) => void;
  updateDescriptionPosition: (
    descriptionPosition: CardState["descriptionPosition"],
  ) => void;
  setCardIcon: (icon: string) => void;
  setNewIconValue: (value: string) => void;
  addLibraryIcon: () => void;
  removeLibraryIcon: (icon: string) => void;
  reorderLibraryIcons: (fromIndex: number, toIndex: number) => void;
  onArtUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  clearArt: () => void;
  centerArt: () => void;
  updateArtOffset: (x: number, y: number) => void;
  applyTheme: (themeId: string) => void;
  toggleColorControls: () => void;
  onThemeColorFieldChange: (
    key: ThemeColorField,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  resetBuilder: () => void;
  directoryHandleAvailable: boolean;
  cardsFileExists: boolean;
  mismatchedJsonFileName: string | null;
  currentPathLabel: string;
  subdirectories: string[];
  canGoUp: boolean;
  isNavigatingDirectories: boolean;
  libraryCards: CardRecord[];
  paginatedLibraryCards: CardRecord[];
  currentLibraryPage: number;
  totalLibraryPages: number;
  pageSize: number;
  isExportFolderBusy: boolean;
  exportDirectoryHandleAvailable: boolean;
  pickExportFolder: () => Promise<void>;
  exportAllCardsAsPng: () => Promise<void>;
  exportLibrarySheet: () => Promise<void>;
  refreshCurrentDirectory: () => Promise<void>;
  migrateJsonFileToDirectoryFormat: (fileName: string) => Promise<void>;
  goUpDirectory: () => Promise<void>;
  openSubdirectory: (name: string) => Promise<void>;
  createSubdirectory: (name: string) => Promise<void>;
  deleteSubdirectory: (name: string) => Promise<void>;
  setCurrentLibraryPage: (page: number) => void;
  loadRecordToBuilder: (entry: CardRecord) => void;
  exportRecordAsPng: (entry: CardRecord) => Promise<void>;
};

export const CardBuilderContext = createContext<CardBuilderContextValue | null>(
  null,
);

export function useCardBuilderContext(): CardBuilderContextValue {
  const context = useContext(CardBuilderContext);
  if (!context) {
    throw new Error(
      "useCardBuilderContext must be used within CardBuilderContext.Provider",
    );
  }

  return context;
}
