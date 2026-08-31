/**
 * UTILS — validation, sanitization, formatting, safe DOM helpers.
 * No innerHTML with untrusted content anywhere in this project.
 */

const Utils = (() => {

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return "—";
    if (bytes < 1024) return bytes + " B";
    const units = ["KB", "MB", "GB"];
    let val = bytes / 1024, i = 0;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return val.toFixed(val >= 10 ? 0 : 1) + " " + units[i];
  }

  function formatDate(d) {
    return new Date(d).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  // Sanitize a user-supplied filename / public id.
  // - lowercases, strips path separators, blocks traversal, allows [a-z0-9-_]
  function sanitizeFilename(name) {
    if (!name) return "";
    let n = String(name).trim().toLowerCase();
    n = n.replace(/\.[a-z0-9]+$/i, "");     // drop extension, provider adds one
    n = n.replace(/[\\/]+/g, "-");           // no path separators
    n = n.replace(/\.\./g, "-");             // no traversal
    n = n.replace(/[^a-z0-9\-_]+/g, "-");    // strict allow-list
    n = n.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
    return n.slice(0, 80);
  }

  // Real MIME sniffing via file signature (magic bytes) — never trust
  // the filename extension alone.
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
    // AVIF/SVG have less trivial signatures; fall back to browser-reported type
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
  function aspectRatio(w, h) {
    if (!w || !h) return "—";
    const d = gcd(w, h);
    return `${w / d}:${h / d}`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback for older/blocked clipboard permission contexts
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (e2) {
        return false;
      }
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

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function toast(msg) {
    let t = document.getElementById("global-toast");
    if (!t) {
      t = el("div", { id: "global-toast", class: "toast" });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const a = el("a", { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  return {
    formatBytes, formatDate, sanitizeFilename, sniffMimeType,
    getImageDimensions, aspectRatio, copyToClipboard, el, clear,
    toast, downloadTextFile, csvEscape
  };
})();
