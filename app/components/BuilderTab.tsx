"use client";

import { IconManagerSection } from "./IconManagerSection";
import { TextAndStatsSection } from "./TextAndStatsSection";
import { ThemeAppearanceSection } from "./ThemeAppearanceSection";
import { useCardBuilderContext } from "./CardBuilderContext";

export function BuilderTab() {
  const {
    card,
    librarySettings,
    newIconValue,
    selectedThemeId,
    isColorControlsOpen,
    isPickerSupported,
    onFieldChange,
    updateDescriptionAlign,
    updateDescriptionPosition,
    setCardIcon,
    setNewIconValue,
    addLibraryIcon,
    removeLibraryIcon,
    reorderLibraryIcons,
    onArtUpload,
    clearArt,
    centerArt,
    applyTheme,
    toggleColorControls,
    onThemeColorFieldChange,
    resetBuilder,
  } = useCardBuilderContext();

  return (
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
              onIconSelect={setCardIcon}
              onNewIconValueChange={setNewIconValue}
              onAddIcon={addLibraryIcon}
              onRemoveIcon={removeLibraryIcon}
              onReorderIcons={reorderLibraryIcons}
            />
          }
          onFieldChange={onFieldChange}
          onDescriptionAlignChange={updateDescriptionAlign}
          onDescriptionPositionChange={updateDescriptionPosition}
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
              onClick={centerArt}
              className="w-72 rounded-lg border border-slate-700 px-3 py-2 text-sm transition hover:border-slate-300"
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
          onToggleColorControls={toggleColorControls}
          onColorFieldChange={onThemeColorFieldChange}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={resetBuilder}
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
  );
}
