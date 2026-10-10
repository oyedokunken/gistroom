import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReactionChips } from "../../apps/web/src/components/chat/reaction-chips";

const thumb = "\u{1F44D}";
const fire = "\u{1F525}";

describe("ReactionChips", () => {
  it("shows the emoji and never the word reactions", () => {
    const html = renderToStaticMarkup(
      <ReactionChips
        reactions={[
          { emoji: thumb, count: 1, mine: false },
          { emoji: fire, count: 1, mine: true },
        ]}
      />,
    );
    expect(html).toContain(thumb);
    expect(html).toContain(fire);
    expect(html.toLowerCase()).not.toContain("reaction");
  });
  it("shows a number only when more than one person chose the emoji", () => {
    const one = renderToStaticMarkup(
      <ReactionChips reactions={[{ emoji: thumb, count: 1, mine: false }]} />,
    );
    const many = renderToStaticMarkup(
      <ReactionChips reactions={[{ emoji: thumb, count: 3, mine: false }]} />,
    );
    expect(one).not.toMatch(/>1</);
    expect(many).toMatch(/>3</);
  });
  it("outlines your own reaction in green", () => {
    const html = renderToStaticMarkup(
      <ReactionChips reactions={[{ emoji: thumb, count: 1, mine: true }]} />,
    );
    expect(html).toContain("border-green-600");
  });
});
