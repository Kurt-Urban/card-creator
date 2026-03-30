"use client";

import { LibrarySection } from "./LibrarySection";
import { useCardBuilderContext } from "./CardBuilderContext";

export function LibraryTab() {
  const {
    directoryConnected,
    directoryHandleAvailable,
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
    pageSize,
    isExporting,
    isExportFolderBusy,
    exportDirectoryHandleAvailable,
    pickExportFolder,
    exportAllCardsAsPng,
    exportLibrarySheet,
    refreshCurrentDirectory,
    migrateJsonFileToDirectoryFormat,
    goUpDirectory,
    openSubdirectory,
    createSubdirectory,
    deleteSubdirectory,
    setCurrentLibraryPage,
    loadRecordToBuilder,
    exportRecordAsPng,
  } = useCardBuilderContext();

  return (
    <LibrarySection
      directoryConnected={directoryConnected}
      directoryHandleAvailable={directoryHandleAvailable}
      cardsFileExists={cardsFileExists}
      mismatchedJsonFileName={mismatchedJsonFileName}
      currentPathLabel={currentPathLabel}
      subdirectories={subdirectories}
      canGoUp={canGoUp}
      isNavigatingDirectories={isNavigatingDirectories}
      libraryCards={libraryCards}
      paginatedLibraryCards={paginatedLibraryCards}
      currentLibraryPage={currentLibraryPage}
      totalLibraryPages={totalLibraryPages}
      pageSize={pageSize}
      isExporting={isExporting}
      isExportFolderBusy={isExportFolderBusy}
      exportDirectoryHandleAvailable={exportDirectoryHandleAvailable}
      onPickExportFolder={() => {
        void pickExportFolder();
      }}
      onExportAll={() => {
        void exportAllCardsAsPng();
      }}
      onExportSheet={() => {
        void exportLibrarySheet();
      }}
      onReload={() => {
        void refreshCurrentDirectory();
      }}
      onMigrateJsonFile={(fileName) => {
        void migrateJsonFileToDirectoryFormat(fileName);
      }}
      onGoUpDirectory={() => {
        void goUpDirectory();
      }}
      onOpenSubdirectory={(name) => {
        void openSubdirectory(name);
      }}
      onRefreshDirectory={() => {
        void refreshCurrentDirectory();
      }}
      onCreateSubdirectory={(name) => {
        void createSubdirectory(name);
      }}
      onDeleteSubdirectory={(name) => {
        void deleteSubdirectory(name);
      }}
      onPageChange={setCurrentLibraryPage}
      onLoadRecord={loadRecordToBuilder}
      onExportRecord={(entry) => {
        void exportRecordAsPng(entry);
      }}
    />
  );
}
