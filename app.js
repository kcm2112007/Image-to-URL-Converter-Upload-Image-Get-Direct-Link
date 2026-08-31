/**
 * APP — wires the DOM to Upload / CodeGen / Utils.
 * Single responsibility per function; no innerHTML with user-derived data.
 */

(() => {
  "use strict";

  /* ---------------- Theme ---------------- */
  const THEME_KEY = "itu:theme";
  function applyTheme(mode) {
    if (mode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", mode);
    }
  }
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "system";
    applyTheme(saved);
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const current = localStorage.getItem(THEME_KEY) || "system";
      const order = ["light", "dark", "system"];
      const next = order[(order.indexOf(current) + 1) % order.length];
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      Utils.toast(`Theme: ${next}`);
    });
  }

  /* ---------------- Mobile nav ---------------- */
  function initNav() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  /* ---------------- Config banner ---------------- */
  function initConfigBanner() {
    const banner = document.getElementById("config-banner");
    if (!banner) return;
    if (isProviderConfigured()) { banner.classList.add("hidden"); return; }
    banner.classList.remove("hidden");
  }

  /* ================= SINGLE UPLOAD TOOL ================= */
  const state = { file: null, mime: null, dims: null, optimized: null, result: null };

  function $(id) { return document.getElementById(id); }

  function initSingleUpload() {
    const dropzone = $("dropzone");
    const fileInput = $("file-input");
    const pasteBtn = $("paste-btn");
    if (!dropzone) return; // this page has no uploader

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      if (e.dataTransfer.files?.length) handleFileSelected(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener("change", () => {
      if (fileInput.files?.length) handleFileSelected(fileInput.files[0]);
    });

    if (pasteBtn) {
      pasteBtn.addEventListener("click", async () => {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const type = item.types.find((t) => t.startsWith("image/"));
            if (type) {
              const blob = await item.getType(type);
              handleFileSelected(new File([blob], "pasted-image", { type }));
              return;
            }
          }
          Utils.toast("No image found on clipboard.");
        } catch (e) {
          showError("main-error", "Clipboard permission denied.");
        }
      });
    }
    // Also allow Ctrl/Cmd+V paste anywhere on the page for convenience.
    document.addEventListener("paste", (e) => {
      if (!$("dropzone")) return;
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      if (item) handleFileSelected(item.getAsFile());
    });

    $("change-image-btn")?.addEventListener("click", () => fileInput.click());
    $("remove-image-btn")?.addEventListener("click", resetSingle);
    $("upload-btn")?.addEventListener("click", startSingleUpload);

    ["opt-quality", "opt-maxwidth", "opt-format"].forEach((id) => {
      $(id)?.addEventListener("change", handleOptionsChange);
    });
    $("opt-maxwidth")?.addEventListener("change", (e) => {
      $("opt-customwidth-wrap").classList.toggle("hidden", e.target.value !== "custom");
    });
  }

  async function handleFileSelected(file) {
    clearError("main-error");
    resetResult();
    try {
      const mime = await Upload.validateFile(file);
      const dims = await Utils.getImageDimensions(file).catch(() => null);
      state.file = file; state.mime = mime; state.dims = dims; state.optimized = null;
      renderPreview();
    } catch (err) {
      showError("main-error", err.message || "Unsupported image format.");
    }
  }

  function renderPreview() {
    const { file, dims, mime } = state;
    $("preview-section").classList.remove("hidden");
    $("dropzone").classList.add("hidden");
    const img = $("preview-thumb");
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    Utils.clear($("file-meta"));
    const parts = [
      ["Filename", file.name],
      ["Size", Utils.formatBytes(file.size)],
      dims ? ["Dimensions", `${dims.width} × ${dims.height}`] : null,
      ["Format", (mime || file.type).replace("image/", "").toUpperCase()],
      dims ? ["Aspect ratio", Utils.aspectRatio(dims.width, dims.height)] : null
    ].filter(Boolean);
    parts.forEach(([label, val]) => {
      $("file-meta").appendChild(Utils.el("span", {}, Utils.el("strong", { text: label + ": " }), val));
    });

    const suggested = Utils.sanitizeFilename(file.name.replace(/\.[^.]+$/, "")) || "image";
    $("opt-publicid").value = suggested;
    $("opt-alt").value = "";
    updateSavingsPreview();
  }

  async function updateSavingsPreview() {
    if (!state.file) return;
    const savingsLine = $("savings-line");
    savingsLine.classList.add("hidden");
    try {
      const opts = readOptimizationOptions();
      const noop = opts.quality === "original" && opts.maxWidth === "original" && opts.targetFormat === "keep";
      if (noop) return;
      const result = await Upload.optimizeImage(state.file, opts);
      state.optimized = result;
      if (result.changed) {
        const before = state.file.size, after = result.blob.size;
        const savedPct = Math.max(0, Math.round((1 - after / before) * 100));
        Utils.clear(savingsLine);
        savingsLine.appendChild(Utils.el("span", {}, "Original: ", Utils.el("b", { text: Utils.formatBytes(before) })));
        savingsLine.appendChild(Utils.el("span", {}, "Optimized: ", Utils.el("b", { text: Utils.formatBytes(after) })));
        savingsLine.appendChild(Utils.el("span", {}, "Saved: ", Utils.el("b", { text: savedPct + "%" })));
        savingsLine.classList.remove("hidden");
      }
    } catch (e) {
      // Optimization is optional — silently fall back to original on failure.
      state.optimized = null;
    }
  }

  function readOptimizationOptions() {
    return {
      quality: $("opt-quality")?.value || "original",
      maxWidth: $("opt-maxwidth")?.value || "original",
      customWidth: parseInt($("opt-customwidth")?.value, 10) || null,
      targetFormat: $("opt-format")?.value || "keep"
    };
  }

  function handleOptionsChange() { updateSavingsPreview(); }

  function resetSingle() {
    state.file = null; state.mime = null; state.dims = null; state.optimized = null;
    $("preview-section").classList.add("hidden");
    $("dropzone").classList.remove("hidden");
    $("file-input").value = "";
    resetResult();
    clearError("main-error");
  }

  function resetResult() {
    state.result = null;
    $("result-section")?.classList.add("hidden");
    $("progress-section")?.classList.add("hidden");
  }

  async function startSingleUpload() {
    if (!state.file) return;
    clearError("main-error");
    $("progress-section").classList.remove("hidden");
    $("result-section").classList.add("hidden");
    $("upload-btn").disabled = true;

    const fill = $("progress-fill");
    const label = $("progress-label-text");
    fill.classList.remove("indeterminate");
    fill.style.width = "0%";

    try {
      let blob = state.file, mime = state.mime;
      const opts = readOptimizationOptions();
      const noop = opts.quality === "original" && opts.maxWidth === "original" && opts.targetFormat === "keep";
      if (!noop) {
        const optimized = state.optimized || await Upload.optimizeImage(state.file, opts);
        if (optimized.changed) { blob = optimized.blob; mime = optimized.mime; }
      }

      const publicIdRaw = $("opt-publicid").value;
      const publicId = Utils.sanitizeFilename(publicIdRaw);

      const result = await Upload.uploadFile(blob, {
        publicId: publicId || undefined,
        filename: state.file.name,
        onProgress: (loaded, total) => {
          const pct = Math.round((loaded / total) * 100);
          fill.style.width = pct + "%";
          label.textContent = `${pct}% — ${Utils.formatBytes(loaded)} / ${Utils.formatBytes(total)}`;
        }
      });

      state.result = { ...result, originalSize: state.file.size, uploadedSize: blob.size, uploadedAt: Date.now(), alt: $("opt-alt").value };
      renderResult();
      saveHistory(state.result);
    } catch (err) {
      showError("main-error", err.message || "Upload failed. Please try again.");
      $("progress-section").classList.add("hidden");
    } finally {
      $("upload-btn").disabled = false;
    }
  }

  function renderResult() {
    const r = state.result;
    $("result-section").classList.remove("hidden");
    $("progress-section").classList.add("hidden");

    $("result-url-plain").textContent = r.url;
    renderLinkAnatomy(r.url);

    $("open-url-btn").href = r.url;
    $("copy-url-btn").onclick = () => Utils.copyToClipboard(r.url).then((ok) => Utils.toast(ok ? "URL copied" : "Copy failed"));
    $("download-btn").href = r.url;
    $("download-btn").setAttribute("download", (r.publicId || "image") + "." + (r.format || "jpg"));
    $("share-btn").onclick = () => shareUrl(r.url);

    renderInfoTable(r);
    renderSnippets(r);
    renderQr(r.url);
    testUrl(r.url);
  }

  function renderLinkAnatomy(url) {
    const wrap = $("link-anatomy");
    Utils.clear(wrap);
    try {
      const u = new URL(url);
      const pathParts = u.pathname.split("/").filter(Boolean);
      const file = pathParts.pop() || "";
      const path = pathParts.length ? "/" + pathParts.join("/") + "/" : "/";
      wrap.appendChild(Utils.el("span", { class: "seg-protocol", "data-label": "protocol" }, u.protocol + "//"));
      wrap.appendChild(Utils.el("span", { class: "seg-host", "data-label": "host" }, u.host));
      wrap.appendChild(Utils.el("span", { class: "seg-path", "data-label": "path" }, path));
      wrap.appendChild(Utils.el("span", { class: "seg-file", "data-label": "file" }, file));
    } catch (e) { /* leave empty if URL parsing fails */ }
  }

  function renderInfoTable(r) {
    const table = $("info-table");
    Utils.clear(table);
    const rows = [
      ["Public URL", r.url],
      ["Original size", Utils.formatBytes(r.originalSize)],
      ["Uploaded size", Utils.formatBytes(r.uploadedSize)],
      ["Format", r.format],
      ["Dimensions", r.width && r.height ? `${r.width} × ${r.height}` : "—"],
      ["Aspect ratio", r.width && r.height ? Utils.aspectRatio(r.width, r.height) : "—"],
      ["Uploaded at", Utils.formatDate(r.uploadedAt)],
      ["Public ID", r.publicId || "—"]
    ];
    rows.forEach(([k, v]) => {
      const tr = Utils.el("tr", {}, Utils.el("td", { text: k }), Utils.el("td", { text: String(v) }));
      table.appendChild(tr);
    });
  }

  function renderSnippets(r) {
    const opts = { alt: r.alt || "Image", width: r.width, height: r.height };
    const snippets = CodeGen.all(r.url, opts);
    const map = {
      html: snippets.htmlAdvanced, css: snippets.css, markdown: snippets.markdown,
      javascript: snippets.javascript, react: snippets.react, bbcode: snippets.bbcode,
      responsive: snippets.responsive
    };
    Object.entries(map).forEach(([key, code]) => {
      const codeEl = document.querySelector(`#snippet-${key} code`);
      if (codeEl) codeEl.textContent = code;
    });
  }

  function renderQr(url) {
    const box = $("qr-canvas");
    if (!box || typeof QRCode === "undefined") return;
    Utils.clear(box);
    new QRCode(box, { text: url, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
    $("qr-download")?.addEventListener("click", () => {
      const canvas = box.querySelector("canvas");
      if (!canvas) return;
      const a = Utils.el("a", { href: canvas.toDataURL("image/png"), download: "image-url-qr.png" });
      document.body.appendChild(a); a.click(); a.remove();
    }, { once: true });
  }

  async function testUrl(url) {
    const statusEl = $("tester-status");
    Utils.clear(statusEl);
    const line = (label, val, ok) => Utils.el("div", {}, `${label}: `, Utils.el("b", { text: val, style: `color:${ok ? "var(--success)" : "var(--danger)"}` }));

    const imgOk = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url + (url.includes("?") ? "&" : "?") + "cachebust=" + Date.now();
    });
    statusEl.appendChild(line("Image status", imgOk ? "Accessible" : "Not accessible", imgOk));

    try {
      const res = await fetch(url, { method: "GET", mode: "cors" });
      statusEl.appendChild(line("URL status", res.ok ? "Working (" + res.status + ")" : "Error (" + res.status + ")", res.ok));
      const ct = res.headers.get("content-type");
      statusEl.appendChild(ct
        ? line("Content type", ct, true)
        : Utils.el("div", { class: "privacy-note" }, "Content type could not be read (browser CORS restrictions)."));
    } catch (e) {
      statusEl.appendChild(Utils.el("div", { class: "privacy-note" }, "Full URL status could not be verified from the browser due to CORS restrictions. Image status above is still accurate."));
    }
  }

  function shareUrl(url) {
    if (navigator.share) {
      navigator.share({ title: "Image URL", url }).catch(() => {});
    } else {
      Utils.copyToClipboard(url).then(() => Utils.toast("Sharing isn't supported here — URL copied instead"));
    }
  }

  /* ---------------- Snippet tabs ---------------- */
  function initSnippetTabs() {
    const tabs = document.querySelectorAll(".snippet-tabs button");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".snippet-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.target).classList.add("active");
      });
    });
    document.querySelectorAll(".snippet-copy").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.closest(".snippet-panel").querySelector("code").textContent;
        Utils.copyToClipboard(code).then((ok) => Utils.toast(ok ? "Snippet copied" : "Copy failed"));
      });
    });
  }

  /* ================= BULK UPLOAD ================= */
  const bulkState = { items: [] };

  function initBulkUpload() {
    const input = $("bulk-file-input");
    const zone = $("bulk-dropzone");
    if (!zone) return;

    zone.addEventListener("click", () => input.click());
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault(); zone.classList.remove("drag-over");
      handleBulkFiles(e.dataTransfer.files);
    });
    input.addEventListener("change", () => handleBulkFiles(input.files));

    $("bulk-copy-all")?.addEventListener("click", () => {
      const urls = bulkState.items.filter((i) => i.status === "done").map((i) => i.result.url).join("\n");
      Utils.copyToClipboard(urls).then((ok) => Utils.toast(ok ? "All URLs copied" : "Copy failed"));
    });
    $("bulk-download-list")?.addEventListener("click", () => {
      const urls = bulkState.items.filter((i) => i.status === "done").map((i) => i.result.url).join("\n");
      Utils.downloadTextFile("image-urls.txt", urls);
    });
    $("bulk-export-csv")?.addEventListener("click", () => {
      const rows = [["filename", "size_bytes", "format", "url"]];
      bulkState.items.filter((i) => i.status === "done").forEach((i) => {
        rows.push([i.file.name, i.file.size, i.result.format, i.result.url]);
      });
      const csv = rows.map((r) => r.map(Utils.csvEscape).join(",")).join("\n");
      Utils.downloadTextFile("image-urls.csv", csv);
    });
  }

  async function handleBulkFiles(fileList) {
    const files = [...fileList].slice(0, CONFIG.limits.maxBulkFiles);
    if (fileList.length > CONFIG.limits.maxBulkFiles) {
      Utils.toast(`Only the first ${CONFIG.limits.maxBulkFiles} files were added (bulk limit).`);
    }
    $("bulk-results-section").classList.remove("hidden");
    for (const file of files) {
      const item = { file, status: "waiting", result: null, error: null, id: Math.random().toString(36).slice(2) };
      bulkState.items.push(item);
    }
    renderBulkList();
    for (const item of bulkState.items.filter((i) => i.status === "waiting")) {
      await processBulkItem(item);
    }
  }

  async function processBulkItem(item) {
    item.status = "uploading";
    renderBulkList();
    try {
      const mime = await Upload.validateFile(item.file);
      const publicId = Utils.sanitizeFilename(item.file.name.replace(/\.[^.]+$/, ""));
      const result = await Upload.uploadFile(item.file, { publicId, filename: item.file.name });
      item.result = result;
      item.status = "done";
    } catch (err) {
      item.status = "error";
      item.error = err.message || "Upload failed.";
    }
    renderBulkList();
    renderBulkTable();
  }

  function renderBulkList() {
    const list = $("bulk-list");
    Utils.clear(list);
    bulkState.items.forEach((item) => {
      const row = Utils.el("div", { class: "bulk-row" },
        Utils.el("img", { src: URL.createObjectURL(item.file), alt: "" }),
        Utils.el("span", { class: "name", text: item.file.name }),
        Utils.el("span", { class: `status-pill ${item.status}`, text: labelFor(item.status) })
      );
      list.appendChild(row);
    });
  }

  function labelFor(status) {
    return { waiting: "Waiting", uploading: "Uploading", done: "Complete", error: "Error" }[status] || status;
  }

  function renderBulkTable() {
    const done = bulkState.items.filter((i) => i.status === "done");
    const tbody = $("bulk-results-body");
    if (!tbody) return;
    Utils.clear(tbody);
    done.forEach((item) => {
      const tr = Utils.el("tr", {},
        Utils.el("td", {}, Utils.el("img", { src: item.result.url, alt: "" })),
        Utils.el("td", { text: Utils.formatBytes(item.file.size) }),
        Utils.el("td", { text: item.result.format || "" }),
        Utils.el("td", { class: "url-cell", text: item.result.url }),
        Utils.el("td", {}, Utils.el("button", {
          class: "btn btn-secondary btn-sm", text: "Copy",
          onclick: () => Utils.copyToClipboard(item.result.url).then(() => Utils.toast("URL copied"))
        }))
      );
      tbody.appendChild(tr);
    });
    $("bulk-table-wrap")?.classList.toggle("hidden", done.length === 0);
  }

  /* ================= MODE SWITCH ================= */
  function initModeSwitch() {
    const buttons = document.querySelectorAll(".mode-switch button");
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".mode-panel").forEach((p) => p.classList.add("hidden"));
        document.getElementById(btn.dataset.mode).classList.remove("hidden");
      });
    });
  }

  /* ================= HISTORY ================= */
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
    Utils.clear(wrap);
    if (!list.length) {
      wrap.appendChild(Utils.el("p", { text: "No uploads yet on this device." }));
      return;
    }
    list.forEach((item) => {
      wrap.appendChild(Utils.el("div", { class: "history-item" },
        Utils.el("img", { src: item.url, alt: "" }),
        Utils.el("div", { class: "meta" },
          Utils.el("div", { class: "name", text: item.name || "image" }),
          Utils.el("div", { class: "date", text: Utils.formatDate(item.date) })
        ),
        Utils.el("button", { class: "btn btn-ghost btn-sm", text: "Copy", onclick: () => Utils.copyToClipboard(item.url).then(() => Utils.toast("URL copied")) })
      ));
    });
  }
  function initHistory() {
    renderHistory();
    $("clear-history-btn")?.addEventListener("click", () => {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
      Utils.toast("History cleared");
    });
  }

  /* ================= URL -> IMAGE TOOL ================= */
  function initUrlToImage() {
    const form = $("url-to-image-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = $("url-to-image-input");
      const url = input.value.trim();
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

  /* ---------------- Errors ---------------- */
  function showError(id, message) {
    const box = $(id);
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
  }
  function clearError(id) {
    const box = $(id);
    if (!box) return;
    box.textContent = "";
    box.classList.add("hidden");
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
    initConfigBanner();
    initModeSwitch();
    initSingleUpload();
    initSnippetTabs();
    initBulkUpload();
    initHistory();
    initUrlToImage();

    if (!navigator.onLine) {
      Utils.toast("You appear to be offline.");
    }
    window.addEventListener("offline", () => Utils.toast("Network connection lost."));
  });
})();
