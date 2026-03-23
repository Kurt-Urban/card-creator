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

export type CardLibraryFile = {
  version: number;
  settings: CardLibrarySettings;
  cards: CardRecord[];
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
  footerLeft: "0",
  footerCenter: "0",
  footerRight: "0",
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
