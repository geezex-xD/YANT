# Material Homepage

A Material You new tab page for Chrome.

## Install
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder (the one containing `manifest.json`).
3. Open a new tab. Chrome may ask you to keep the change.

To use it for the Home button too: Settings → Appearance → Home button → **New Tab page**.

## Using it
- **Pencil button** (bottom right): background (solid, gradient, or your own image/GIF), heading color,
  color theme, profile picture. You can also drop an image anywhere on the page.
- **Search engine pill**: Google, DuckDuckGo, Bing, Yandex. The heading and placeholder follow.
- **Apps grid**: Google services. **Avatar**: link to your Google Account settings.
- **Add shortcut**: name + URL; the icon is fetched from the site. Hover a tile for edit/remove.

## Notes
- Chrome doesn't expose its theme color to extensions. "Auto" follows light/dark mode; to match your theme
  color, pick it in the sidebar or sample your toolbar with the eyedropper (remembered afterwards).
- Favicons are requested from Google's favicon service, then DuckDuckGo's, then the site itself.
- Uploaded images stay on your device (IndexedDB). Nothing is sent anywhere.
- The "+" button focuses the search field; the camera button opens the selected engine's image search.
