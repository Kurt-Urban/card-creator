"use client";

import { FormEvent, useState } from "react";
import { CardRecord } from "../card-builder";
import { DirectoryNavigator } from "./DirectoryNavigator";
import { LibraryCardListItem } from "./LibraryCardListItem";

type LibrarySectionProps = {
  directoryConnected: boolean;
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
  isExporting: boolean;
  isExportFolderBusy: boolean;
  exportDirectoryHandleAvailable: boolean;
  gitMessage: string;
  isGitAvailable: boolean;
  isGitBusy: boolean;
  gitRepoConnected: boolean;
  gitRepoLabel: string;
  gitBranchLabel: string;
  gitUserLabel: string;
  onPickExportFolder: () => void;
  onExportAll: () => void;
  onExportSheet: () => void;
  onConnectGitRepo: () => void;
  onPullGitRepo: () => void;
  onPushGitRepo: (commitMessage?: string) => void;
  onReload: () => void;
  onMigrateJsonFile: (fileName: string) => void;
  onGoUpDirectory: () => void;
  onOpenSubdirectory: (name: string) => void;
  onRefreshDirectory: () => void;
  onCreateSubdirectory: (name: string) => void;
  onPageChange: (page: number) => void;
  onLoadRecord: (entry: CardRecord) => void;
  onExportRecord: (entry: CardRecord) => void;
};

export function LibrarySection({
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
  gitMessage,
  isGitAvailable,
  isGitBusy,
  gitRepoConnected,
  gitRepoLabel,
  gitBranchLabel,
  gitUserLabel,
  onPickExportFolder,
  onExportAll,
  onExportSheet,
  onConnectGitRepo,
  onPullGitRepo,
  onPushGitRepo,
  onReload,
  onMigrateJsonFile,
  onGoUpDirectory,
  onOpenSubdirectory,
  onRefreshDirectory,
  onCreateSubdirectory,
  onPageChange,
  onLoadRecord,
  onExportRecord,
}: LibrarySectionProps) {
  const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  const openPushDialog = () => {
    setCommitMessage("");
    setIsPushDialogOpen(true);
  };

  const closePushDialog = () => {
    setIsPushDialogOpen(false);
    setCommitMessage("");
  };

  const handlePushSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onPushGitRepo(commitMessage);
    closePushDialog();
  };

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-wide text-slate-100">
          Saved Cards
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPickExportFolder}
            disabled={isExportFolderBusy}
            className="rounded-lg border border-emerald-400/70 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExportFolderBusy
              ? "Choosing..."
              : exportDirectoryHandleAvailable
                ? "Change export folder"
                : "Choose export folder"}
          </button>
          {libraryCards.length > 0 && (
            <>
              <button
                type="button"
                onClick={onExportAll}
                disabled={isExporting}
                className="rounded-lg border border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? "Exporting..." : "Export all PNGs"}
              </button>
              <button
                type="button"
                onClick={onExportSheet}
                disabled={isExporting}
                className="rounded-lg border border-violet-500/70 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? "Exporting..." : "Export TTS sheet"}
              </button>
            </>
          )}
          {directoryHandleAvailable && (
            <button
              type="button"
              onClick={onReload}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300 hover:text-white"
            >
              Reload from JSON
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-700/80 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Git Sync</p>
            <p>Repo: {gitRepoConnected ? gitRepoLabel : "Not connected"}</p>
            {gitRepoConnected && (
              <>
                <p>Branch: {gitBranchLabel}</p>
                <p>User: {gitUserLabel}</p>
              </>
            )}
            <p className="text-slate-400">{gitMessage}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onConnectGitRepo}
              disabled={!isGitAvailable || isGitBusy}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGitBusy
                ? "Working..."
                : gitRepoConnected
                  ? "Change repo"
                  : "Connect repo"}
            </button>
            <button
              type="button"
              onClick={onPullGitRepo}
              disabled={!gitRepoConnected || isGitBusy}
              className="rounded-lg border border-sky-500/70 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Pull
            </button>
            <button
              type="button"
              onClick={openPushDialog}
              disabled={!gitRepoConnected || isGitBusy}
              className="rounded-lg border border-fuchsia-500/70 bg-fuchsia-500/10 px-3 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Push
            </button>
          </div>
        </div>
      </div>

      {isPushDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 space-y-1">
              <h3 className="text-lg font-semibold text-slate-100">
                Commit Message
              </h3>
              <p className="text-sm text-slate-400">
                Enter a commit message before pushing. Leave it blank to use an
                automatic filename-based message.
              </p>
            </div>
            <form className="space-y-4" onSubmit={handlePushSubmit}>
              <label
                className="block text-sm font-medium text-slate-200"
                htmlFor="push-commit-message"
              >
                Commit message
              </label>
              <input
                id="push-commit-message"
                type="text"
                value={commitMessage}
                onChange={(event) => {
                  setCommitMessage(event.target.value);
                }}
                placeholder="Update monsters-cards.json"
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closePushDialog}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-fuchsia-500/70 bg-fuchsia-500/10 px-3 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                >
                  Commit and Push
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!directoryConnected ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-900/20 p-4 text-sm text-amber-200">
          Choose a folder first, then cards will be read from the folder's{" "}
          <code>-cards.json</code> library file.
        </p>
      ) : libraryCards.length === 0 ? (
        <>
          <DirectoryNavigator
            currentPathLabel={currentPathLabel}
            subdirectories={subdirectories}
            fallbackJsonFileName={mismatchedJsonFileName}
            canGoUp={canGoUp}
            isBusy={isNavigatingDirectories}
            onGoUp={onGoUpDirectory}
            onOpenSubdirectory={onOpenSubdirectory}
            onRefresh={onRefreshDirectory}
            onCreateSubdirectory={onCreateSubdirectory}
            onConvertJsonFile={onMigrateJsonFile}
          />
          <p className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-4 text-sm text-slate-300">
            {cardsFileExists
              ? "No saved cards found yet. Save one from the builder tab."
              : "No library JSON file was found in this folder. Browse into a subdirectory or save a card to create one here."}
          </p>
        </>
      ) : (
        <div className="space-y-3">
          <DirectoryNavigator
            currentPathLabel={currentPathLabel}
            subdirectories={subdirectories}
            fallbackJsonFileName={mismatchedJsonFileName}
            canGoUp={canGoUp}
            isBusy={isNavigatingDirectories}
            onGoUp={onGoUpDirectory}
            onOpenSubdirectory={onOpenSubdirectory}
            onRefresh={onRefreshDirectory}
            onCreateSubdirectory={onCreateSubdirectory}
            onConvertJsonFile={onMigrateJsonFile}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
            <p>
              Showing {(currentLibraryPage - 1) * pageSize + 1}-
              {Math.min(currentLibraryPage * pageSize, libraryCards.length)} of{" "}
              {libraryCards.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onPageChange(Math.max(1, currentLibraryPage - 1))
                }
                disabled={currentLibraryPage === 1}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Prev
              </button>
              <span className="min-w-20 text-center text-xs text-slate-400">
                Page {currentLibraryPage} / {totalLibraryPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  onPageChange(
                    Math.min(totalLibraryPages, currentLibraryPage + 1),
                  )
                }
                disabled={currentLibraryPage === totalLibraryPages}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>

          <div className="max-h-[68vh] overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-950/60 p-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {paginatedLibraryCards.map((entry) => (
                <LibraryCardListItem
                  key={entry.id}
                  entry={entry}
                  isExporting={isExporting}
                  onLoad={onLoadRecord}
                  onExport={onExportRecord}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
