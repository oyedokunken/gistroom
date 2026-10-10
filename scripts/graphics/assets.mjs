// Single source for the illustration asset list (Section 17.2). Used by placeholders.mjs,
// which writes design/assets.manifest.json, design/PROMPTS.md and apps/web/src/content/alt.ts.

export const STYLE_LOCK = `Contemporary African editorial illustration. Warm, confident, human. Flat shapes with soft grain and gentle shading, bold simple forms, one consistent light source from the upper left. Palette locked to green (#0E7A43, #0A5C32, #E4F4EB), yellow (#FFC20E, #FFF4CC), near black (#0B0B0C), white and greys, plus natural skin tones and small warm accents. Characters are Nigerian and varied: different ages, body types, skin tones, hair and head wraps, agbada, ankara, hijab, caps, casual wear. Settings are real gist spaces: a rooftop, a joint under an umbrella, a barbershop, a living room, a campus step, a danfo bus, a football viewing centre, lantern light at night. Show energy through gesture and speaking rings, not caricature. NO text, letters or numbers anywhere in the image. Never: stock photo office scenes, poverty or safari tropes, caricature, real people's likeness, trademarks, the national flag or coat of arms, sacred or ritual symbols, emoji.`;

// kind decides canvas ratio: hero 2400x1600, auth 1200x1600, land 1200x900, state 800x800.
const hero = (id, layer, prompt) => ({
  id,
  kind: "hero",
  transparent: layer !== "back",
  placement: `Landing hero, ${layer} layer`,
  alt: "",
  decorative: true,
  prompt,
});
const auth = (id, placement, alt, prompt) => ({ id, kind: "auth", placement, alt, prompt });
const land = (id, placement, alt, prompt) => ({ id, kind: "land", placement, alt, prompt });
const state = (id, placement, alt, prompt) => ({ id, kind: "state", placement, alt, prompt });

