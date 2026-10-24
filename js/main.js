import { buildScheme, detectAccent, hexToLch, luminance } from "./color.js";
import {
  ACCOUNT_URL,
  ENGINES,
  GOOGLE_APPS,
  GRADIENT_PRESETS,
  MAX_SHORTCUTS,
  DEFAULTS,
  SEED_SWATCHES,
  SOLID_SWATCHES,
} from "./data.js";
import { deleteFile, getFile, loadSettings, putFile, saveSettings } from "./storage.js";
import { closeMenu, favicon, h, hydrateIcons, icon, menuIsOpen, openMenu, toast, toggleMenu } from "./ui.js";

const $ = (sel, root = document) => root.querySelector(sel);
const body = document.body;
const root = document.documentElement;

let S = loadSettings();
const state = {
  scheme: null,
  bgUrl: null,
  avatarUrl: null,
  sbTab: "gradient",
  editing: null, // shortcut index being edited, or null when adding
  tileIndex: null, // shortcut whose menu is open
  accent: undefined, // cached detectAccent() result
};
const darkQuery = matchMedia("(prefers-color-scheme: dark)");

const save = () => saveSettings(S);

// =============================================================================================
// Theme (Material You)
// =============================================================================================
const isDark = () => S.themeMode === "dark" || (S.themeMode === "auto" && darkQuery.matches);

function seedHex() {
  if (S.seed !== "auto") return S.seed;
  if (state.accent === undefined) state.accent = detectAccent();
  return state.accent || "#1a73e8"; // Chrome's default blue when the browser doesn't share an accent
}

function applyTheme() {
  const dark = isDark();
  const scheme = buildScheme(seedHex(), dark);
  state.scheme = scheme;
  root.style.colorScheme = dark ? "dark" : "light";
  for (const [role, value] of Object.entries(scheme)) root.style.setProperty(`--md-${role}`, value);
  applyBackground();
}

function applyBackground() {
  const bgEl = $("#bg");
  const { bg } = S;
  const sch = state.scheme;
  const useImage = bg.type === "image" && !!state.bgUrl;
  let lum;

  bgEl.removeAttribute("style");
  if (useImage) {
    bgEl.style.backgroundImage = `url("${state.bgUrl}")`;
    bgEl.style.backgroundSize = { cover: "cover", contain: "contain", stretch: "100% 100%" }[bg.fit] || "cover";
    bgEl.style.backgroundColor = sch["surface-container-high"];
  } else if (bg.type === "solid") {
    const color = bg.solid || sch["primary-container"];
    bgEl.style.background = color;
    lum = luminance(color);
  } else {
    const g = bg.gradient;
    const useTheme = g.preset === "theme";
    const c1 = useTheme ? sch["primary-container"] : g.c1;
    const c2 = useTheme ? sch["tertiary-container"] : g.c2;
    bgEl.style.background = `linear-gradient(${g.angle}deg, ${c1}, ${c2})`;
    lum = (luminance(c1) + luminance(c2)) / 2;
  }

  let light;
  if (S.headingColor === "light") light = true;
  else if (S.headingColor === "dark") light = false;
  else light = useImage ? true : lum < 0.25;

  body.classList.toggle("has-image", useImage);
  body.classList.toggle("text-dark", !light);
  root.style.setProperty("--on-bg", light ? "#ffffff" : "#1f1f1f");
  root.style.setProperty(
    "--tile-bg",
    light
      ? `color-mix(in srgb, ${sch["tile-dark"]} 88%, transparent)`
      : `color-mix(in srgb, ${sch["tile-light"]} 92%, transparent)`,
  );
  root.style.setProperty("--tile-fg", light ? "#ffffff" : "#1f1f1f");
}

darkQuery.addEventListener("change", () => {
  if (S.themeMode === "auto") {
    applyTheme();
    renderSidebar();
  }
});

// =============================================================================================
// Search
// =============================================================================================
const logo = $("#logo");
const input = $("#q");
const engineBtn = $("#engine-btn");
const engineMenu = $("#engine-menu");

