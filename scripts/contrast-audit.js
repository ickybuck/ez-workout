/**
 * Contrast audit — paste into the browser console on any screen of the app.
 *
 * Not a node script and not part of the build: the whole point is that it runs
 * against the RENDERED page. Every contrast bug this app has had was invisible
 * to source-level checks, because the failures came from a colour that was
 * never written (an input with a border class and no background), or from one
 * that was written to the wrong role (`bg-surface-overlay text-content-inverse`
 * — white on white in light mode, on the Templates "Add" button). A leftover
 * count over the source says nothing was written wrongly. It cannot say the
 * pairing is right.
 *
 * Walks every element that owns a text node, resolves the first opaque
 * background above it, and reports anything under the WCAG AA threshold for its
 * size. Results are deduplicated by (foreground, background, size), so a list
 * of forty rows collapses to the two or three token pairings actually at fault.
 *
 *   window.__audit()            // this screen
 *   await window.__go(path)     // click through to a route, then audit
 *
 * Check both themes. The device's own setting decides which one you get, so use
 * the browser's prefers-color-scheme emulation rather than trusting one pass.
 */
window.__audit = () => {
  const lum = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map((n) => {
      n /= 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const ratio = (a, b) => {
    const L1 = lum(a);
    const L2 = lum(b);
    if (L1 == null || L2 == null) return null;
    return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2));
  };

  const opaque = (c) => c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c);

  // The element's own background is usually transparent; what the reader
  // actually sees behind the text is the nearest painted ancestor.
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (opaque(c)) return c;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };

  const seen = new Set();
  const out = [];

  for (const el of document.querySelectorAll('body *')) {
    // Only elements that own text directly — otherwise every wrapper reports
    // its children's text against its own colour.
    const txt = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!txt) continue;

    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    // A hidden ancestor hides this too, and a tooltip that is invisible until
    // hover would otherwise fill the report.
    let hidden = false;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) {
        hidden = true;
        break;
      }
    }
    if (hidden) continue;

    const cs = getComputedStyle(el);
    const fg = cs.color;
    const bg = bgOf(el);
    const r = ratio(fg, bg);
    if (r == null) continue;

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;

    if (r < need) {
      const key = `${fg}|${bg}|${Math.round(size)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: txt.slice(0, 32), fg, bg, ratio: r, need, px: size });
    }
  }

  return {
    theme: document.documentElement.className || '(light)',
    path: location.pathname,
    failures: out.length,
    items: out,
  };
};

/** Navigate by clicking a real link, so the SPA router runs and state survives. */
window.__go = async (path) => {
  const a = [...document.querySelectorAll('a')].find((x) => new URL(x.href).pathname === path);
  if (!a) return `no link to ${path}`;
  a.click();
  await new Promise((r) => setTimeout(r, 1800));
  return window.__audit();
};

'contrast audit ready — window.__audit(), window.__go(path)';
