/**
 * PUBLIC CLIENT CONFIGURATION
 * ----------------------------------------------------------------
 * Everything in this file is sent to the browser and is visible to
 * anyone who views source. NEVER put secrets here.
 *
 * Safe to put here:      Cloudinary cloud name, unsigned upload preset name,
 *                         Supabase project URL, Supabase anon (public) key.
 * NEVER put here:        Cloudinary API secret, Supabase service-role key,
 *                         database passwords, signing secrets.
 *
 * See README.md for how to obtain these values from your provider's
 * dashboard, and which permissions to set on the unsigned upload preset.
 * ---------------------------------------------------------------- */

const SITE_CONFIG = {
  name: "Image To URL",
  siteUrl: "https://kcm2112007.github.io/Image-to-URL-Converter-Upload-Image-Get-Direct-Link",
  developer: "Kalicharan Murmu",
  githubUrl: "https://github.com/kcm2112007/Image-to-URL-Converter-Upload-Image-Get-Direct-Link",
  contactEmail: "",      // fill in later
  themeColor: "#3654FF"
};

const CONFIG = {
  // "cloudinary" or "supabase". This build ships a working Cloudinary
  // integration because unsigned browser uploads need zero backend,
  // which fits a GitHub Pages / phone-only deploy workflow.
  provider: "cloudinary",

  cloudinary: {
    cloudName: "",        // <-- REQUIRED: your Cloudinary "Cloud name"
    uploadPreset: "",      // <-- REQUIRED: an UNSIGNED upload preset name
    folder: "image-to-url" // optional folder inside your Cloudinary account
  },

  supabase: {
    url: "",               // e.g. "https://xxxx.supabase.co"
    anonKey: "",           // the PUBLIC anon key (not the service-role key)
    bucket: "public-images"
  },

  limits: {
    maxFileSizeMB: 10,
    maxBulkFiles: 20,
    acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
    // SVG can contain active script content. Disabled by default for safety.
    allowSvg: false
  },

  // Toggle analytics. Off by default. Never wire this to image contents.
  analytics: {
    enabled: false,
    provider: "" // document any provider you add, and list it in privacy.html
  }
};

// A tiny runtime check used by app.js to show a "requires configuration"
// banner instead of silently failing when the owner hasn't set up a
// provider yet.
function isProviderConfigured() {
  if (CONFIG.provider === "cloudinary") {
    return Boolean(CONFIG.cloudinary.cloudName && CONFIG.cloudinary.uploadPreset);
  }
  if (CONFIG.provider === "supabase") {
    return Boolean(CONFIG.supabase.url && CONFIG.supabase.anonKey && CONFIG.supabase.bucket);
  }
  return false;
}