export const ASSETS = [
  hero(
    "hero-back",
    "back",
    "Wide rooftop at golden hour over a Lagos style skyline, adire pattern bunting, soft sound-wave arcs in the sky. Opaque background, no people.",
  ),
  hero(
    "hero-mid",
    "mid",
    "Same canvas as hero-back. Transparent background. Five varied Nigerian friends seated and standing on the rooftop mid-conversation, speaking rings around two of them, a lantern and a small speaker. No text.",
  ),
  hero(
    "hero-front",
    "front",
    "Same canvas as hero-back. Transparent background. Foreground only: plants, an umbrella edge, a plastic stool and a phone propped on a ledge, framing the bottom corners. No people, no text.",
  ),
  auth(
    "auth-login",
    "Sign in page panel",
    "A woman in ankara with a phone smiling at an incoming call, warm evening light.",
    "Portrait. A woman in ankara and head wrap sitting on a doorstep, phone in hand, smiling at a call coming in, warm evening light, adire border at the bottom.",
  ),
  auth(
    "auth-signup",
    "Sign up page panel",
    "Two friends laughing together on a campus step.",
    "Portrait. Two friends on a campus step laughing, one in a cap and one in a hijab, shared earphones, green and yellow accents.",
  ),
  auth(
    "auth-verify",
    "Verify code page panel",
    "A person checking a message on their phone at a roadside joint.",
    "Portrait. A man under an umbrella at a roadside joint checking his phone for a message, lantern glow, calm mood.",
  ),
  auth(
    "auth-onboarding",
    "Onboarding page panel",
    "A group of friends waving hello in a living room.",
    "Portrait. A cheerful group waving hello from a living room with a ceiling fan and framed adire cloth, welcoming gesture.",
  ),
  land(
    "how-1",
    "How it works, step 1: get your code",
    "A person receiving a code by email on their phone.",
    "A young woman on a danfo bus seat reading a code on her phone, soft window light.",
  ),
  land(
    "how-2",
    "How it works, step 2: find your people",
    "Friends searching and adding each other on their phones.",
    "Three friends on a rooftop each holding up phones, connected by thin curved lines in green and yellow.",
  ),
  land(
    "how-3",
    "How it works, step 3: start or join a room",
    "A room of people talking, with speaking rings around two of them.",
    "A barbershop full of varied people mid-talk, speaking rings around two speakers, a clipper and a mirror in the background.",
  ),
  land(
    "how-4",
    "How it works, step 4: keep gisting in chat",
    "Two people sending messages and voice notes to each other.",
    "Two people in different homes, split by a soft diagonal, each smiling at a phone, voice-note waveform arcs between them.",
  ),
  land(
    "safety",
    "Safe by design section",
    "A moderator watching over a lively room with a shield shaped badge.",
    "A calm moderator in agbada seated at a round table with several people, a soft shield shaped lamp glowing behind them.",
  ),
  land(
    "nigeria-data",
    "Built for Nigerian data section",
    "A person using a phone with a small signal icon in a street scene.",
    "A person walking a busy market street talking into earphones, a phone in the other hand, small signal arcs above, audio first mood.",
  ),
  land(
    "final-cta",
    "Final call to action",
    "A big group of friends celebrating together at an owambe.",
    "A joyful owambe scene with friends in matching aso ebi laughing and talking, string lights, warm and welcoming.",
  ),
  land(
    "discover-backdrop",
    "Discover section backdrop",
    "",
    "Soft abstract backdrop of adire resist-dye repeats in pale green and white with a few yellow accents. No people. Tileable.",
  ),
  state(
    "empty-chat",
    "Chats pane with nothing selected",
    "Two speech bubbles waiting on a table.",
    "Two empty speech bubbles on a plastic table beside two glasses of zobo, a friend's chair pulled out, inviting.",
  ),
  state(
    "empty-friends",
    "Friends list empty",
    "A person waving at an empty bench.",
    "A person waving from a bench with space beside them, expectant and friendly.",
  ),
  state(
    "empty-requests",
    "No friend requests",
    "A mailbox with nothing in it and a small plant.",
    "A tidy wooden mailbox with a flag down and a small plant, quiet mood.",
  ),
  state(
    "empty-calls",
    "No calls yet",
    "A phone resting beside a cup of tea.",
    "A phone lying beside a cup of tea on a windowsill, quiet afternoon.",
  ),
  state(
    "empty-rooms",
    "No live rooms",
    "An empty room with chairs in a circle and a lantern.",
    "An empty circle of chairs on a rooftop at dusk with a lantern in the middle, waiting for people.",
  ),
  state(
    "empty-notifications",
    "No notifications",
    "A sleeping bell under a small blanket.",
    "A bell resting on a cushion under a small ankara blanket, calm and sleepy.",
  ),
  state(
    "empty-search",
    "No search results",
    "A magnifying glass over an empty street.",
    "A big magnifying glass held over an empty street corner, curious not sad.",
  ),
  state(
    "empty-archived",
    "Archive is empty",
    "A tidy shelf with an empty box.",
    "A tidy shelf with a neat empty box and a folded adire cloth.",
  ),
  state(
    "empty-starred",
    "No starred messages",
    "A yellow star resting in a calabash.",
    "A single yellow star resting in a calabash bowl, soft light.",
  ),
  state(
    "empty-media",
    "No media in this chat",
    "An empty picture frame leaning on a wall.",
    "An empty picture frame leaning against a wall next to a potted plant.",
  ),
  state(
    "offline",
    "Offline page",
    "A person holding a phone up to look for network.",
    "A person standing on a stool holding a phone up to find network, small dotted signal arcs fading, good humoured.",
  ),
  state(
    "error-500",
    "Server error page",
    "A generator and a loose cable, being fixed by a friendly technician.",
    "A friendly technician crouched beside a small generator with a toolbox, loose cable, reassuring mood.",
  ),
  state(
    "not-found",
    "404 page",
    "A person reading a signpost pointing in many directions.",
    "A person scratching their head at a signpost with blank arrows pointing in many directions, no text on the signs.",
  ),
  state(
    "room-ended",
    "Room has ended",
    "Empty chairs and a lantern after the gist is over.",
    "Chairs pushed in around a table, lantern turned low, a trail of speaking rings fading.",
  ),
  state(
    "room-full",
    "Room is full",
    "A crowded doorway with a small stool outside.",
    "A crowded doorway full of happy people, a spare stool waiting outside.",
  ),
  state(
    "not-invited",
    "Not invited to this private room",
    "A closed door with a lantern beside it.",
    "A closed painted door with a lantern and a doormat, polite not hostile.",
  ),
  state(
    "install-ios",
    "Install guide for iPhone",
    "A phone showing a share button and a home screen.",
    "A stylised phone showing a share icon and a home screen grid with an app tile glowing, no text.",
  ),
  state(
    "install-android",
    "Install guide for Android",
    "A phone showing an install prompt and a home screen.",
    "A stylised phone showing an install card with a green tile glowing, no text.",
  ),
];

export const SIZES = {
  hero: { master: [2400, 1600], widths: [640, 1024, 1600, 2400] },
  auth: { master: [1200, 1600], widths: [640, 1024] },
  land: { master: [1200, 900], widths: [640, 1024] },
  state: { master: [800, 800], widths: [640] },
};
