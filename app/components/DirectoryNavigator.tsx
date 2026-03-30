"use client";

import { FormEvent, useState } from "react";

type DirectoryNavigatorProps = {
  currentPathLabel: string;
  subdirectories: string[];
  fallbackJsonFileName?: string | null;
  canGoUp: boolean;
  isBusy: boolean;
  onGoUp: () => void;
  onOpenSubdirectory: (name: string) => void;
  onRefresh: () => void;
  onCreateSubdirectory: (name: string) => void;
  onDeleteSubdirectory: (name: string) => void;
  onConvertJsonFile?: (fileName: string) => void;
};

export function DirectoryNavigator({
  currentPathLabel,
  subdirectories,
  fallbackJsonFileName,
  canGoUp,
  isBusy,
  onGoUp,
  onOpenSubdirectory,
  onRefresh,
  onCreateSubdirectory,
  onDeleteSubdirectory,
  onConvertJsonFile,
}: DirectoryNavigatorProps) {
  const [newFolderName, setNewFolderName] = useState("");

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = newFolderName.trim();
    if (!candidate) {
      return;
    }

    onCreateSubdirectory(candidate);
    setNewFolderName("");
  };

  return (
    <section
      className="mb-4 rounded-xl border border-slate-700/80 bg-slate-950/70 p-4"
      aria-label="Folder navigation"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">
          Current folder: {currentPathLabel}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGoUp}
            disabled={!canGoUp || isBusy}
            aria-label="Go to parent folder"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Go Up a Folder
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isBusy}
            aria-label="Refresh folder contents"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={handleCreate}
      >
        <label htmlFor="new-subdirectory" className="sr-only">
          New folder name
        </label>
        <input
          id="new-subdirectory"
          type="text"
          value={newFolderName}
          onChange={(event) => {
            setNewFolderName(event.target.value);
          }}
          placeholder="New folder name"
          disabled={isBusy}
          className="min-w-56 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isBusy || newFolderName.trim().length === 0}
          className="rounded-lg border border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Create folder
        </button>
      </form>

      <div className="mt-3">
        <h3 className="text-sm font-semibold text-slate-200">
          Subdirectories and files
        </h3>
        {subdirectories.length === 0 && !fallbackJsonFileName ? (
          <p className="mt-2 text-sm text-slate-400">
            No subdirectories or convertible JSON files found in this folder.
          </p>
        ) : (
          <ul
            className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Subdirectory and file list"
          >
            {subdirectories.map((name) => (
              <li key={name} className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpenSubdirectory(name)}
                  disabled={isBusy}
                  aria-label={`Open subdirectory ${name}`}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-cyan-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSubdirectory(name)}
                  disabled={isBusy}
                  aria-label={`Delete subdirectory ${name}`}
                  className="rounded-lg border border-rose-500/70 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </li>
            ))}
            {fallbackJsonFileName && (
              <li key={fallbackJsonFileName} className="flex gap-2">
                <div className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-100">
                  {fallbackJsonFileName}
                </div>
                <button
                  type="button"
                  onClick={() => onConvertJsonFile?.(fallbackJsonFileName)}
                  disabled={isBusy || !onConvertJsonFile}
                  title="Converts this JSON file to this folder's expected -cards.json filename and loads it as the active library."
                  aria-label={`Convert ${fallbackJsonFileName} to folder library format`}
                  className="rounded-lg border border-cyan-500/70 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Convert
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
