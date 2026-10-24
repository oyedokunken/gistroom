import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { footer, hero, nav } from "../../apps/web/src/content/landing";

const APP = path.join(process.cwd(), "apps", "web", "src", "app");

/** True when a page.tsx or route.ts answers this URL path. Route groups and dynamic folders are handled. */
function routeExists(urlPath: string, dir = APP): boolean {
  const segments = urlPath.split("?")[0]!.split("/").filter(Boolean);
  const match = (folder: string, rest: string[]): boolean => {
    if (rest.length === 0) {
      if (existsSync(path.join(folder, "page.tsx")) || existsSync(path.join(folder, "route.ts")))
        return true;
      // A route group folder may hold the page.
      return readdirSync(folder).some((n) => /^\(.+\)$/.test(n) && match(path.join(folder, n), []));
    }
    const [head, ...tail] = rest;
    for (const name of readdirSync(folder)) {
      const full = path.join(folder, name);
      if (!statSync(full).isDirectory()) continue;
      if (/^\(.+\)$/.test(name)) {
        if (match(full, rest)) return true;
      } else if (name === head && match(full, tail)) return true;
      else if (/^\[[^\]]+\]$/.test(name) && match(full, tail)) return true;
    }
    return false;
  };
  return match(dir, segments);
}

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(tsx?|ts)$/.test(name)) out.push(full);
  }
  return out;
}

describe("every link in the public header and footer goes somewhere", () => {
  const hrefs = new Set<string>([
    ...nav.items.map((i) => i.href),
    nav.cta.href,
    ...nav.moreItems.map((i) => i.href),
    hero.primary.href,
    hero.secondary.href,
    ...footer.columns
      .flatMap((c) => c.links.map((l) => l.href))
      .filter((href) => !href.startsWith("#")),
  ]);
  for (const href of hrefs) {
    it(`${href} has a page`, () => {
      expect(routeExists(href), `no page for ${href}`).toBe(true);
    });
  }
});

describe("the 404 and error pages stand alone", () => {
  const chrome = /(components\/landing|components\/public|VoiceDock|PublicPage|landing\/footer)/;
  const standalone = [
    path.join(APP, "not-found.tsx"),
    path.join(APP, "error.tsx"),
    path.join(APP, "global-error.tsx"),
    ...files(path.join(process.cwd(), "apps", "web", "src", "components", "system")),
  ];
  for (const file of standalone) {
    it(`${path.relative(process.cwd(), file)} does not use the public header or footer`, () => {
      expect(readFileSync(file, "utf8")).not.toMatch(chrome);
    });
  }

  it("no layout applies the public header or footer, so notFound() can never pull them in", () => {
    const layouts = files(APP).filter((f) => /layout\.tsx$/.test(f));
    expect(layouts.length).toBeGreaterThan(0);
    for (const file of layouts) expect(readFileSync(file, "utf8"), file).not.toMatch(chrome);
  });

  it("every not-found file is standalone too", () => {
    for (const file of files(APP).filter((f) => /not-found\.tsx$/.test(f))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(chrome);
    }
  });
});