function renderEngine() {
  const e = ENGINES[S.engine] || ENGINES.google;
  logo.textContent = e.name;
  input.placeholder = `Ask ${e.name}`;
  input.setAttribute("aria-label", `Ask ${e.name}`);
  $("#engine-label").textContent = e.name;
  $("#engine-fav").replaceChildren(favicon(e.home, e.name));
}

function buildEngineMenu() {
  engineMenu.replaceChildren(
    ...Object.entries(ENGINES).map(([id, e]) => {
      const selected = id === S.engine;
      const item = h(
        "button",
        { class: "menu-item", type: "button", role: "menuitemradio", "aria-checked": String(selected) },
        favicon(e.home, e.name),
        h("span", { class: "grow", text: e.name }),
        selected ? icon("check", 20, "check") : null,
      );
      item.addEventListener("click", () => {
        S.engine = id;
        save();
        renderEngine();
        closeMenu();
        input.focus();
      });
      return item;
    }),
  );
}

engineBtn.addEventListener("click", () => {
  buildEngineMenu();
  toggleMenu(engineMenu, engineBtn, { align: "right" });
});

const looksLikeUrl = (t) =>
  /^https?:\/\/\S+$/i.test(t) || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(t);

function submitSearch() {
  const text = input.value.trim();
  if (!text) return;
  const e = ENGINES[S.engine];
  location.href = looksLikeUrl(text)
    ? (/^https?:\/\//i.test(text) ? text : `https://${text}`)
    : e.search + encodeURIComponent(text);
}

$("#search-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  submitSearch();
});
$("#plus-btn").addEventListener("click", () => input.focus());
$("#lens-btn").addEventListener("click", () => {
  location.href = ENGINES[S.engine].image;
});

let recognizer = null;
$("#mic-btn").addEventListener("click", (ev) => {
  const btn = ev.currentTarget;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return toast("Voice search isn’t available in this browser.");
  if (recognizer) return recognizer.stop();
  recognizer = new Recognition();
  recognizer.lang = navigator.language || "en-US";
  recognizer.interimResults = true;
  recognizer.onresult = (e) => {
    input.value = [...e.results].map((r) => r[0].transcript).join("");
    if (e.results[e.results.length - 1].isFinal) submitSearch();
  };
  recognizer.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      toast("Microphone access was blocked. Allow it in the site settings for this page.");
    } else if (e.error !== "no-speech" && e.error !== "aborted") {
      toast("Voice search failed. Check your connection and try again.");
    }
  };
  recognizer.onend = () => {
    btn.classList.remove("listening");
    recognizer = null;
  };
  btn.classList.add("listening");
  recognizer.start();
});

// =============================================================================================
// Apps menu and account menu
// =============================================================================================
const appsBtn = $("#apps-btn");
const appsMenu = $("#apps-menu");
appsMenu.replaceChildren(
  ...GOOGLE_APPS.map((app) =>
    h("a", { class: "app-item", role: "menuitem", href: app.url }, favicon(app.url, app.name), h("span", { text: app.name })),
  ),
);
appsBtn.addEventListener("click", () => toggleMenu(appsMenu, appsBtn, { align: "right" }));

const avatarBtn = $("#avatar-btn");
const accountMenu = $("#account-menu");
$("#account-menu a").href = ACCOUNT_URL;
avatarBtn.addEventListener("click", () => toggleMenu(accountMenu, avatarBtn, { align: "right" }));

function renderAvatar() {
  const targets = [avatarBtn, $("#account-avatar"), $("#sb-avatar")];
  for (const el of targets) {
    el.replaceChildren(
      state.avatarUrl ? h("img", { src: state.avatarUrl, alt: "", draggable: "false" }) : icon("person", el === avatarBtn ? 20 : 28),
    );
  }
}

// =============================================================================================
// Shortcuts
// =============================================================================================
const shortcutList = $("#shortcuts");
const tileMenu = $("#tile-menu");

