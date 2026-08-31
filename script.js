// ================================
// IMAGE TO URL CONFIGURATION
// ================================
// This is the ONLY place you need to edit to make image uploads work.
// Everything in this block is PUBLIC information — it is safe for it
// to be visible in your GitHub repository and in anyone's browser.
//
// NEVER put an API secret, a service-role key, or a database password
// in this file or anywhere else in this project. If a provider ever
// asks you to use a "secret" for uploading, that upload must happen
// from a small server/serverless function instead — not from this
// static website. This project intentionally uses Cloudinary's
// "unsigned upload" feature so that no secret is ever needed here.

const CONFIG = {
  siteName: "Image To URL",

  // Your live GitHub Pages URL. Update this if you add a custom domain.
  siteUrl: "https://kcm2112007.github.io/Image-to-URL-Converter-Upload-Image-Get-Direct-Link/",

  // Only "cloudinary" is wired up in this build.
  storageProvider: "cloudinary",

  // ---- Replace these two with your own Cloudinary values ----
  // 1. Sign up at https://cloudinary.com (free plan is enough).
  // 2. Copy your "Cloud name" from the dashboard -> paste below.
  // 3. Create an UNSIGNED upload preset (Settings -> Upload -> Add
  //    upload preset -> Signing Mode: Unsigned) -> paste its name below.
  cloudName: "YOUR_CLOUD_NAME",
  uploadPreset: "YOUR_UPLOAD_PRESET",

  // Optional: uploads are grouped inside this folder in your Cloudinary
  // account. You can leave this as-is, change it, or set it to "".
  folder: "image-to-url",

  // Safety limits enforced in the browser before anything is uploaded.
  maxFileSizeMB: 10,
  maxBulkFiles: 20,
  acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  // SVG files can contain active script content, so they are blocked
  // by default. Only enable this if you understand the risk.
  allowSvg: false
};

function isProviderConfigured() {
  return Boolean(CONFIG.cloudName && CONFIG.uploadPreset
    && CONFIG.cloudName !== "YOUR_CLOUD_NAME" && CONFIG.uploadPreset !== "YOUR_UPLOAD_PRESET");
}

// ================================
// UTILITIES
// ================================

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let val = bytes / 1024, i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return val.toFixed(val >= 10 ? 0 : 1) + " " + units[i];
}

