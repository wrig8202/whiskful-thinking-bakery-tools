# The Baker's Pricing Lab

*Know your cost. Pay yourself. Price for profit.*

A free, private, browser-based pricing calculator for home bakers, cottage
bakers, cake decorators, cookie artists, and other small food businesses.
It's a static site — plain HTML, CSS and JavaScript, no build step, no
server, no database, no accounts. Everything a baker enters stays in their
own browser (`localStorage`) and is never sent anywhere.

Files:

```
index.html   — page structure and content
styles.css   — all styling, including the brand color variables
app.js       — data model, calculations, and all interactivity
```

---

## 1. Opening it locally

Just double-click `index.html`, or open it in a browser with **File → Open**.
No install, no `npm`, no server required — the whole app runs from the
file. (A couple of browsers restrict `localStorage` for `file://` pages in
strict privacy modes; if saved recipes don't seem to persist, try running a
tiny local server instead, e.g. `python3 -m http.server` from this folder
and visiting `http://localhost:8000`.)

## 2. Where branding lives

Open **`styles.css`** and look for the `BRAND CUSTOMIZATION` block at the
very top of the file:

```css
:root {
  --brand-primary: #8a4b3b;      /* headings, primary buttons */
  --brand-secondary: #3f4a3d;    /* accents */
  --brand-accent: #c98a4b;       /* highlights, focus rings */
  --background: #faf6f1;
  --surface: #ffffff;
  --text-primary: #2b2622;
  --text-secondary: #6b6259;
  --border-radius: 12px;
  ...
}
```

Change any of these hex values to re-skin the whole app — every color in
the stylesheet is built from these variables. Colors are pre-checked for
readable contrast; if you swap them for a different bakery's brand colors,
double-check text is still easy to read against its background.

To change the app name, tagline, or footer attribution, edit the text
directly in `index.html`:
- App name / tagline: near the top, inside `<header class="app-header">`.
- Attribution link: near the bottom, inside `<footer class="app-footer">`
  — update the `href` and link text to point wherever you like.

## 3. Deploying with a drag-and-drop static host (Netlify Drop, Cloudflare Pages)

1. Select all three files (`index.html`, `styles.css`, `app.js`) — or the
   whole project folder.
2. Drag them onto [Netlify Drop](https://app.netlify.com/drop) or use
   Cloudflare Pages' "upload assets" flow.
3. You'll get a live URL immediately. No build command, no framework, no
   environment variables needed.

## 3b. Deploying with GitHub Pages

This repo is already structured for GitHub Pages:

1. Push `index.html`, `styles.css`, and `app.js` to your repository (they
   can live at the repo root, as they do here).
2. In the repo's **Settings → Pages**, set the source to the branch/folder
   these files live in (e.g. `main` / `/root`).
3. GitHub gives you a URL like
   `https://<username>.github.io/<repo-name>/`.
4. From then on, any commit you push to that branch automatically updates
   the live site within a minute or two — there's nothing else to run or
   rebuild. Your bakery's website visitors never see or touch GitHub; it's
   only the plumbing behind the live calculator.

## 4. Embedding it on your website (e.g. Square Online)

Once it's hosted (Netlify, Cloudflare Pages, or GitHub Pages all work the
same way), embed it with a plain iframe:

```html
<iframe
    src="https://your-hosted-url-here/"
    width="100%"
    height="1800"
    style="border:0; width:100%;"
    title="The Baker's Pricing Lab">
</iframe>
```

Notes on embedding:
- The app never tries to read or modify the page it's embedded in — it only
  ever touches its own document and its own `localStorage`.
- `height="1800"` is a starting point; the app has a lot of content across
  its tabs; if you find some tabs get cut off, increase the height (many
  users set it to `2400`–`3000` depending on their page's own width, since
  narrower embeds run taller). There is no built-in auto-resize (`postMessage`
  auto-sizing would require cooperation from the parent page), so pick a
  height that comfortably fits the tallest tab (Pricing & Results) at your
  typical embed width.
- The page is designed to look like it belongs on your site rather than
  like "a website inside a website" — minimal outer margin, no extra nav
  chrome, and it starts right at its own title.

## 5. How saved data works

Recipes and your ingredient library are saved using the browser's
`localStorage` — a small private storage area tied to that specific browser
**and** that specific website address (domain). That means:

- Saved recipes only appear on the same device and browser where they were
  saved. They will *not* appear if the same person opens the calculator on
  their phone, or in a different browser, or in an incognito/private window.
- If a visitor clears their browser's site data/cookies, or uses a
  "clean up" tool, their saved recipes and library will be deleted. There
  is no server-side backup — that's the tradeoff for keeping business data
  100% private and never transmitted anywhere.
- Nothing is ever sent to Whiskful Thinking, to this app's host, or to any
  third party. There's no analytics, no network calls for recipe data —
  the app works the same with the network disconnected.

## 6. Exporting backups

Use **Export JSON** in the toolbar at the top of the app to download the
currently-open recipe as a `.json` file — a good habit before clearing
browser data, switching devices, or just as a periodic backup. Use
**Import JSON** to load a previously exported recipe back in (on any device
or browser — this is also how a baker could move their recipes to a new
computer).

## 7. Updating the app later

Because there's no build step, updating is simple:

- **Local / drag-and-drop hosts:** edit `index.html`, `styles.css`, or
  `app.js` directly, then re-upload/re-drag the changed files to your host.
- **GitHub Pages:** edit the files and push the commit — the live site
  updates automatically.

Because all calculations live in one place (the `CALC` object near the top
of `app.js`, with comments on every formula), and all persistent data
structures are documented at the top of `app.js` (`newRecipe()`, the
ingredient library shape, etc.), it should be straightforward to extend —
add a new cost category, a new tool tab, or a new saved-ingredient field —
without touching unrelated code.

---

### A note on accuracy

This calculator is provided for educational and business-planning purposes.
Costs, taxes, regulations, market conditions and business circumstances
vary. Pricing recommendations are estimates based on the information a
baker enters and are not financial, tax or legal advice.
