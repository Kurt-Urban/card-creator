"use client";

import { useCardBuilderContext } from "./CardBuilderContext";

export function WorkspaceToolbar() {
  const {
    activeView,
    setActiveView,
    isFolderBusy,
    directoryConnected,
    pickCardsFolder,
    isSaving,
    saveCurrentCard,
    canSaveCard,
    isExporting,
    exportCurrentCard,
  } = useCardBuilderContext();

  const showBuilderActions = activeView === "builder";

  return (
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
          onClick={() => {
            void pickCardsFolder();
          }}
          disabled={isFolderBusy}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFolderBusy
            ? "Opening..."
            : directoryConnected
              ? "Reconnect folder"
              : "Choose cards folder"}
        </button>

        {showBuilderActions && (
          <>
            <button
              type="button"
              onClick={() => {
                void saveCurrentCard();
              }}
              disabled={!canSaveCard || isSaving}
              className="rounded-lg border border-cyan-500/80 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save card"}
            </button>
            <button
              type="button"
              onClick={() => {
                void exportCurrentCard();
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
  );
}
