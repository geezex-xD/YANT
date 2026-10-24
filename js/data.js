export const ENGINES = {
  google: {
    name: "Google",
    search: "https://www.google.com/search?q=",
    home: "https://www.google.com/",
    image: "https://lens.google.com/",
  },
  duckduckgo: {
    name: "DuckDuckGo",
    search: "https://duckduckgo.com/?q=",
    home: "https://duckduckgo.com/",
    image: "https://lens.google.com/", // DuckDuckGo has no reverse image search; Lens is the closest match
  },
  bing: {
    name: "Bing",
    search: "https://www.bing.com/search?q=",
    home: "https://www.bing.com/",
    image: "https://www.bing.com/visualsearch",
  },
  yandex: {
    name: "Yandex",
    search: "https://yandex.com/search/?text=",
    home: "https://yandex.com/",
    image: "https://yandex.com/images/",
  },
};

export const GOOGLE_APPS = [
  ["Search", "https://www.google.com/"],
  ["Maps", "https://maps.google.com/"],
  ["YouTube", "https://www.youtube.com/"],
  ["Gmail", "https://mail.google.com/"],
  ["Drive", "https://drive.google.com/"],
  ["Calendar", "https://calendar.google.com/"],
  ["Meet", "https://meet.google.com/"],
  ["Photos", "https://photos.google.com/"],
  ["Gemini", "https://gemini.google.com/"],
  ["News", "https://news.google.com/"],
  ["Translate", "https://translate.google.com/"],
  ["Docs", "https://docs.google.com/document/"],
  ["Sheets", "https://docs.google.com/spreadsheets/"],
  ["Slides", "https://docs.google.com/presentation/"],
  ["Forms", "https://docs.google.com/forms/"],
  ["Keep", "https://keep.google.com/"],
  ["Contacts", "https://contacts.google.com/"],
  ["Chat", "https://chat.google.com/"],
  ["Play", "https://play.google.com/"],
  ["Shopping", "https://shopping.google.com/"],
  ["Books", "https://books.google.com/"],
  ["Finance", "https://www.google.com/finance/"],
  ["Earth", "https://earth.google.com/"],
].map(([name, url]) => ({ name, url }));

export const ACCOUNT_URL = "https://myaccount.google.com/";
export const MAX_SHORTCUTS = 10;

export const SOLID_SWATCHES = [
  "#ffffff", "#e8eaed", "#202124", "#000000",
  "#e8def8", "#d3e3fd", "#c4eed0", "#fde293", "#f9dedc", "#3c2a4d",
];

export const GRADIENT_PRESETS = [
  { id: "sunset", c1: "#f6d365", c2: "#fda085", name: "Sunset" },
  { id: "ocean", c1: "#2193b0", c2: "#6dd5ed", name: "Ocean" },
  { id: "forest", c1: "#134e5e", c2: "#71b280", name: "Forest" },
  { id: "berry", c1: "#8e2de2", c2: "#4a00e0", name: "Berry" },
  { id: "midnight", c1: "#232526", c2: "#414345", name: "Midnight" },
];

export const SEED_SWATCHES = [
  "#6750a4", "#1a73e8", "#00897b", "#188038", "#f9ab00", "#d93025", "#c2185b", "#795548",
];

export const DEFAULTS = {
  engine: "google",
  themeMode: "auto", // auto | light | dark
  seed: "auto", // "auto" | #rrggbb
  headingColor: "auto", // auto | light | dark
  hasImage: false,
  hasAvatar: false,
  bg: {
    type: "gradient", // solid | gradient | image
    solid: null, // null = theme color
    gradient: { preset: "theme", c1: "#f6d365", c2: "#fda085", angle: 135 },
    fit: "cover", // cover | contain | stretch
  },
  shortcuts: [
    { name: "Gmail", url: "https://mail.google.com/" },
    { name: "YouTube", url: "https://www.youtube.com/" },
    { name: "ChatGPT", url: "https://chatgpt.com/" },
    { name: "Claude", url: "https://claude.ai/" },
  ],
};