function renderShortcuts() {
  const items = S.shortcuts.map((s, i) => {
    const more = h("button", { class: "tile-more", type: "button", "aria-label": `Options for ${s.name}`, "aria-haspopup": "menu", "aria-expanded": "false" });
    more.append(icon("more", 16));
    more.addEventListener("click", () => {
      state.tileIndex = i;
      toggleMenu(tileMenu, more, { align: "left" });
    });
    return h(
      "li",
      { class: "tile" },
      h("a", { href: s.url, title: s.name }, h("span", { class: "tile-icon" }, favicon(s.url, s.name)), h("span", { class: "shortcut-label", text: s.name })),
      more,
    );
  });

  if (S.shortcuts.length < MAX_SHORTCUTS) {
    const add = h(
      "button",
      { class: "tile-add", type: "button" },
      h("span", { class: "tile-icon" }, icon("add", 24)),
      h("span", { class: "shortcut-label", text: "Add shortcut" }),
    );
    add.addEventListener("click", () => openShortcutDialog(null));
    items.push(h("li", { class: "tile" }, add));
  }
  shortcutList.replaceChildren(...items);
}

$("#tile-edit").addEventListener("click", () => {
  const i = state.tileIndex;
  closeMenu();
  if (i != null) openShortcutDialog(i);
});
$("#tile-remove").addEventListener("click", () => {
  const i = state.tileIndex;
  closeMenu();
  if (i == null) return;
  S.shortcuts.splice(i, 1);
  save();
  renderShortcuts();
});

// ----- Add / edit dialog -----
const dlg = $("#shortcut-dialog");
const nameInput = $("#sc-name");
const urlInput = $("#sc-url");
const errorEl = $("#sc-error");
let previewTimer;

function normalizeUrl(raw) {
  let value = raw.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.href;
  } catch {
    return null;
  }
}

function defaultName(url) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function updatePreview() {
  const url = normalizeUrl(urlInput.value);
  const preview = $("#sc-preview");
  if (!url) return preview.replaceChildren(icon("globe", 24));
  const u = new URL(url);
  preview.replaceChildren(favicon(`${u.origin}/`, nameInput.value || defaultName(url)));
}

function openShortcutDialog(index) {
  state.editing = index;
  const s = index == null ? { name: "", url: "" } : S.shortcuts[index];
  $("#sc-title").textContent = index == null ? "Add shortcut" : "Edit shortcut";
  nameInput.value = s.name;
  urlInput.value = s.url;
  errorEl.hidden = true;
  updatePreview();
  dlg.showModal();
  (index == null ? nameInput : urlInput).focus();
}

urlInput.addEventListener("input", () => {
  errorEl.hidden = true;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 350);
});
nameInput.addEventListener("input", () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 350);
});
$("#sc-cancel").addEventListener("click", () => dlg.close());
dlg.addEventListener("click", (e) => {
  if (e.target === dlg) dlg.close(); // click on the backdrop
});

$("#shortcut-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const url = normalizeUrl(urlInput.value);
  if (!url) {
    errorEl.textContent = "Enter a valid website address, like example.com";
    errorEl.hidden = false;
    urlInput.focus();
    return;
  }
  const entry = { name: nameInput.value.trim() || defaultName(url), url };
  if (state.editing == null) S.shortcuts.push(entry);
  else S.shortcuts[state.editing] = entry;
  save();
  renderShortcuts();
  dlg.close();
});

// =============================================================================================
// Images (background + avatar)
// =============================================================================================
const decodeImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

async function setBackgroundImage(file) {
  if (!file || !(file.type || "").startsWith("image/")) return toast("That file isn’t an image.");
  if (file.size > 150 * 1024 * 1024) return toast("That image is larger than 150 MB. Choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    await decodeImage(url);
  } catch {
    URL.revokeObjectURL(url);
    return toast("Chrome can’t display that image format. Try PNG, JPEG, GIF or WebP.");
  }
  try {
    await putFile("bg", file); // original bytes, so GIF/APNG/WebP animation is preserved
  } catch {
    URL.revokeObjectURL(url);
    return toast("Couldn’t store the image. Free up disk space and try again.");
  }
  if (state.bgUrl) URL.revokeObjectURL(state.bgUrl);
  state.bgUrl = url;
  S.hasImage = true;
  S.bg.type = "image";
  state.sbTab = "image";
  save();
  applyBackground();
  renderSidebar();
}

