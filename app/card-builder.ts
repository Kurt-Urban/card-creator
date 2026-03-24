export type CardState = {
  title: string;
  icon: string;
  description: string;
  descriptionAlign: "left" | "center" | "right";
  descriptionPosition: "top" | "center" | "bottom";
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  cardBackground: string;
  artBackground: string;
  panelBackground: string;
  frameAccent: string;
  titleColor: string;
  bodyTextColor: string;
  artOffsetX: number;
  artOffsetY: number;
};

export type CardTheme = {
  id: string;
  label: string;
  cardBackground: string;
  artBackground: string;
  panelBackground: string;
  frameAccent: string;
  titleColor: string;
  bodyTextColor: string;
};

export type CardRecord = {
  id: string;
  name: string;
  card: CardState;
  artImage: string | null;
  updatedAt: string;
};

export type StoredCardRecord = {
  id: string;
  name: string;
  updatedAt: string;
  artImage?: string | null;
  themeId?: string;
  card?: Partial<CardState>;
};

export type CardLibraryFile = {
  version: number;
  settings: CardLibrarySettings;
  cards: CardRecord[];
};

export type StoredCardLibraryFile = {
  version: number;
  settings: CardLibrarySettings;
  cards: StoredCardRecord[];
};

export type CardLibrarySettings = {
  iconSuggestions: string[];
  defaultIcon: string;
};

export const defaultCard: CardState = {
  title: "Title",
  icon: "💧",
  description: "Description",
  descriptionAlign: "center",
  descriptionPosition: "center",
  footerLeft: "",
  footerCenter: "",
  footerRight: "",
  cardBackground: "#0b1020",
  artBackground: "#11356f",
  panelBackground: "#1f3d8d",
  frameAccent: "#4fa2ff",
  titleColor: "#f6f7ff",
  bodyTextColor: "#eff6ff",
  artOffsetX: 50,
  artOffsetY: 50,
};

export const cardThemes: CardTheme[] = [
  {
    id: "blue",
    label: "Blue",
    cardBackground: "#0b1020",
    artBackground: "#11356f",
    panelBackground: "#1f3d8d",
    frameAccent: "#4fa2ff",
    titleColor: "#f6f7ff",
    bodyTextColor: "#eff6ff",
  },
  {
    id: "red",
    label: "Red",
    cardBackground: "#221008",
    artBackground: "#5f1408",
    panelBackground: "#7c2d12",
    frameAccent: "#ff8a3d",
    titleColor: "#fff4e8",
    bodyTextColor: "#fff0dc",
  },
  {
    id: "green",
    label: "Green",
    cardBackground: "#102219",
    artBackground: "#114d3f",
    panelBackground: "#1a7a5d",
    frameAccent: "#70e1ae",
    titleColor: "#effff7",
    bodyTextColor: "#e2fff2",
  },
  {
    id: "purple",
    label: "Purple",
    cardBackground: "#190f2b",
    artBackground: "#33135d",
    panelBackground: "#4f1f88",
    frameAccent: "#d2a8ff",
    titleColor: "#fbf5ff",
    bodyTextColor: "#f4ebff",
  },
  {
    id: "yellow",
    label: "Yellow",
    cardBackground: "#2a200b",
    artBackground: "#6e5310",
    panelBackground: "#9a7212",
    frameAccent: "#ffd776",
    titleColor: "#fff8e5",
    bodyTextColor: "#fff3cf",
  },
];

export const iconSuggestions = ["💧", "🔥", "🌿", "✨", "🛡", "🟡", "🔵", "🔴"];

export const defaultLibrarySettings: CardLibrarySettings = {
  iconSuggestions,
  defaultIcon: defaultCard.icon,
};

export const emptyLibraryFile: CardLibraryFile = {
  version: 1,
  settings: defaultLibrarySettings,
  cards: [],
};

export type ThemeColorField =
  | "cardBackground"
  | "artBackground"
  | "panelBackground"
  | "frameAccent"
  | "titleColor"
  | "bodyTextColor";

export const themeColorFields: ThemeColorField[] = [
  "cardBackground",
  "artBackground",
  "panelBackground",
  "frameAccent",
  "titleColor",
  "bodyTextColor",
];

export function sortByNewest(cards: CardRecord[]): CardRecord[] {
  return [...cards].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function ensureCardState(value: unknown): CardState | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<CardState>;
  return {
    ...defaultCard,
    ...candidate,
  };
}

export function getThemeById(themeId: string): CardTheme | undefined {
  return cardThemes.find((theme) => theme.id === themeId);
}

export function findThemeIdForCard(card: CardState): string | undefined {
  return cardThemes.find((theme) =>
    themeColorFields.every((field) => card[field] === theme[field]),
  )?.id;
}

export function compactCardRecord(record: CardRecord): StoredCardRecord {
  const themeId = findThemeIdForCard(record.card);
  const compactCard: Partial<CardState> = {};

  for (const key of Object.keys(defaultCard) as Array<keyof CardState>) {
    if (key === "artOffsetX" || key === "artOffsetY") {
      continue;
    }

    if (themeId && themeColorFields.includes(key as ThemeColorField)) {
      continue;
    }

    if (record.card[key] !== defaultCard[key]) {
      (compactCard as Partial<Record<keyof CardState, unknown>>)[key] =
        record.card[key];
    }
  }

  if (record.artImage) {
    if (record.card.artOffsetX !== defaultCard.artOffsetX) {
      compactCard.artOffsetX = record.card.artOffsetX;
    }

    if (record.card.artOffsetY !== defaultCard.artOffsetY) {
      compactCard.artOffsetY = record.card.artOffsetY;
    }
  }

  return {
    id: record.id,
    name: record.name,
    updatedAt: record.updatedAt,
    ...(record.artImage ? { artImage: record.artImage } : {}),
    ...(themeId ? { themeId } : {}),
    ...(Object.keys(compactCard).length > 0 ? { card: compactCard } : {}),
  };
}

export function expandStoredCardRecord(value: unknown): CardRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<StoredCardRecord>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  const cardInput =
    typeof candidate.card === "object" && candidate.card !== null
      ? (candidate.card as Partial<CardState>)
      : {};
  const theme =
    typeof candidate.themeId === "string"
      ? getThemeById(candidate.themeId)
      : undefined;

  const nextCard: CardState = {
    ...defaultCard,
    ...(theme
      ? {
          cardBackground: theme.cardBackground,
          artBackground: theme.artBackground,
          panelBackground: theme.panelBackground,
          frameAccent: theme.frameAccent,
          titleColor: theme.titleColor,
          bodyTextColor: theme.bodyTextColor,
        }
      : {}),
    ...cardInput,
  };

  const artImage =
    typeof candidate.artImage === "string" ? candidate.artImage : null;
  if (!artImage) {
    nextCard.artOffsetX = defaultCard.artOffsetX;
    nextCard.artOffsetY = defaultCard.artOffsetY;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    updatedAt: candidate.updatedAt,
    artImage,
    card: nextCard,
  };
}
