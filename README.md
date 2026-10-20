# Cooking List

A simple, private cooking list that runs entirely in your browser. Keep track of the dishes you like to make, pick what you're cooking this week, and store your recipes alongside them.

No accounts, no server, no build step. Just three static files and your browser's `localStorage`.

## Features

- **Dish list grouped by cuisine.** Add dishes, assign them to a cuisine, and filter with tabs.
- **Weekly planner.** Check off dishes to add them to "Cooking this week." Uncheck them and they move to "Recently cooked."
- **Recipe pages.** Open any dish to write its recipe with a small rich-text editor (bullets, numbered lists, bold, headings). Links are tappable in view mode, and the screen stays awake while a recipe is open.
- **Edit cuisines and dishes.** Rename, move dishes between cuisines, or delete either.
- **Undo and trash.** Deletes can be undone right away, and everything stays in "Recently deleted" for 30 days.
- **Backup and restore.** Export your data as text (share sheet on phones and Macs, clipboard elsewhere) and paste it back to restore.
- **Themes.** Classic, Ocean, and Plum, each with a dark variant, plus Auto, which follows your device's light/dark setting.
- **Mobile friendly.** Designed to be used on a phone in the kitchen and works as a home-screen web app.

## Getting started

There is nothing to install.

1. Clone or download this repository.
2. Open `index.html` in your browser.

To use it on your phone, host the folder anywhere that serves static files (GitHub Pages, Netlify, Cloudflare Pages, and so on), open the URL, and use **Add to Home Screen**.

### Deploying with GitHub Pages

1. Push the project to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

## Your data

Everything is stored in your browser's `localStorage` on the device you're using:

| Key | Contents |
|---|---|
| `dish-box-data-v2` | Cuisines, dishes, recipes, and the trash |
| `dish-box-theme` | Your selected theme |

This means:

- Data does **not** sync between devices. Use **Back up** and **Restore** to move it.
- Clearing your browser's site data erases it. Back up regularly.
- Nothing is ever sent to a server.

## Project structure

```
.
├── index.html   # Page markup: list screen, recipe screen, dialogs
├── style.css    # Styles and color themes
└── script.js    # All app logic
```

`script.js` is organized into numbered sections (constants, state, storage, trash, actions, rendering, recipe page, backup, themes, event listeners, startup), with a table of contents at the top.

## Updating the app

Browsers, especially on phones, cache static files aggressively. When you change `style.css` or `script.js`, bump the `?v=` number on the matching `<link>` and `<script>` tags in `index.html` so devices fetch the new versions.

## Tech

Plain HTML, CSS, and JavaScript with no frameworks or dependencies. Fonts ([Fraunces](https://fonts.google.com/specimen/Fraunces) and [Inter](https://fonts.google.com/specimen/Inter)) load from Google Fonts. The app uses `localStorage`, the `<dialog>` element, the Web Share API, and the Screen Wake Lock API, with graceful fallbacks where a feature isn't available.

## Author

Made by Sattv Shah.

## License

This project is licensed under the [MIT License](LICENSE).
