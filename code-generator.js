/**
 * CODE GENERATOR — turns a public image URL into ready-to-paste
 * snippets for the places developers actually use them.
 */

const CodeGen = (() => {

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  function html(url, alt = "Image") {
    return `<img src="${url}" alt="${escapeAttr(alt)}">`;
  }

  function htmlAdvanced(url, { alt = "Image", width, height, lazy = true } = {}) {
    const attrs = [`src="${url}"`, `alt="${escapeAttr(alt)}"`];
    if (lazy) attrs.push('loading="lazy"');
    if (width) attrs.push(`width="${width}"`);
    if (height) attrs.push(`height="${height}"`);
    return `<img\n  ${attrs.join("\n  ")}>`;
  }

  function responsive(url, alt = "Image") {
    return `<img\n  src="${url}"\n  alt="${escapeAttr(alt)}"\n  loading="lazy"\n  decoding="async">`;
  }

  function css(url) {
    return `background-image: url("${url}");`;
  }

  function markdown(url, alt = "Image") {
    return `![${alt}](${url})`;
  }

  function javascript(url) {
    return `const imageUrl = "${url}";`;
  }

  function react(url, alt = "Image") {
    return `<img src="${url}" alt="${escapeAttr(alt)}" />`;
  }

  function bbcode(url) {
    return `[img]${url}[/img]`;
  }

  function all(url, opts = {}) {
    return {
      html: html(url, opts.alt),
      htmlAdvanced: htmlAdvanced(url, opts),
      responsive: responsive(url, opts.alt),
      css: css(url),
      markdown: markdown(url, opts.alt),
      javascript: javascript(url),
      react: react(url, opts.alt),
      bbcode: bbcode(url)
    };
  }

  return { html, htmlAdvanced, responsive, css, markdown, javascript, react, bbcode, all };
})();