async function removeBackgroundImage() {
  await deleteFile("bg").catch(() => {});
  if (state.bgUrl) URL.revokeObjectURL(state.bgUrl);
  state.bgUrl = null;
  S.hasImage = false;
  if (S.bg.type === "image") S.bg.type = "gradient";
  state.sbTab = S.bg.type === "image" ? "gradient" : S.bg.type;
  save();
  applyBackground();
  renderSidebar();
}

async function setAvatar(file) {
  if (!file || !(file.type || "").startsWith("image/")) return toast("That file isn’t an image.");
  try {
    const bmp = await createImageBitmap(file);
    const size = 192;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const side = Math.min(bmp.width, bmp.height);
    canvas.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    await putFile("avatar", blob);
    if (state.avatarUrl) URL.revokeObjectURL(state.avatarUrl);
    state.avatarUrl = URL.createObjectURL(blob);
    S.hasAvatar = true;
    save();
    renderAvatar();
  } catch {
    toast("Chrome can’t read that image. Try a PNG or JPEG.");
  }
}

async function removeAvatar() {
  await deleteFile("avatar").catch(() => {});
  if (state.avatarUrl) URL.revokeObjectURL(state.avatarUrl);
  state.avatarUrl = null;
  S.hasAvatar = false;
  save();
  renderAvatar();
}

// Dropping an image anywhere on the page sets it as the background.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) setBackgroundImage(file);
});

// =============================================================================================
// Sidebar
// =============================================================================================
const sidebar = $("#sidebar");
const customizeBtn = $("#customize-btn");

function openSidebar() {
  closeMenu();
  state.sbTab = S.bg.type === "image" && !state.bgUrl ? "gradient" : S.bg.type;
  renderSidebar();
  sidebar.inert = false;
  sidebar.classList.add("open");
  $("#sb-close").focus({ preventScroll: true });
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebar.inert = true;
  customizeBtn.focus({ preventScroll: true });
}

customizeBtn.addEventListener("click", () => (sidebar.classList.contains("open") ? closeSidebar() : openSidebar()));
$("#sb-close").addEventListener("click", closeSidebar);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !e.defaultPrevented && !dlg.open && !menuIsOpen() && sidebar.classList.contains("open")) closeSidebar();
});

function swatch({ color, label, pressed, onPick, text, extra }) {
  const b = h("button", { class: `swatch${text ? " is-auto" : ""}`, type: "button", title: label, "aria-label": label, "aria-pressed": String(!!pressed) });
  if (color) b.style.background = color;
  if (text) b.textContent = text;
  if (pressed && !text) b.append(icon("check", 18, "check-mark"));
  b.addEventListener("click", onPick);
  if (extra) b.append(extra);
  return b;
}

function customSwatch({ value, active, label, onInput, onChange }) {
  const inputEl = h("input", { type: "color", value, "aria-label": label });
  inputEl.addEventListener("input", () => onInput(inputEl.value));
  inputEl.addEventListener("change", () => onChange(inputEl.value));
  const b = h("label", { class: "swatch custom", title: label, "aria-pressed": String(!!active) }, inputEl);
  if (active) b.style.background = value;
  return b;
}

const setSeg = (seg, value) =>
  seg.querySelectorAll("button").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.value === value)));

