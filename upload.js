/**
 * UPLOAD — validation + optional client-side optimization + real
 * provider upload with real progress via XHR. No fake progress bars,
 * no fake URLs. If the provider isn't configured, callers get a
 * clear error instead of a silent failure.
 */

const Upload = (() => {

  class ValidationError extends Error {}

  async function validateFile(file) {
    const { limits } = CONFIG;

    if (file.size > limits.maxFileSizeMB * 1024 * 1024) {
      throw new ValidationError(`File is too large. Maximum image size is ${limits.maxFileSizeMB} MB.`);
    }

    const sniffed = await Utils.sniffMimeType(file);
    const declared = file.type;

    if (declared === "image/svg+xml" || /\.svg$/i.test(file.name)) {
      if (!limits.allowSvg) {
        throw new ValidationError("SVG uploads are disabled because SVG files can contain active script content.");
      }
    } else if (!sniffed) {
      throw new ValidationError("Unsupported image format.");
    } else if (!limits.acceptedTypes.includes(sniffed)) {
      throw new ValidationError("Unsupported image format.");
    } else if (declared && limits.acceptedTypes.includes(declared) === false && declared !== sniffed) {
      // filename/declared type disagrees with real file signature — reject
      throw new ValidationError("This file's contents don't match its declared type.");
    }

    return sniffed || declared;
  }

  // Client-side optimization using canvas. Only applies to raster,
  // non-animated formats. Returns { blob, mime } or the original file
  // untouched when optimization doesn't apply.
  async function optimizeImage(file, opts) {
    const { quality, maxWidth, targetFormat } = opts;
    const isGif = file.type === "image/gif";
    const isSvg = file.type === "image/svg+xml";
    const noop = quality === "original" && maxWidth === "original" && targetFormat === "keep";

    if (isGif || isSvg || noop) {
      return { blob: file, mime: file.type, changed: false };
    }

    const dims = await Utils.getImageDimensions(file);
    const img = await loadImageBitmap(file);

    let targetW = dims.width;
    if (maxWidth !== "original") {
      const mw = maxWidth === "custom" ? opts.customWidth : parseInt(maxWidth, 10);
      if (mw && mw < dims.width) targetW = mw;
    }
    const scale = targetW / dims.width;
    const targetH = Math.round(dims.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const qualityMap = { original: 0.92, high: 0.85, medium: 0.7, low: 0.5 };
    const q = qualityMap[quality] ?? 0.85;

    let outMime = file.type;
    if (targetFormat === "jpg") outMime = "image/jpeg";
    else if (targetFormat === "png") outMime = "image/png";
    else if (targetFormat === "webp") outMime = "image/webp";
    else if (targetFormat === "avif") outMime = "image/avif";

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Could not encode image")), outMime, q);
    });

    return { blob, mime: outMime, changed: true, width: targetW, height: targetH };
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

  // Uploads a Blob to Cloudinary using an UNSIGNED upload preset.
  // No API secret is ever used here — that's the point of unsigned
  // presets: https://cloudinary.com/documentation/upload_images#unsigned_upload
  function uploadToCloudinary(blob, { publicId, filename, onProgress }) {
    return new Promise((resolve, reject) => {
      if (!isProviderConfigured()) {
        reject(new Error("Storage service unavailable. This site's owner hasn't configured a storage provider yet."));
        return;
      }
      const { cloudName, uploadPreset, folder } = CONFIG.cloudinary;
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const form = new FormData();
      form.append("file", blob, filename || "upload");
      form.append("upload_preset", uploadPreset);
      if (folder) form.append("folder", folder);
      if (publicId) form.append("public_id", publicId);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              url: data.secure_url,
              publicId: data.public_id,
              format: data.format,
              width: data.width,
              height: data.height,
              bytes: data.bytes,
              createdAt: data.created_at
            });
          } else {
            reject(new Error(data?.error?.message || "Upload failed. Please try again."));
          }
        } catch (e) {
          reject(new Error("Upload failed. Please try again."));
        }
      };
      xhr.onerror = () => reject(new Error("Network connection lost."));
      xhr.send(form);
    });
  }

  function uploadToSupabase() {
    return Promise.reject(new Error("Supabase storage is not configured for this deployment. See README.md."));
  }

  async function uploadFile(blob, opts) {
    if (CONFIG.provider === "cloudinary") return uploadToCloudinary(blob, opts);
    if (CONFIG.provider === "supabase") return uploadToSupabase(blob, opts);
    throw new Error("Could not generate public URL. No storage provider configured.");
  }

  return { ValidationError, validateFile, optimizeImage, uploadFile };
})();
