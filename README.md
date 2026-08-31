# Image To URL

Upload images and generate shareable public image URLs.

This project is **7 files total** — no Node.js, no npm, no build step. It works the moment GitHub Pages is turned on.

```
index.html
style.css
script.js
favicon.svg
robots.txt
sitemap.xml
README.md
```

## GitHub Pages Setup

**Step 1** — Create a GitHub repository (or use your existing one).

**Step 2** — Upload all 7 files above into the root of that repository (drag-and-drop them on the GitHub website works fine — no terminal needed).

**Step 3** — Go to:
```
Settings → Pages
```

**Step 4** — Under "Build and deployment", choose:
```
Deploy from a branch
```

**Step 5** — Select:
```
main → / (root)
```

**Step 6** — Click **Save**.

Then wait a minute or two for GitHub Pages to deploy. Your site will appear at:
```
https://<your-username>.github.io/<your-repo-name>/
```

For this repo specifically, that's:
```
https://kcm2112007.github.io/Image-to-URL-Converter-Upload-Image-Get-Direct-Link/
```

No `npm install`, no `npm run build`, no `npm start` — just those 6 clicks.

## Image Storage Setup

The upload tool needs somewhere to actually store images. This project uses **Cloudinary**, because it lets a plain HTML page upload images directly and safely, without needing a server.

**Step 1 — Create an account**
Go to cloudinary.com and sign up (the free plan is enough).

**Step 2 — Find your Cloud name**
On your Cloudinary dashboard, copy the value labeled **"Cloud name"**.

**Step 3 — Create an unsigned upload preset**
Go to **Settings → Upload → Add upload preset**. Set **Signing Mode** to **Unsigned**, then copy the preset's name.

**Step 4 — Paste them into `script.js`**
Open `script.js`. At the very top, you'll see:
```js
const CONFIG = {
  ...
  cloudName: "YOUR_CLOUD_NAME",
  uploadPreset: "YOUR_UPLOAD_PRESET",
  ...
};
```
Replace `"YOUR_CLOUD_NAME"` and `"YOUR_UPLOAD_PRESET"` with the values you just copied.

**Step 5 — Upload the updated `script.js` to GitHub**
Just re-upload that one file to the same repository, overwriting the old version. GitHub Pages will pick it up automatically.

**⚠️ Never put a private API secret in this project.** The "Cloud name" and "upload preset name" are both safe to make public — that's the whole point of Cloudinary's unsigned upload feature. Never add anything called an "API secret," "API key + secret," or "service role key" to `script.js` or anywhere else in this repository. If you ever need a feature that truly requires a secret (like deleting images), that has to run on a small server or serverless function — not in this static site.

## What's already working, and what needs your Cloudinary details

Everything below works as soon as you deploy, **except actual uploads**, which need Step 4 above completed first:

- Drag-and-drop / click-to-browse / paste-from-clipboard image selection
- Live preview with filename, size, dimensions, format
- Optional in-browser resize/recompress with an honest before/after size comparison
- Bulk upload (up to 20 images) with copy-all, download list, and CSV export
- Real upload progress (once Cloudinary is configured)
- Auto-generated HTML, CSS, Markdown, JavaScript, React and BBCode code snippets
- A downloadable QR code for every URL
- A browser-based test confirming the new URL actually loads as an image
- "Image URL → Image" preview tool
- Local upload history (stored only in your own browser)
- Light / dark / system theme toggle

Until Cloudinary is configured, the site shows a clear "Requires configuration" banner instead of pretending uploads work.

## Custom domain later

If you add a custom domain, update these two things:
1. `siteUrl` near the top of `script.js`
2. The `canonical`, `og:url`, `robots.txt`, and `sitemap.xml` URLs (they currently point at your GitHub Pages address above)

## Why this version is simpler than before

The previous version of this project split things across multiple HTML pages and several JS/CSS files in subfolders. Nothing was removed — the FAQ, developer docs, privacy notice, terms, and about info are all still here, just combined into sections of this one `index.html` page instead of separate files. That's what brought the project down to 7 flat files with zero build step.
