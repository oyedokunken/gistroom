import { describe, expect, it } from "vitest";
import { jsonLdString, organizationJsonLd, websiteJsonLd } from "../../apps/web/src/lib/jsonld";

describe("json-ld", () => {
  it("serialises to parseable JSON with schema.org context", () => {
    for (const block of [organizationJsonLd(), websiteJsonLd()]) {
      const parsed = JSON.parse(jsonLdString(block));
      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBeTruthy();
    }
  });
  it("cannot close the script tag", () => {
    expect(jsonLdString({ a: "</script>" })).not.toContain("</script>");
  });
});