function renderSidebar() {
  const { bg } = S;
  const sch = state.scheme;

  // Background tabs + panels
  $("#bg-tabs").querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === state.sbTab)));
  sidebar.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === state.sbTab));

  // Solid
  const solidSel = bg.solid && bg.solid.toLowerCase();
  const inList = SOLID_SWATCHES.includes(solidSel);
  $("#solid-swatches").replaceChildren(
    swatch({
      color: sch["primary-container"],
      label: "Theme color",
      pressed: !bg.solid && bg.type === "solid",
      onPick: () => {
        bg.solid = null;
        bg.type = "solid";
        save();
        applyBackground();
        renderSidebar();
      },
    }),
    ...SOLID_SWATCHES.map((c) =>
      swatch({
        color: c,
        label: c,
        pressed: solidSel === c && bg.type === "solid",
        onPick: () => {
          bg.solid = c;
          bg.type = "solid";
          save();
          applyBackground();
          renderSidebar();
        },
      }),
    ),
    customSwatch({
      value: bg.solid || "#6750a4",
      active: !!bg.solid && !inList,
      label: "Custom color",
      onInput: (v) => {
        bg.solid = v;
        bg.type = "solid";
        applyBackground();
      },
      onChange: () => {
        save();
        renderSidebar();
      },
    }),
  );

  // Gradient
  const g = bg.gradient;
  const themeGrad = `linear-gradient(135deg, ${sch["primary-container"]}, ${sch["tertiary-container"]})`;
  $("#grad-swatches").replaceChildren(
    swatch({
      color: themeGrad,
      label: "Theme gradient",
      pressed: g.preset === "theme" && bg.type === "gradient",
      onPick: () => {
        g.preset = "theme";
        bg.type = "gradient";
        save();
        applyBackground();
        renderSidebar();
      },
    }),
    ...GRADIENT_PRESETS.map((p) =>
      swatch({
        color: `linear-gradient(135deg, ${p.c1}, ${p.c2})`,
        label: p.name,
        pressed: g.preset === p.id && bg.type === "gradient",
        onPick: () => {
          Object.assign(g, { preset: p.id, c1: p.c1, c2: p.c2 });
          bg.type = "gradient";
          save();
          applyBackground();
          renderSidebar();
        },
      }),
    ),
  );
  $("#grad-c1").value = g.preset === "theme" ? sch["primary-container"] : g.c1;
  $("#grad-c2").value = g.preset === "theme" ? sch["tertiary-container"] : g.c2;
  $("#grad-angle").value = g.angle;

  // Image
  const hasImg = !!state.bgUrl;
  $("#dropzone").hidden = hasImg;
  $("#image-current").hidden = !hasImg;
  $("#fit-seg").hidden = !hasImg;
  if (hasImg) $("#image-thumb").style.backgroundImage = `url("${state.bgUrl}")`;
  setSeg($("#fit-seg"), bg.fit);

  // Heading, theme mode, seed
  setSeg($("#heading-seg"), S.headingColor);
  setSeg($("#mode-seg"), S.themeMode);
  const seedSel = S.seed !== "auto" && S.seed.toLowerCase();
  const seedInList = SEED_SWATCHES.includes(seedSel);
  $("#seed-swatches").replaceChildren(
    swatch({
      text: "Auto",
      label: "Automatic (follows Chrome’s light/dark mode)",
      pressed: S.seed === "auto",
      onPick: () => setSeed("auto"),
    }),
    ...SEED_SWATCHES.map((c) => swatch({ color: c, label: c, pressed: seedSel === c, onPick: () => setSeed(c) })),
    customSwatch({
      value: S.seed === "auto" ? seedHex() : S.seed,
      active: S.seed !== "auto" && !seedInList,
      label: "Custom theme color",
      onInput: (v) => {
        S.seed = v;
        applyTheme();
      },
      onChange: () => {
        save();
        renderSidebar();
      },
    }),
  );

  renderAvatar();
  $("#avatar-remove").hidden = !S.hasAvatar;
}

function setSeed(seed) {
  S.seed = seed;
  save();
  applyTheme();
  renderSidebar();
}

// Background tabs
$("#bg-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  state.sbTab = b.dataset.tab;
  if (state.sbTab !== "image" || state.bgUrl) {
    S.bg.type = state.sbTab;
    save();
    applyBackground();
  }
  renderSidebar();
});

