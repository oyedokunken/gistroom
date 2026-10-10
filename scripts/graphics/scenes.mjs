// Draws the Nigerian scenes in code and exports a still PNG and, for some, an animated WebP with alpha.
// Run: node scripts/graphics/scenes.mjs   (see scripts/graphics/animate.mjs for the animation step)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  C,
  SKIN,
  ball,
  building,
  bunting,
  circle,
  danfo,
  keke,
  lantern,
  person,
  plant,
  pulse,
  rect,
  rings,
  soundBars,
  wave,
  wrap,
} from "./scene-kit.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const masters = path.join(root, "design", "masters", "scenes");
const out = path.join(root, "apps", "web", "public", "images", "scenes");
mkdirSync(masters, { recursive: true });
mkdirSync(out, { recursive: true });

const ground = (y, w, fill = C.ink700) => rect(0, y, w, 34, fill, 0) + rect(0, y, w, 6, C.yellow);

export const SCENES = [
  {
    id: "hero-back",
    w: 1200,
    h: 800,
    animated: false,
    placement: "Landing hero, back layer: Lagos skyline and a bridge at golden hour",
    alt: "",
    draw: () =>
      rect(0, 0, 1200, 800, C.yellowTint) +
      circle(880, 330, 150, C.yellow, 'opacity="0.55"') +
      circle(880, 330, 96, C.yellow) +
      building(40, 640, 110, 260, C.greenTint) +
      building(170, 640, 90, 340, "#CFE9DB") +
      building(280, 640, 130, 210, C.greenTint) +
      building(940, 640, 100, 300, "#CFE9DB") +
      building(1060, 640, 120, 230, C.greenTint) +
      rect(0, 560, 1200, 26, C.greenDark) +
      [150, 560, 980].map((x) => rect(x, 330, 22, 250, C.greenDark)).join("") +
      [150, 560, 980]
        .map(
          (x) =>
            `<path d="M${x + 11} 330 L${x - 220} 560 M${x + 11} 330 L${x + 240} 560" stroke="${C.greenDark}" stroke-width="3" fill="none"/>`,
        )
        .join("") +
      rect(0, 586, 1200, 214, C.green),
  },
  {
    id: "hero-mid",
    w: 1200,
    h: 800,
    animated: true,
    placement: "Landing hero, mid layer: friends gisting on a rooftop",
    alt: "",
    draw: (t) => {
      const b = 650;
      return (
        rect(120, b, 960, 26, C.greenDark, 6) +
        person(260, b, {
          skin: SKIN[2],
          shirt: C.yellow,
          hair: "afro",
          size: 1.5,
          arm: "up",
          sway: wave(t, 0, 1) * 3,
        }) +
        rings(260, b - 190, 60, t, C.green) +
        person(430, b, {
          skin: SKIN[0],
          shirt: C.green,
          hair: "fila",
          cap: C.green,
          size: 1.5,
          arm: "cup",
        }) +
        person(600, b, {
          skin: SKIN[3],
          shirt: C.white,
          hair: "wrap",
          cap: C.yellow,
          size: 1.5,
          arm: "phone",
          sway: wave(t, 0.3, 1) * 2,
        }) +
        rings(600, b - 190, 60, t, C.yellow, 0.3) +
        person(770, b, {
          skin: SKIN[1],
          shirt: C.ink700,
          pants: C.green,
          hair: "low",
          size: 1.5,
          arm: "up",
          sway: wave(t, 0.5, 1) * 3,
        }) +
        person(930, b, { skin: SKIN[4], shirt: C.green, hair: "hijab", cap: C.yellow, size: 1.5 }) +
        rect(1010, b - 70, 60, 70, C.ink, 8) +
        circle(1040, b - 36, 16, C.ink700) +
        lantern(190, b - 60, t) +
        soundBars(360, 250, 12, t, C.yellow, 12, 90) +
        soundBars(700, 220, 10, t, C.green, 12, 80)
      );
    },
  },
  {
    id: "hero-front",
    w: 1200,
    h: 800,
    animated: false,
    placement: "Landing hero, front layer: parapet, plants and bunting",
    alt: "",
    draw: () =>
      bunting(60, 70, 1140, 40) +
      rect(0, 700, 1200, 100, C.greenDark) +
      rect(0, 692, 1200, 14, C.yellow) +
      plant(110, 700, 1.5) +
      plant(1100, 700, 1.4) +
      plant(990, 700, 0.8),
  },
  {
    id: "scene-danfo",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Gist happens everywhere: a morning at the danfo stop",
    alt: "A yellow danfo bus with its conductor waving, and three people chatting on their phones beside it",
    draw: (t) =>
      circle(780, 250, 120, C.yellow, 'opacity="0.5"') +
      circle(780, 250, 70, C.yellow) +
      building(60, 760, 120, 300, C.greenTint) +
      building(200, 760, 90, 220, "#CFE9DB") +
      ground(760, 1000) +
      danfo(60, 760, 1.3, t) +
      person(560, 760, {
        skin: SKIN[1],
        shirt: C.green,
        hair: "low",
        size: 1.7,
        arm: "phone",
        sway: wave(t, 0, 1) * 2,
      }) +
      person(660, 760, {
        skin: SKIN[3],
        shirt: C.yellow,
        hair: "wrap",
        cap: C.green,
        size: 1.7,
        arm: "up",
        sway: wave(t, 0.4, 1) * 3,
      }) +
      person(770, 760, {
        skin: SKIN[0],
        shirt: C.white,
        hair: "fila",
        cap: C.yellow,
        size: 1.7,
        arm: "cup",
      }) +
      rings(660, 760 - 280, 50, t, C.green),
  },
  {
    id: "scene-football-centre",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Gist happens everywhere: an afternoon at the football viewing centre",
    alt: "Fans packed under a shed cheering at a big screen showing a match",
    draw: (t) => {
      const goal = pulse(t, 0, 1) > 0.55;
      return (
        rect(80, 300, 840, 30, C.greenDark, 6) +
        rect(110, 330, 14, 430, C.ink700) +
        rect(876, 330, 14, 430, C.ink700) +
        rect(300, 360, 400, 230, C.ink, 12) +
        rect(312, 372, 376, 206, goal ? C.yellowTint : C.green, 6) +
        circle(500, 475, 38, C.white) +
        rect(312, 520, 376, 58, C.greenDark, 0, 'opacity="0.35"') +
        ground(760, 1000) +
        rect(140, 700, 720, 18, C.yellow, 4) +
        [180, 290, 400, 520, 640, 760]
          .map((x, i) =>
            person(x, 700, {
              skin: SKIN[i % 6],
              shirt: [C.green, C.white, C.yellow, C.white, C.green, C.white][i],
              pants: C.ink700,
              hair: ["afro", "low", "cap", "wrap", "low", "fila"][i],
              cap: C.yellow,
              size: 1.9,
              arm: goal ? "up" : i % 2 ? "cup" : "none",
              sway: goal ? wave(t, i * 0.1, 3) * 4 : 0,
            }),
          )
          .join("") +
        (goal ? circle(500, 200, 28, C.yellow, 'opacity="0.0"') : "")
      );
    },
  },
  {
    id: "scene-suya",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Gist happens everywhere: an evening at the suya stand",
    alt: "A suya seller grilling skewers over glowing coals while two customers chat under a lantern",
    draw: (t) =>
      circle(360, 460, 300, C.yellow, 'opacity="0.18"') +
      lantern(360, 300, t) +
      rect(150, 250, 420, 24, C.green, 8) +
      rect(160, 274, 12, 380, C.ink700) +
      rect(548, 274, 12, 380, C.ink700) +
      ground(760, 1000) +
      rect(200, 560, 320, 170, C.clay, 10) +
      rect(214, 574, 292, 44, C.ink, 6) +
      Array.from({ length: 7 }, (_, i) =>
        rect(
          230 + i * 38,
          566,
          6,
          40,
          C.yellowTint,
          3,
          `transform="rotate(${i % 2 ? 8 : -8} ${233 + i * 38} 586)"`,
        ),
      ).join("") +
      Array.from({ length: 6 }, (_, i) =>
        circle(
          240 + i * 44,
          600 - ((t * 120 + i * 40) % 120),
          8 + (i % 3) * 3,
          C.white,
          `opacity="${0.4 - ((t * 120 + i * 40) % 120) / 400}"`,
        ),
      ).join("") +
      person(360, 560, {
        skin: SKIN[0],
        shirt: C.white,
        hair: "cap",
        cap: C.green,
        size: 1.8,
        arm: "up",
        sway: wave(t, 0, 2) * 2,
      }) +
      person(660, 760, {
        skin: SKIN[3],
        shirt: C.yellow,
        hair: "afro",
        size: 1.8,
        arm: "cup",
        sway: wave(t, 0.2, 1) * 2,
      }) +
      person(780, 760, {
        skin: SKIN[2],
        shirt: C.green,
        hair: "hijab",
        cap: C.yellowTint,
        size: 1.8,
      }) +
      rings(660, 760 - 290, 46, t, C.yellow),
  },
  {
    id: "scene-rooftop",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Gist happens everywhere: a night on the rooftop",
    alt: "Four friends on a rooftop at night with a speaker, string lights and the city behind them",
    draw: (t) =>
      circle(740, 200, 80, C.yellowTint) +
      circle(770, 184, 70, C.night, 'opacity="0.0"') +
      building(60, 720, 130, 360, C.greenDark) +
      building(210, 720, 100, 260, "#134F32") +
      building(700, 720, 120, 330, C.greenDark) +
      building(840, 720, 110, 240, "#134F32") +
      bunting(80, 360, 920, 50) +
      rect(100, 720, 800, 22, C.ink700, 6) +
      rect(100, 742, 800, 34, C.ink) +
      person(280, 720, {
        skin: SKIN[2],
        shirt: C.green,
        hair: "afro",
        size: 1.9,
        arm: "cup",
        sit: false,
        sway: wave(t, 0, 1) * 2,
      }) +
      person(430, 720, {
        skin: SKIN[4],
        shirt: C.yellow,
        hair: "wrap",
        cap: C.white,
        size: 1.9,
        arm: "up",
        sway: wave(t, 0.3, 1) * 3,
      }) +
      person(580, 720, { skin: SKIN[0], shirt: C.white, hair: "fila", cap: C.green, size: 1.9 }) +
      person(720, 720, {
        skin: SKIN[3],
        shirt: C.ink700,
        pants: C.green,
        hair: "low",
        size: 1.9,
        arm: "phone",
      }) +
      rect(830, 650, 70, 70, C.ink700, 8) +
      circle(865, 686, 18, C.ink) +
      soundBars(300, 560, 9, t, C.yellow, 12, 80) +
      lantern(150, 650, t),
  },
  {
    id: "scene-street-football",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Street football with the ball in the air",
    alt: "Two friends playing football on a street with a ball in mid-air",
    draw: (t) =>
      building(60, 700, 160, 320, C.greenTint) +
      building(740, 700, 180, 260, "#CFE9DB") +
      ground(700, 1000) +
      rect(0, 690, 1000, 12, C.ink500) +
      person(320, 700, {
        skin: SKIN[1],
        shirt: C.green,
        hair: "low",
        size: 2,
        arm: "up",
        sway: wave(t, 0, 2) * 6,
      }) +
      person(640, 700, {
        skin: SKIN[3],
        shirt: C.white,
        pants: C.green,
        hair: "afro",
        size: 2,
        arm: "up",
        sway: wave(t, 0.5, 2) * 6,
      }) +
      ball(480, 700, t, 20) +
      rect(850, 560, 14, 140, C.ink700) +
      rect(850, 540, 120, 80, "none", 0, `stroke="${C.white}" stroke-width="4"`),
  },
  {
    id: "scene-keke",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "A keke napep on a Lagos street",
    alt: "A yellow keke napep driving past a plantain stand",
    draw: (t) =>
      building(40, 720, 150, 300, C.greenTint) +
      building(210, 720, 100, 210, "#CFE9DB") +
      ground(720, 1000) +
      rect(700, 600, 220, 14, C.clay) +
      rect(710, 614, 10, 106, C.ink700) +
      rect(900, 614, 10, 106, C.ink700) +
      Array.from(
        { length: 5 },
        (_, i) => `<path d="M${730 + i * 36} 600 q8 -46 22 -14 q4 14 -2 14 Z" fill="${C.yellow}"/>`,
      ).join("") +
      person(780, 720, {
        skin: SKIN[2],
        shirt: C.green,
        hair: "wrap",
        cap: C.yellow,
        size: 1.8,
        arm: "up",
        sway: wave(t, 0.1, 1) * 2,
      }) +
      `<g transform="translate(${360 + wave(t, 0, 1) * 20} 0)">${keke(0, 720, 2.1)}</g>` +
      person(470 + wave(t, 0, 1) * 20, 650, {
        skin: SKIN[0],
        shirt: C.white,
        hair: "cap",
        cap: C.green,
        size: 1.1,
      }),
  },
  {
    id: "scene-barbershop",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "A barbershop with a conversation going",
    alt: "A barber trimming a customer's hair while they talk, with a mirror and a radio on the shelf",
    draw: (t) =>
      rect(100, 250, 800, 20, C.greenDark, 6) +
      rect(150, 270, 700, 440, C.yellowTint, 10) +
      rect(200, 300, 220, 280, C.greenTint, 14) +
      rect(212, 312, 196, 256, "#CFE9DB", 8) +
      rect(480, 330, 300, 14, C.clay, 4) +
      rect(500, 290, 50, 40, C.ink, 6) +
      circle(525, 310, 12, C.ink700) +
      rect(600, 300, 28, 30, C.green, 5) +
      rect(640, 296, 28, 34, C.yellow, 5) +
      ground(720, 1000) +
      rect(250, 600, 130, 120, C.ink700, 14) +
      rect(240, 560, 150, 50, C.ink, 14) +
      person(315, 600, { skin: SKIN[1], shirt: C.green, hair: "low", size: 1.7, sit: true }) +
      person(520, 720, {
        skin: SKIN[3],
        shirt: C.white,
        hair: "cap",
        cap: C.green,
        size: 2,
        arm: "up",
        sway: wave(t, 0, 2) * 3,
      }) +
      rings(520, 720 - 300, 46, t, C.yellow) +
      person(720, 720, {
        skin: SKIN[0],
        shirt: C.yellow,
        hair: "fila",
        cap: C.ink700,
        size: 1.9,
        arm: "cup",
      }),
  },
  {
    id: "scene-moderators",
    w: 1000,
    h: 800,
    animated: true,
    placement: "Safe by design: moderators at a room table with a mute control and an action log",
    alt: "A moderator with a shield badge at a table with a mute button and a list of logged actions, with two members beside them",
    draw: (t) =>
      rect(80, 520, 560, 24, C.greenDark, 8) +
      rect(120, 544, 14, 150, C.ink700) +
      rect(586, 544, 14, 150, C.ink700) +
      person(220, 520, {
        skin: SKIN[1],
        shirt: C.green,
        hair: "fila",
        cap: C.yellow,
        size: 2.1,
        arm: "up",
        sway: wave(t, 0, 1) * 2,
      }) +
      `<path d="M270 330 l36 12 v34 q0 26 -36 40 q-36 -14 -36 -40 v-34 Z" fill="${C.yellow}"/><path d="M256 372 l10 10 l20 -22" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      person(450, 520, {
        skin: SKIN[3],
        shirt: C.white,
        hair: "hijab",
        cap: C.green,
        size: 2.1,
        sway: wave(t, 0.4, 1) * 2,
      }) +
      rect(330, 470, 90, 50, C.ink, 10) +
      circle(375, 495, 16, pulse(t, 0, 1) > 0.5 ? C.red : C.ink700) +
      `<path d="M365 495 h20 M375 485 v20" stroke="${C.white}" stroke-width="3"/>` +
      rect(680, 200, 260, 360, C.white, 18, `stroke="${C.ink200}" stroke-width="4"`) +
      rect(704, 224, 120, 14, C.green, 7) +
      Array.from(
        { length: 5 },
        (_, i) =>
          rect(
            704,
            262 + i * 56,
            212,
            38,
            i === Math.floor(t * 5) % 5 ? C.yellowTint : C.greenTint,
            10,
          ) +
          circle(724, 281 + i * 56, 9, i % 2 ? C.red : C.green) +
          rect(744, 276 + i * 56, 130, 10, C.ink500, 5),
      ).join("") +
      person(780, 690, { skin: SKIN[4], shirt: C.yellow, hair: "afro", size: 1.9 }),
  },
  {
    id: "scene-final-cta",
    w: 1000,
    h: 800,
    animated: true,
    placement: "Final call to action: friends welcoming you into a room",
    alt: "Friends waving you in around a glowing circle of sound",
    draw: (t) =>
      circle(500, 420, 260, C.yellow, `opacity="${0.15 + pulse(t, 0, 1) * 0.15}"`) +
      circle(500, 420, 170, C.yellow, 'opacity="0.35"') +
      soundBars(380, 480, 12, t, C.green, 14, 120) +
      ground(640, 1000, C.greenDark) +
      [150, 300, 700, 850]
        .map((x, i) =>
          person(x, 640, {
            skin: SKIN[i + 1],
            shirt: [C.green, C.yellow, C.white, C.green][i],
            hair: ["afro", "wrap", "fila", "hijab"][i],
            cap: [C.yellow, C.green, C.green, C.yellow][i],
            size: 2,
            arm: i % 2 ? "up" : "none",
            sway: wave(t, i * 0.2, 1) * 3,
          }),
        )
        .join(""),
  },
];

const FRAMES = 8;
const manifestFile = path.join(root, "design", "assets.manifest.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const now = new Date().toISOString();
const only = process.argv.slice(2);

for (const scene of SCENES) {
  if (only.length && !only.includes(scene.id)) continue;
  const still = wrap(scene.w, scene.h, scene.draw(0));
  writeFileSync(path.join(masters, `${scene.id}.svg`), still);
  const width = 1024;
  const height = Math.round((scene.h / scene.w) * width);
  await sharp(Buffer.from(still), { density: 144 })
    .resize(width, height)
    .png({ compressionLevel: 9, palette: true, quality: 85 })
    .toFile(path.join(out, `${scene.id}.png`));

  const sizes = [{ width, height, file: `scenes/${scene.id}.png` }];
  let animatedFile = null;
  if (scene.animated) {
    // Frames are drawn at a smaller size to stay inside the data budget, then joined into one animated WebP.
    const aw = 720;
    const ah = Math.round((scene.h / scene.w) * aw);
    const buffers = [];
    for (let f = 0; f < FRAMES; f++) {
      const frame = wrap(scene.w, scene.h, scene.draw(f / FRAMES));
      buffers.push(
        await sharp(Buffer.from(frame), { density: 96 })
          .resize(aw, ah)
          .ensureAlpha()
          .raw()
          .toBuffer(),
      );
    }
    const joined = Buffer.concat(buffers);
    animatedFile = `scenes/${scene.id}.webp`;
    const info = await sharp(joined, {
      raw: { width: aw, height: ah * FRAMES, channels: 4, pageHeight: ah },
    })
      .webp({ quality: 72, alphaQuality: 80, effort: 5, loop: 3, delay: Array(FRAMES).fill(160) })
      .toFile(path.join(out, `${scene.id}.webp`));
    sizes.push({ width: aw, height: ah, file: animatedFile, animated: true, bytes: info.size });
    process.stdout.write(`${scene.id}: still ok, animated ${Math.round(info.size / 1024)} KB\n`);
  } else {
    process.stdout.write(`${scene.id}: still ok\n`);
  }

  const entry = {
    id: scene.id,
    placement: scene.placement,
    master: `design/masters/scenes/${scene.id}.svg`,
    sizes,
    alt: scene.alt,
    decorative: scene.alt === "",
    animated: scene.animated,
    static: `scenes/${scene.id}.png`,
    loopCount: scene.animated ? 3 : 0,
    prompt:
      "Drawn in code by scripts/graphics/scenes.mjs: flat vector scene, brand palette, no text.",
    status: "DRAFT",
    createdAt: now,
  };
  const at = manifest.assets.findIndex((a) => a.id === scene.id);
  if (at === -1) manifest.assets.push(entry);
  else manifest.assets[at] = { ...entry, createdAt: manifest.assets[at].createdAt };
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