function formatDate(d) {
  return new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function sanitizeFilename(name) {
  if (!name) return "";
  let n = String(name).trim().toLowerCase();
  n = n.replace(/\.[a-z0-9]+$/i, "");
  n = n.replace(/[\\/]+/g, "-");
  n = n.replace(/\.\./g, "-");
  n = n.replace(/[^a-z0-9\-_]+/g, "-");
  n = n.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  return n.slice(0, 80);
}

const SIGNATURES = [
  { mime: "image/jpeg", bytes: [0xFF, 0xD8, 0xFF] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offsetCheck: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

async function sniffMimeType(file) {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => buf[i] === b)) {
      if (sig.offsetCheck) {
        const off = sig.offsetCheck;
        if (off.bytes.every((b, i) => buf[off.offset + i] === b)) return sig.mime;
        continue;
      }
      return sig.mime;
    }
  }
  if (file.type === "image/avif" || file.type === "image/svg+xml") return file.type;
  return null;
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("Could not read image dimensions")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function aspectRatio(w, h) { if (!w || !h) return "—"; const d = gcd(w, h); return `${w / d}:${h / d}`; }

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      return true;
    } catch (e2) { return false; }
  }
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}
function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function toast(msg) {
  let t = document.getElementById("global-toast");
  if (!t) { t = el("div", { id: "global-toast", class: "toast" }); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const a = el("a", { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); a.remove();
}

function csvEscape(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

// ================================
// VALIDATION + OPTIMIZATION + UPLOAD
// ================================

async function validateFile(file) {
  if (file.size > CONFIG.maxFileSizeMB * 1024 * 1024) {
    throw new Error(`File is too large. Maximum image size is ${CONFIG.maxFileSizeMB} MB.`);
  }
  const sniffed = await sniffMimeType(file);
  const declared = file.type;

  if (declared === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    if (!CONFIG.allowSvg) throw new Error("SVG uploads are disabled because SVG files can contain active script content.");
  } else if (!sniffed) {
    throw new Error("Unsupported image format.");
  } else if (!CONFIG.acceptedTypes.includes(sniffed)) {
    throw new Error("Unsupported image format.");
  } else if (declared && declared !== sniffed && !CONFIG.acceptedTypes.includes(declared)) {
    throw new Error("This file's contents don't match its declared type.");
  }
  return sniffed || declared;
}

function loadImageBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("Could not decode image")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

async function optimizeImage(file, opts) {
  const { quality, maxWidth, targetFormat } = opts;
  const isGif = file.type === "image/gif";
  const isSvg = file.type === "image/svg+xml";
  const noop = quality === "original" && maxWidth === "original" && targetFormat === "keep";
  if (isGif || isSvg || noop) return { blob: file, mime: file.type, changed: false };

  const dims = await getImageDimensions(file);
  const img = await loadImageBitmap(file);

  let targetW = dims.width;
  if (maxWidth !== "original") {
    const mw = maxWidth === "custom" ? opts.customWidth : parseInt(maxWidth, 10);
    if (mw && mw < dims.width) targetW = mw;
  }
  const scale = targetW / dims.width;
  const targetH = Math.round(dims.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW; canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const qualityMap = { original: 0.92, high: 0.85, medium: 0.7, low: 0.5 };
  const q = qualityMap[quality] ?? 0.85;

  let outMime = file.type;
  if (targetFormat === "jpg") outMime = "image/jpeg";
  else if (targetFormat === "png") outMime = "image/png";
  else if (targetFormat === "webp") outMime = "image/webp";

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Could not encode image")), outMime, q);
  });

  return { blob, mime: outMime, changed: true, width: targetW, height: targetH };
}

function uploadToCloudinary(blob, { publicId, filename, onProgress }) {
  return new Promise((resolve, reject) => {
    if (!isProviderConfigured()) {
      reject(new Error("Storage service unavailable. Add your Cloudinary cloudName and uploadPreset at the top of script.js."));
      return;
    }
    const url = `https://api.cloudinary.com/v1_1/${CONFIG.cloudName}/auto/upload`;
    const form = new FormData();
    form.append("file", blob, filename || "upload");
    form.append("upload_preset", CONFIG.uploadPreset);
    if (CONFIG.folder) form.append("folder", CONFIG.folder);
    if (publicId) form.append("public_id", publicId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total); };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: data.secure_url, publicId: data.public_id, format: data.format, width: data.width, height: data.height, bytes: data.bytes, createdAt: data.created_at });
        } else {
          reject(new Error(data?.error?.message || "Upload failed. Please try again."));
        }
      } catch (e) { reject(new Error("Upload failed. Please try again.")); }
    };
    xhr.onerror = () => reject(new Error("Network connection lost."));
    xhr.send(form);
  });
}

async function uploadFile(blob, opts) {
  if (CONFIG.storageProvider === "cloudinary") return uploadToCloudinary(blob, opts);
  throw new Error("Could not generate public URL. No storage provider configured.");
}

// ================================
// CODE SNIPPET GENERATOR
// ================================