// Gradient inputs
const onGradInput = () => {
  const g = S.bg.gradient;
  g.preset = "custom";
  g.c1 = $("#grad-c1").value;
  g.c2 = $("#grad-c2").value;
  g.angle = Number($("#grad-angle").value);
  S.bg.type = "gradient";
  applyBackground();
};
for (const id of ["#grad-c1", "#grad-c2", "#grad-angle"]) {
  $(id).addEventListener("input", onGradInput);
  $(id).addEventListener("change", () => {
    save();
    renderSidebar();
  });
}

// Image upload (click, keyboard, drag & drop)
const dropzone = $("#dropzone");
const bgFile = $("#bg-file");
bgFile.addEventListener("change", () => {
  setBackgroundImage(bgFile.files[0]);
  bgFile.value = "";
});
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    bgFile.click();
  }
});
for (const t of ["dragenter", "dragover"]) dropzone.addEventListener(t, () => dropzone.classList.add("drag"));
for (const t of ["dragleave", "drop"]) dropzone.addEventListener(t, () => dropzone.classList.remove("drag"));
$("#image-replace").addEventListener("click", () => bgFile.click());
$("#image-remove").addEventListener("click", removeBackgroundImage);
$("#fit-seg").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-value]");
  if (!b) return;
  S.bg.fit = b.dataset.value;
  save();
  applyBackground();
  setSeg($("#fit-seg"), S.bg.fit);
});

// Segmented controls
$("#heading-seg").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-value]");
  if (!b) return;
  S.headingColor = b.dataset.value;
  save();
  applyBackground();
  setSeg($("#heading-seg"), S.headingColor);
});
$("#mode-seg").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-value]");
  if (!b) return;
  S.themeMode = b.dataset.value;
  save();
  applyTheme();
  renderSidebar();
});

// Eyedropper: sample a color from anywhere on screen (e.g. Chrome’s toolbar) to use as the seed
if ("EyeDropper" in window) {
  const eyedrop = $("#eyedrop");
  eyedrop.hidden = false;
  eyedrop.addEventListener("click", async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      if (hexToLch(sRGBHex).C < 6) toast("That color is too gray to tell a hue. Sample a more colorful area.");
      setSeed(sRGBHex);
    } catch {
      /* cancelled */
    }
  });
}

// Avatar
const avatarFile = $("#avatar-file");
$("#avatar-upload").addEventListener("click", () => avatarFile.click());
avatarFile.addEventListener("change", () => {
  setAvatar(avatarFile.files[0]);
  avatarFile.value = "";
});
$("#avatar-remove").addEventListener("click", removeAvatar);

// Reset
$("#reset").addEventListener("click", async () => {
  if (!confirm("Reset the background, theme, search engine and shortcuts to their defaults?")) return;
  await Promise.all([removeBackgroundImage(), removeAvatar()]);
  S = structuredClone(DEFAULTS);
  save();
  state.accent = undefined;
  state.sbTab = S.bg.type;
  applyTheme();
  renderEngine();
  renderShortcuts();
  renderSidebar();
});

// =============================================================================================
// Init
// =============================================================================================
async function init() {
  hydrateIcons();

  const [bgBlob, avatarBlob] = await Promise.all([
    S.hasImage ? getFile("bg").catch(() => null) : null,
    S.hasAvatar ? getFile("avatar").catch(() => null) : null,
  ]);
  if (bgBlob) state.bgUrl = URL.createObjectURL(bgBlob);
  else if (S.hasImage) {
    S.hasImage = false; // file vanished (storage cleared)
    if (S.bg.type === "image") S.bg.type = "gradient";
  }
  if (avatarBlob) state.avatarUrl = URL.createObjectURL(avatarBlob);
  else S.hasAvatar = false;

  applyTheme();
  renderEngine();
  renderAvatar();
  renderShortcuts();
  body.classList.add("ready");
}

init();
