const TOAST_LIBS =
  /(sonner|react-hot-toast|react-toastify|react-hot-toast|notistack|react-simple-toasts|@radix-ui\/react-toast)/;
const VALIDATION_ATTRS = /\s(required|pattern|minLength|maxLength|min|max)(=|\s|\/|>)/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const TOKEN_FILES = [/tokens\.ts$/, /globals\.css$/];

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

/** Returns [{ line, rule, message }]. `file` is a posix style relative path. */
export function checkSource(file, text) {
  const out = [];
  const add = (index, rule, message) => out.push({ line: lineOf(text, index), rule, message });
  const isTokenFile = TOKEN_FILES.some((r) => r.test(file));
  const isMarkup = /\.(tsx|jsx)$/.test(file);

  if (isMarkup) {
    for (const m of text.matchAll(/<select[\s>]/g))
      add(m.index, "R6", "native select, use Select or Combobox");
    for (const m of text.matchAll(/<(input|textarea)\b[^>]*>/gs)) {
      const v = VALIDATION_ATTRS.exec(m[0]);
      if (v) add(m.index, "R5", `HTML validation attribute "${v[1]}"`);
      if (/type=["']email["']/.test(m[0]) && /required/.test(m[0]))
        add(m.index, "R5", "email type validation");
    }
    for (const m of text.matchAll(/<form\b[^>]*>/gs)) {
      if (!/noValidate/.test(m[0])) add(m.index, "R5", "form without noValidate");
    }
    for (const m of text.matchAll(/<img\b[^>]*>/gs)) {
      if (!/\balt=/.test(m[0])) add(m.index, "R13", "img without alt");
    }
    for (const m of text.matchAll(/<Image\b[^>]*>/gs)) {
      if (!/\balt=/.test(m[0])) add(m.index, "R13", "Image without alt");
    }
  }
  for (const m of text.matchAll(/(?:from\s+|require\(|import\()\s*["']([^"']+)["']/g)) {
    if (TOAST_LIBS.test(m[1] ?? "")) add(m.index, "R4", `toast library "${m[1]}"`);
  }
  for (const m of text.matchAll(/(^|[^\w.])alert\(/gm)) add(m.index, "R4", "alert() call");
  for (const m of text.matchAll(
    /localStorage\.(set|get)Item\(\s*["'][^"']*(token|session|secret)[^"']*["']/gi,
  )) {
    add(m.index, "R20", "token in localStorage");
  }
  if (!isTokenFile && /\.(tsx?|css)$/.test(file) && !/\.(test|spec)\./.test(file)) {
    for (const m of text.matchAll(new RegExp(HEX.source, "g"))) {
      const before = text[m.index - 1] ?? "";
      if (/[&\w]/.test(before)) continue; // html entities, ids like abc#fff
      add(m.index, "R11", `raw hex color ${m[0]}`);
    }
    for (const m of text.matchAll(/font-family\s*:\s*[^;}\n]+|fontFamily\s*:\s*["'][^"']+["']/g)) {
      if (/var\(--/.test(m[0])) continue;
      add(m.index, "R11", "raw font-family outside tokens");
    }
  }
  return out;
}
