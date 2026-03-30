"use client";

import { CardPreview } from "./CardPreview";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { StorageStatusPanel } from "./StorageStatusPanel";
import { BuilderTab } from "./BuilderTab";
import { LibraryTab } from "./LibraryTab";
import { useCardBuilderContext } from "./CardBuilderContext";
import { CardBuilderProvider } from "./CardBuilderProvider";

function CardBuilderLayout() {
  const { card, artImage, updateArtOffset, activeView } =
    useCardBuilderContext();

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-indigo-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 lg:flex-row">
        <section className="flex w-full justify-center lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:w-105 lg:items-start">
          <CardPreview
            card={card}
            artImage={artImage}
            onArtOffsetChange={updateArtOffset}
          />
        </section>

        <section className="w-full rounded-3xl border border-slate-700/80 bg-slate-900/70 p-4 backdrop-blur sm:p-6">
          <WorkspaceToolbar />

          <StorageStatusPanel />

          {activeView === "builder" ? <BuilderTab /> : <LibraryTab />}
        </section>
      </div>
      <div
        className="pointer-events-none fixed bottom-3 right-4 select-none text-xs text-slate-600"
        aria-hidden="true"
      >
        v{import.meta.env.VITE_APP_VERSION}
      </div>
    </main>
  );
}

export function CardBuilderPage() {
  return (
    <CardBuilderProvider>
      <CardBuilderLayout />
    </CardBuilderProvider>
  );
}
