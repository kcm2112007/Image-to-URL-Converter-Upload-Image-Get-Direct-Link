# Image To URL

Upload an image, get a real public HTTPS URL. Static frontend (HTML/CSS/vanilla JS), deployable on GitHub Pages, with image storage handled by Cloudinary's **unsigned browser upload** so no backend server is required.

## This deployment

- **Repository:** `kcm2112007/Image-to-URL-Converter-Upload-Image-Get-Direct-Link`
- **Live site (once Pages is enabled):** `https://kcm2112007.github.io/Image-to-URL-Converter-Upload-Image-Get-Direct-Link/`
- All canonical URLs, Open Graph tags, `robots.txt`, and `sitemap.xml` in this build already point at that address. If you later move to a custom domain, update `SITE_CONFIG.siteUrl` in `js/config.js`, the `<link rel="canonical">` / `og:url` tag in every page's `<head>`, `robots.txt`, and `sitemap.xml` to match — see "Custom domain" below.

## What's real vs. what's a placeholder

- The upload flow, validation, client-side optimization, code-snippet generation, QR code, URL tester, history and dark mode are fully working.
- The **storage provider is not configured out of the box**. Until you add your Cloudinary details to `js/config.js`, the site shows a "Requires configuration" banner and uploads will fail with a clear error — by design, not a bug. Nothing fakes a URL.

## 1. Create a Cloudinary account

1. Sign up at cloudinary.com (free tier is enough to start).
2. From the dashboard, copy your **Cloud name**.

## 2. Create an UNSIGNED upload preset

Unsigned presets are what let the browser upload directly to Cloudinary without ever touching your API secret.

1. Dashboard → Settings → Upload.
2. Add an **Upload preset**, set **Signing Mode** to **Unsigned**.
3. Recommended restrictions on the preset:
   - Restrict allowed formats to `jpg,png,webp,gif,avif` (leave SVG off).
   - Set a folder if you want uploads namespaced (e.g. `image-to-url`).
   - Optionally cap max file size / image dimensions at the preset level too, as a second line of defense behind this app's own client-side checks.
4. Copy the **preset name**.

Consult Cloudinary's own current documentation for the exact steps, since dashboard UI changes over time.

## 3. Fill in `js/config.js`

```js
cloudinary: {
  cloudName: "your-cloud-name",
  uploadPreset: "your-unsigned-preset",
  folder: "image-to-url"
}
```

**Safe to put in this file:** cloud name, unsigned preset name, Supabase URL + anon key.
**Never put in this file (or anywhere in frontend code):** Cloudinary API secret, Supabase service-role key, database passwords, any signing secret. If you ever need signed uploads, deletion, or expiring URLs, that requires a small serverless/backend endpoint that holds the secret server-side — this static site does not include one.

## 4. Deploy to GitHub Pages

1. Push all these files to the `kcm2112007/Image-to-URL-Converter-Upload-Image-Get-Direct-Link` repo (root of the `main` branch, or a `docs/` folder — your choice).
2. Repo → Settings → Pages → set source to that branch/folder.
3. Wait for the Pages build, then visit `https://kcm2112007.github.io/Image-to-URL-Converter-Upload-Image-Get-Direct-Link/`.
4. All paths in this project are relative, so it works correctly at that subpath — no code changes needed.

## 5. Custom domain (optional, changes the URLs above)

1. Add a `CNAME` file at the project root containing your domain, or set it in the Pages settings UI.
2. Point your domain's DNS at GitHub Pages per GitHub's current docs.
3. Update `SITE_CONFIG.siteUrl` in `js/config.js`, the canonical/OG URLs in each HTML file, and the domain in `sitemap.xml`.

## Project structure

```
image-to-url/
├── index.html                  (home page + the tool itself)
├── image-url-to-image.html
├── developers.html
├── faq.html
├── privacy.html
├── terms.html
├── about.html
├── 404.html
├── css/style.css
├── js/
│   ├── config.js         (public config only — see above)
│   ├── utils.js          (validation, sanitization, formatting)
│   ├── upload.js         (optimize + upload pipeline)
│   ├── code-generator.js (HTML/CSS/Markdown/JS/React/BBCode snippets)
│   └── app.js            (DOM wiring)
├── assets/
│   ├── logo.svg              (full brand mark, used inline in header/footer)
│   ├── icon-mark.svg         (simplified mark for favicons/app icons)
│   ├── favicon.svg           (= icon-mark.svg, referenced by <link rel="icon">)
│   ├── favicon-16.png / favicon-32.png / favicon-48.png / favicon-512.png
│   ├── apple-touch-icon.png  (180×180, iOS home screen)
│   ├── icon-192.png          (Android/PWA)
│   └── og-image.svg / og-image.png  (1200×630 social preview)
├── site.webmanifest          (enables "Add to Home Screen" on mobile)
├── robots.txt
└── sitemap.xml
```

Note: a separate `/image-to-url.html` was intentionally **not** duplicated — `index.html` already *is* the tool, and a duplicate page would just create duplicate-content SEO issues. If you want a dedicated URL for it later, redirect it to `/` rather than copying the markup.

## Security notes

- MIME type is verified by file signature (magic bytes), not just the extension or the browser-reported type.
- Filenames/public IDs are sanitized: lowercased, stripped of path separators and `..`, restricted to `[a-z0-9-_]`.
- SVG upload is disabled by default (`CONFIG.limits.allowSvg = false`) because SVG can contain active script content.
- No `innerHTML` is used for anything derived from user input or network responses; DOM nodes are built with `textContent`/`createElement`.
- No API secret or service-role key ever appears in this codebase.

## Limits (configurable in `js/config.js`)

- Max file size: 10 MB
- Max bulk batch: 20 files
- Accepted types: JPG, PNG, WebP, GIF, AVIF (SVG off by default)
