"use client";

import { CardRecord } from "../card-builder";
import { LibraryCardListItem } from "./LibraryCardListItem";

type LibrarySectionProps = {
  directoryConnected: boolean;
  directoryHandleAvailable: boolean;
  libraryCards: CardRecord[];
  paginatedLibraryCards: CardRecord[];
  currentLibraryPage: number;
  totalLibraryPages: number;
  pageSize: number;
  isExporting: boolean;
  isExportFolderBusy: boolean;
  exportDirectoryHandleAvailable: boolean;
  onPickExportFolder: () => void;
  onExportAll: () => void;
  onReload: () => void;
  onPageChange: (page: number) => void;
  onLoadRecord: (entry: CardRecord) => void;
  onExportRecord: (entry: CardRecord) => void;
};

export function LibrarySection({
  directoryConnected,
  directoryHandleAvailable,
  libraryCards,
  paginatedLibraryCards,
  currentLibraryPage,
  totalLibraryPages,
  pageSize,
  isExporting,
  isExportFolderBusy,
  exportDirectoryHandleAvailable,
  onPickExportFolder,
  onExportAll,
  onReload,
  onPageChange,
  onLoadRecord,
  onExportRecord,
}: LibrarySectionProps) {
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
            <button
              type="button"
              onClick={onExportAll}
              disabled={isExporting}
              className="rounded-lg border border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? "Exporting..." : "Export all PNGs"}
            </button>
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

      {!directoryConnected ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-900/20 p-4 text-sm text-amber-200">
          Choose a folder first, then cards will be read from cards.json in that
          folder.
        </p>
      ) : libraryCards.length === 0 ? (
        <p className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-4 text-sm text-slate-300">
          No saved cards found yet. Save one from the builder tab.
        </p>
      ) : (
        <div className="space-y-3">
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