function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }
function snippetHtml(url, alt = "Image") { return `<img src="${url}" alt="${escapeAttr(alt)}">`; }
function snippetHtmlAdvanced(url, { alt = "Image", width, height } = {}) {
  const attrs = [`src="${url}"`, `alt="${escapeAttr(alt)}"`, 'loading="lazy"'];
  if (width) attrs.push(`width="${width}"`);
  if (height) attrs.push(`height="${height}"`);
  return `<img\n  ${attrs.join("\n  ")}>`;
}
function snippetResponsive(url, alt = "Image") { return `<img\n  src="${url}"\n  alt="${escapeAttr(alt)}"\n  loading="lazy"\n  decoding="async">`; }
function snippetCss(url) { return `background-image: url("${url}");`; }
function snippetMarkdown(url, alt = "Image") { return `![${alt}](${url})`; }
function snippetJs(url) { return `const imageUrl = "${url}";`; }
function snippetReact(url, alt = "Image") { return `<img src="${url}" alt="${escapeAttr(alt)}" />`; }
function snippetBbcode(url) { return `[img]${url}[/img]`; }

// ================================
// APP WIRING
// ================================
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  /* ---- theme ---- */
  const THEME_KEY = "itu:theme";
  function applyTheme(mode) {
    if (mode === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
  }
  function initTheme() {
    applyTheme(localStorage.getItem(THEME_KEY) || "system");
    $("theme-toggle")?.addEventListener("click", () => {
      const order = ["light", "dark", "system"];
      const current = localStorage.getItem(THEME_KEY) || "system";
      const next = order[(order.indexOf(current) + 1) % order.length];
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      toast(`Theme: ${next}`);
    });
  }

  /* ---- mobile nav ---- */
  function initNav() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }));
  }

  /* ---- config banner ---- */
  function initConfigBanner() {
    const banner = $("config-banner");
    if (!banner) return;
    banner.classList.toggle("hidden", isProviderConfigured());
  }

  /* ---- mode switch ---- */
  function initModeSwitch() {
    const buttons = document.querySelectorAll(".mode-switch button");
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".mode-panel").forEach((p) => p.classList.add("hidden"));
        $(btn.dataset.mode).classList.remove("hidden");
      });
    });
  }

  /* ================= SINGLE UPLOAD ================= */
  const state = { file: null, mime: null, dims: null, optimized: null, result: null };

  function initSingleUpload() {
    const dropzone = $("dropzone");
    const fileInput = $("file-input");
    if (!dropzone) return;

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault(); dropzone.classList.remove("drag-over");
      if (e.dataTransfer.files?.length) handleFileSelected(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener("change", () => { if (fileInput.files?.length) handleFileSelected(fileInput.files[0]); });

    $("paste-btn")?.addEventListener("click", async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith("image/"));
          if (type) { handleFileSelected(new File([await item.getType(type)], "pasted-image", { type })); return; }
        }
        toast("No image found on clipboard.");
      } catch (e) { showError("main-error", "Clipboard permission denied."); }
    });
    document.addEventListener("paste", (e) => {
      if (!$("dropzone")) return;
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      if (item) handleFileSelected(item.getAsFile());
    });

    $("change-image-btn")?.addEventListener("click", () => fileInput.click());
    $("remove-image-btn")?.addEventListener("click", resetSingle);
    $("upload-btn")?.addEventListener("click", startSingleUpload);
    ["opt-quality", "opt-maxwidth", "opt-format"].forEach((id) => $(id)?.addEventListener("change", updateSavingsPreview));
    $("opt-maxwidth")?.addEventListener("change", (e) => $("opt-customwidth-wrap").classList.toggle("hidden", e.target.value !== "custom"));
  }

  async function handleFileSelected(file) {
    clearError("main-error"); resetResult();
    try {
      const mime = await validateFile(file);
      const dims = await getImageDimensions(file).catch(() => null);
      state.file = file; state.mime = mime; state.dims = dims; state.optimized = null;
      renderPreview();
    } catch (err) { showError("main-error", err.message || "Unsupported image format."); }
  }

  function renderPreview() {
    const { file, dims, mime } = state;
    $("preview-section").classList.remove("hidden");
    $("dropzone").classList.add("hidden");
    const img = $("preview-thumb");
    img.src = URL.createObjectURL(file); img.alt = file.name;

    clearNode($("file-meta"));
    [["Filename", file.name], ["Size", formatBytes(file.size)],
     dims ? ["Dimensions", `${dims.width} × ${dims.height}`] : null,
     ["Format", (mime || file.type).replace("image/", "").toUpperCase()],
     dims ? ["Aspect ratio", aspectRatio(dims.width, dims.height)] : null
    ].filter(Boolean).forEach(([label, val]) => $("file-meta").appendChild(el("span", {}, el("strong", { text: label + ": " }), val)));

    $("opt-publicid").value = sanitizeFilename(file.name.replace(/\.[^.]+$/, "")) || "image";
    $("opt-alt").value = "";
    updateSavingsPreview();
  }

  async function updateSavingsPreview() {
    if (!state.file) return;
    const line = $("savings-line");
    line.classList.add("hidden");
    try {
      const opts = readOptimizationOptions();
      if (opts.quality === "original" && opts.maxWidth === "original" && opts.targetFormat === "keep") return;
      const result = await optimizeImage(state.file, opts);
      state.optimized = result;
      if (result.changed) {
        const before = state.file.size, after = result.blob.size;
        const pct = Math.max(0, Math.round((1 - after / before) * 100));
        clearNode(line);
        line.appendChild(el("span", {}, "Original: ", el("b", { text: formatBytes(before) })));
        line.appendChild(el("span", {}, "Optimized: ", el("b", { text: formatBytes(after) })));
        line.appendChild(el("span", {}, "Saved: ", el("b", { text: pct + "%" })));
        line.classList.remove("hidden");
      }
    } catch (e) { state.optimized = null; }
  }

  function readOptimizationOptions() {
    return {
      quality: $("opt-quality")?.value || "original",
      maxWidth: $("opt-maxwidth")?.value || "original",
      customWidth: parseInt($("opt-customwidth")?.value, 10) || null,
      targetFormat: $("opt-format")?.value || "keep"
    };
  }

  function resetSingle() {
    state.file = null; state.mime = null; state.dims = null; state.optimized = null;
    $("preview-section").classList.add("hidden");
    $("dropzone").classList.remove("hidden");
    $("file-input").value = "";
    resetResult(); clearError("main-error");
  }
  function resetResult() { state.result = null; $("result-section")?.classList.add("hidden"); $("progress-section")?.classList.add("hidden"); }

  async function startSingleUpload() {
    if (!state.file) return;
    clearError("main-error");
    $("progress-section").classList.remove("hidden");
    $("result-section").classList.add("hidden");
    $("upload-btn").disabled = true;
    const fill = $("progress-fill"), label = $("progress-label-text");
    fill.style.width = "0%";
    try {
      let blob = state.file, mime = state.mime;
      const opts = readOptimizationOptions();
      if (!(opts.quality === "original" && opts.maxWidth === "original" && opts.targetFormat === "keep")) {
        const optimized = state.optimized || await optimizeImage(state.file, opts);
        if (optimized.changed) { blob = optimized.blob; mime = optimized.mime; }
      }
      const publicId = sanitizeFilename($("opt-publicid").value);
      const result = await uploadFile(blob, {
        publicId: publicId || undefined,
        filename: state.file.name,
        onProgress: (loaded, total) => {
          const pct = Math.round((loaded / total) * 100);
          fill.style.width = pct + "%";
          label.textContent = `${pct}% — ${formatBytes(loaded)} / ${formatBytes(total)}`;
        }
      });
      state.result = { ...result, originalSize: state.file.size, uploadedSize: blob.size, uploadedAt: Date.now(), alt: $("opt-alt").value };
      renderResult();
      saveHistory(state.result);
    } catch (err) {
      showError("main-error", err.message || "Upload failed. Please try again.");
      $("progress-section").classList.add("hidden");
    } finally { $("upload-btn").disabled = false; }
  }

  function renderResult() {
    const r = state.result;
    $("result-section").classList.remove("hidden");
    $("progress-section").classList.add("hidden");
    $("result-url-plain").textContent = r.url;
    renderLinkAnatomy(r.url);
    $("open-url-btn").href = r.url;
    $("copy-url-btn").onclick = () => copyToClipboard(r.url).then((ok) => toast(ok ? "URL copied" : "Copy failed"));
    $("download-btn").href = r.url;
    $("download-btn").setAttribute("download", (r.publicId || "image") + "." + (r.format || "jpg"));
    $("share-btn").onclick = () => shareUrl(r.url);
    renderInfoTable(r);
    renderSnippets(r);
    renderQr(r.url);
    testUrl(r.url);
  }

  function renderLinkAnatomy(url) {
    const wrap = $("link-anatomy"); clearNode(wrap);
    try {
      const u = new URL(url);
      const pathParts = u.pathname.split("/").filter(Boolean);
      const file = pathParts.pop() || "";
      const path = pathParts.length ? "/" + pathParts.join("/") + "/" : "/";
      wrap.appendChild(el("span", { class: "seg-protocol", "data-label": "protocol" }, u.protocol + "//"));
      wrap.appendChild(el("span", { class: "seg-host", "data-label": "host" }, u.host));
      wrap.appendChild(el("span", { class: "seg-path", "data-label": "path" }, path));
      wrap.appendChild(el("span", { class: "seg-file", "data-label": "file" }, file));
    } catch (e) {}
  }

  function renderInfoTable(r) {
    const table = $("info-table"); clearNode(table);
    [["Public URL", r.url], ["Original size", formatBytes(r.originalSize)], ["Uploaded size", formatBytes(r.uploadedSize)],
     ["Format", r.format], ["Dimensions", r.width && r.height ? `${r.width} × ${r.height}` : "—"],
     ["Aspect ratio", r.width && r.height ? aspectRatio(r.width, r.height) : "—"],
     ["Uploaded at", formatDate(r.uploadedAt)], ["Public ID", r.publicId || "—"]
    ].forEach(([k, v]) => table.appendChild(el("tr", {}, el("td", { text: k }), el("td", { text: String(v) }))));
  }

  function renderSnippets(r) {
    const opts = { alt: r.alt || "Image", width: r.width, height: r.height };
    const map = {
      html: snippetHtmlAdvanced(r.url, opts), css: snippetCss(r.url), markdown: snippetMarkdown(r.url, opts.alt),
      javascript: snippetJs(r.url), react: snippetReact(r.url, opts.alt), bbcode: snippetBbcode(r.url),
      responsive: snippetResponsive(r.url, opts.alt)
    };
    Object.entries(map).forEach(([key, code]) => {
      const codeEl = document.querySelector(`#snippet-${key} code`);
      if (codeEl) codeEl.textContent = code;
    });
  }

  function renderQr(url) {
    const box = $("qr-canvas");
    if (!box || typeof QRCode === "undefined") return;
    clearNode(box);
    new QRCode(box, { text: url, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
    $("qr-download")?.addEventListener("click", () => {
      const canvas = box.querySelector("canvas");
      if (!canvas) return;
      const a = el("a", { href: canvas.toDataURL("image/png"), download: "image-url-qr.png" });
      document.body.appendChild(a); a.click(); a.remove();
    }, { once: true });
  }

  async function testUrl(url) {
    const statusEl = $("tester-status"); clearNode(statusEl);
    const line = (label, val, ok) => el("div", {}, `${label}: `, el("b", { text: val, style: `color:${ok ? "var(--success)" : "var(--danger)"}` }));
    const imgOk = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true); img.onerror = () => resolve(false);
      img.src = url + (url.includes("?") ? "&" : "?") + "cachebust=" + Date.now();
    });
    statusEl.appendChild(line("Image status", imgOk ? "Accessible" : "Not accessible", imgOk));
    try {
      const res = await fetch(url, { method: "GET", mode: "cors" });
      statusEl.appendChild(line("URL status", res.ok ? "Working (" + res.status + ")" : "Error (" + res.status + ")", res.ok));
      const ct = res.headers.get("content-type");
      statusEl.appendChild(ct ? line("Content type", ct, true) : el("div", { class: "privacy-note" }, "Content type could not be read (browser CORS restrictions)."));
    } catch (e) {
      statusEl.appendChild(el("div", { class: "privacy-note" }, "Full URL status could not be verified from the browser due to CORS restrictions. Image status above is still accurate."));
    }
  }

  function shareUrl(url) {
    if (navigator.share) navigator.share({ title: "Image URL", url }).catch(() => {});
    else copyToClipboard(url).then(() => toast("Sharing isn't supported here — URL copied instead"));
  }

  function initSnippetTabs() {
    const tabs = document.querySelectorAll(".snippet-tabs button");
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".snippet-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.target).classList.add("active");
    }));
    document.querySelectorAll(".snippet-copy").forEach((btn) => btn.addEventListener("click", () => {
      const code = btn.closest(".snippet-panel").querySelector("code").textContent;
      copyToClipboard(code).then((ok) => toast(ok ? "Snippet copied" : "Copy failed"));
    }));
  }

  /* ================= BULK UPLOAD ================= */
  const bulkState = { items: [] };
  function initBulkUpload() {
    const input = $("bulk-file-input"), zone = $("bulk-dropzone");
    if (!zone) return;
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("drag-over"); handleBulkFiles(e.dataTransfer.files); });
    input.addEventListener("change", () => handleBulkFiles(input.files));

    $("bulk-copy-all")?.addEventListener("click", () => {
      const urls = bulkState.items.filter((i) => i.status === "done").map((i) => i.result.url).join("\n");
      copyToClipboard(urls).then((ok) => toast(ok ? "All URLs copied" : "Copy failed"));
    });
    $("bulk-download-list")?.addEventListener("click", () => {
      const urls = bulkState.items.filter((i) => i.status === "done").map((i) => i.result.url).join("\n");
      downloadTextFile("image-urls.txt", urls);
    });
    $("bulk-export-csv")?.addEventListener("click", () => {
      const rows = [["filename", "size_bytes", "format", "url"]];
      bulkState.items.filter((i) => i.status === "done").forEach((i) => rows.push([i.file.name, i.file.size, i.result.format, i.result.url]));
      downloadTextFile("image-urls.csv", rows.map((r) => r.map(csvEscape).join(",")).join("\n"));
    });
  }

  async function handleBulkFiles(fileList) {
    const files = [...fileList].slice(0, CONFIG.maxBulkFiles);
    if (fileList.length > CONFIG.maxBulkFiles) toast(`Only the first ${CONFIG.maxBulkFiles} files were added (bulk limit).`);
    $("bulk-results-section").classList.remove("hidden");
    for (const file of files) bulkState.items.push({ file, status: "waiting", result: null, error: null, id: Math.random().toString(36).slice(2) });
    renderBulkList();
    for (const item of bulkState.items.filter((i) => i.status === "waiting")) await processBulkItem(item);
  }

  async function processBulkItem(item) {
    item.status = "uploading"; renderBulkList();
    try {
      await validateFile(item.file);
      const publicId = sanitizeFilename(item.file.name.replace(/\.[^.]+$/, ""));
      item.result = await uploadFile(item.file, { publicId, filename: item.file.name });
      item.status = "done";
    } catch (err) { item.status = "error"; item.error = err.message || "Upload failed."; }
    renderBulkList(); renderBulkTable();
  }

  function renderBulkList() {
    const list = $("bulk-list"); clearNode(list);
    bulkState.items.forEach((item) => {
      list.appendChild(el("div", { class: "bulk-row" },
        el("img", { src: URL.createObjectURL(item.file), alt: "" }),
        el("span", { class: "name", text: item.file.name }),
        el("span", { class: `status-pill ${item.status}`, text: { waiting: "Waiting", uploading: "Uploading", done: "Complete", error: "Error" }[item.status] })
      ));
    });
  }

  function renderBulkTable() {
    const done = bulkState.items.filter((i) => i.status === "done");
    const tbody = $("bulk-results-body");
    if (!tbody) return;
    clearNode(tbody);
    done.forEach((item) => {
      tbody.appendChild(el("tr", {},
        el("td", {}, el("img", { src: item.result.url, alt: "" })),
        el("td", { text: formatBytes(item.file.size) }),
        el("td", { text: item.result.format || "" }),
        el("td", { class: "url-cell", text: item.result.url }),
        el("td", {}, el("button", { class: "btn btn-secondary btn-sm", text: "Copy", onclick: () => copyToClipboard(item.result.url).then(() => toast("URL copied")) }))
      ));
    });
    $("bulk-table-wrap")?.classList.toggle("hidden", done.length === 0);
  }

  /* ================= URL -> IMAGE ================= */
  function initUrlToImage() {
    const form = $("url-to-image-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const url = $("url-to-image-input").value.trim();
      clearError("u2i-error");
      $("u2i-result").classList.add("hidden");
      let parsed;
      try { parsed = new URL(url); } catch { showError("u2i-error", "That doesn't look like a valid URL."); return; }
      if (!/^https?:$/.test(parsed.protocol)) { showError("u2i-error", "URL must start with http:// or https://"); return; }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        $("u2i-preview").src = url;
        $("u2i-dims").textContent = img.naturalWidth && img.naturalHeight ? `${img.naturalWidth} × ${img.naturalHeight}` : "Unavailable";
        $("u2i-url-out").textContent = url;
        $("u2i-download").href = url;
        $("u2i-result").classList.remove("hidden");
      };
      img.onerror = () => showError("u2i-error", "Could not load an image from that URL. It may not exist, or the server may block cross-origin access.");
      img.src = url;
    });
  }

  /* ---- history ---- */
  const HISTORY_KEY = "itu:history";
  function saveHistory(result) {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    list.unshift({ name: result.publicId, url: result.url, date: result.uploadedAt });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
    renderHistory();
  }
  function renderHistory() {
    const wrap = $("history-list");
    if (!wrap) return;
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    clearNode(wrap);
    if (!list.length) { wrap.appendChild(el("p", { text: "No uploads yet on this device." })); return; }
    list.forEach((item) => wrap.appendChild(el("div", { class: "history-item" },
      el("img", { src: item.url, alt: "" }),
      el("div", { class: "meta" }, el("div", { class: "name", text: item.name || "image" }), el("div", { class: "date", text: formatDate(item.date) })),
      el("button", { class: "btn btn-ghost btn-sm", text: "Copy", onclick: () => copyToClipboard(item.url).then(() => toast("URL copied")) })
    )));
  }
  function initHistory() {
    renderHistory();
    $("clear-history-btn")?.addEventListener("click", () => { localStorage.removeItem(HISTORY_KEY); renderHistory(); toast("History cleared"); });
  }

  /* ---- about links from CONFIG ---- */
  function initAboutLinks() {
    const site = $("about-site"), gh = $("about-github");
    if (site && CONFIG.siteUrl) { const a = el("a", { href: CONFIG.siteUrl, text: CONFIG.siteUrl }); site.replaceWith(a); }
    if (gh) {
      // GitHub repo link is set directly in the HTML footer/about section.
    }
  }

  /* ---- errors ---- */
  function showError(id, message) { const box = $(id); if (!box) return; box.textContent = message; box.classList.remove("hidden"); }
  function clearError(id) { const box = $(id); if (!box) return; box.textContent = ""; box.classList.add("hidden"); }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
    initConfigBanner();
    initModeSwitch();
    initSingleUpload();
    initSnippetTabs();
    initBulkUpload();
    initUrlToImage();
    initHistory();
    initAboutLinks();
    if (!navigator.onLine) toast("You appear to be offline.");
    window.addEventListener("offline", () => toast("Network connection lost."));
  });
})();
