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
  poly,
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
    id: "scene-village-square",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Rooms call to action: the village square where everybody gathers to gist",
    alt: "Friends gathered under a big tree on a village square, talking in a circle",
    draw: (t) =>
      rect(430, 480, 46, 280, C.clay, 8) +
      circle(350, 330, 170, C.greenDark) +
      circle(560, 300, 190, C.green) +
      circle(470, 210, 140, C.greenDark) +
      lantern(370, 420, t) +
      lantern(600, 390, t) +
      building(40, 720, 130, 300, C.greenTint) +
      building(830, 720, 140, 260, "#CFE9DB") +
      ground(760, 1000) +
      rect(220, 700, 560, 22, C.clay, 8) +
      person(280, 700, {
        skin: SKIN[1],
        shirt: C.yellow,
        hair: "afro",
        size: 1.8,
        arm: "cup",
        sit: true,
      }) +
      person(430, 700, {
        skin: SKIN[3],
        shirt: C.white,
        hair: "wrap",
        cap: C.green,
        size: 1.8,
        sit: true,
        sway: wave(t, 0.2, 1) * 2,
      }) +
      person(580, 700, {
        skin: SKIN[0],
        shirt: C.green,
        hair: "fila",
        cap: C.yellow,
        size: 1.8,
        arm: "up",
        sit: true,
        sway: wave(t, 0.4, 1) * 3,
      }) +
      rings(580, 700 - 250, 44, t, C.yellow) +
      person(720, 700, {
        skin: SKIN[4],
        shirt: C.ink700,
        pants: C.green,
        hair: "hijab",
        cap: C.yellowTint,
        size: 1.8,
        sit: true,
      }) +
      person(840, 760, {
        skin: SKIN[2],
        shirt: C.white,
        hair: "cap",
        cap: C.green,
        size: 1.7,
        arm: "phone",
        sway: wave(t, 0.6, 1) * 2,
      }),
  },
  {
    id: "scene-help-desk",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Support call to action: the help desk where someone is always ready",
    alt: "A helper behind a counter with a laptop, waving at a visitor, with a notes board behind them",
    draw: (t) =>
      rect(560, 180, 320, 260, C.white, 18, `stroke="${C.ink200}" stroke-width="4"`) +
      rect(590, 212, 140, 16, C.green, 8) +
      Array.from({ length: 3 }, (_, i) =>
        rect(
          590,
          252 + i * 58,
          230,
          30,
          i === Math.floor(t * 3) % 3 ? C.yellowTint : C.greenTint,
          8,
        ),
      ).join("") +
      plant(120, 760, 1.4) +
      ground(760, 1000) +
      rect(200, 580, 520, 180, C.greenDark, 14) +
      rect(180, 560, 560, 36, C.ink700, 10) +
      rect(480, 500, 120, 60, C.ink, 8) +
      rect(470, 556, 140, 12, C.ink700, 4) +
      circle(540, 530, 18, pulse(t, 0, 2) > 0.5 ? C.yellow : C.yellowTint) +
      person(340, 700, {
        skin: SKIN[3],
        shirt: C.green,
        hair: "wrap",
        cap: C.yellow,
        size: 1.9,
        arm: "up",
        sit: true,
        sway: wave(t, 0, 1) * 2,
      }) +
      person(820, 760, {
        skin: SKIN[0],
        shirt: C.yellow,
        hair: "fila",
        cap: C.green,
        size: 1.9,
        arm: "cup",
        sway: wave(t, 0.5, 1) * 3,
      }) +
      rings(340, 700 - 300, 46, t, C.yellow),
  },
  {
    id: "scene-door-check",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Acceptable use call to action: the door where the rules keep the gist good",
    alt: "A host at a green doorway with a rope line, checking a list while a guest waits to enter",
    draw: (t) =>
      rect(120, 160, 340, 600, C.greenDark, 16) +
      rect(150, 190, 280, 540, C.green, 12) +
      rect(180, 220, 220, 180, C.yellowTint, 10) +
      circle(410, 480, 14, C.yellow) +
      rect(560, 620, 18, 140, C.ink700, 6) +
      rect(860, 620, 18, 140, C.ink700, 6) +
      `<path d="M560 640 Q710 ${700 + wave(t, 0, 1) * 8} 860 640" stroke="${C.yellow}" stroke-width="12" fill="none" stroke-linecap="round"/>` +
      ground(760, 1000) +
      person(620, 760, {
        skin: SKIN[1],
        shirt: C.ink700,
        pants: C.green,
        hair: "low",
        size: 2.1,
        arm: "up",
        sway: wave(t, 0, 1) * 2,
      }) +
      rect(660, 540, 56, 72, C.white, 6, `transform="rotate(8 688 576)"`) +
      rect(670, 552, 36, 7, C.green, 3) +
      rect(670, 566, 36, 7, C.green, 3) +
      rect(670, 580, 24, 7, C.green, 3) +
      person(800, 760, {
        skin: SKIN[4],
        shirt: C.yellow,
        hair: "hijab",
        cap: C.green,
        size: 1.9,
        arm: "cup",
        sway: wave(t, 0.4, 1) * 2,
      }) +
      bunting(120, 130, 880, 30),
  },
  {
    id: "scene-dev-desk",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "About page, the developer: a clean desk with a laptop and code on the screen",
    alt: "A developer at a tidy desk writing code on a laptop, with a plant and a cup beside them",
    draw: (t) =>
      // wall poster with the logo bars
      rect(110, 120, 230, 170, C.greenTint, 14) +
      rect(130, 168, 30, 66, C.green, 14) +
      rect(172, 130, 30, 104, C.yellow, 14) +
      rect(214, 150, 30, 84, C.green, 14) +
      // sticky notes row
      [0, 1, 2]
        .map(
          (i) =>
            `<g transform="rotate(${(i - 1) * 6} ${390 + i * 62} 170)">` +
            rect(360 + i * 62, 140, 54, 54, i === 1 ? C.yellow : C.greenTint, 6) +
            rect(360 + i * 62, 140, 54, 10, i === 1 ? C.yellow : C.greenTint) +
            "</g>",
        )
        .join("") +
      // wall clock with a hand that sweeps
      circle(620, 180, 52, C.white) +
      circle(620, 180, 52, "none", `stroke="${C.ink}" stroke-width="8"`) +
      `<line x1="620" y1="180" x2="${620 + Math.sin(t * Math.PI * 2) * 32}" y2="${180 - Math.cos(t * Math.PI * 2) * 32}" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>` +
      `<line x1="620" y1="180" x2="640" y2="180" stroke="${C.green}" stroke-width="7" stroke-linecap="round"/>` +
      circle(620, 180, 7, C.ink) +
      // window with sun and a drifting cloud
      rect(730, 100, 230, 280, C.greenTint, 16) +
      rect(750, 120, 190, 240, C.yellowTint, 10) +
      circle(845, 195, 48, C.yellow) +
      circle(800 + wave(t, 0, 1) * 90, 280, 24, C.white) +
      circle(836 + wave(t, 0, 1) * 90, 272, 30, C.white) +
      circle(872 + wave(t, 0, 1) * 90, 282, 22, C.white) +
      ground(800, 1000) +
      // rug under the desk
      `<ellipse cx="530" cy="800" rx="330" ry="46" fill="${C.greenTint}"/>` +
      plant(150, 800, 1.7) +
      // desk
      rect(220, 610, 620, 26, C.clay, 8) +
      rect(250, 636, 22, 160, C.ink700) +
      rect(790, 636, 22, 160, C.ink700) +
      // desk lamp, glow pulsing
      `<polygon points="800,610 860,610 900,470 860,470" fill="${C.yellowTint}" opacity="${0.35 + wave(t, 1, 2) * 0.15}"/>` +
      circle(830, 610, 30, C.ink700) +
      `<line x1="830" y1="600" x2="878" y2="490" stroke="${C.ink700}" stroke-width="14" stroke-linecap="round"/>` +
      circle(878, 480, 26, C.ink) +
      circle(872, 486, 8, C.yellow) +
      // mug with rising steam
      rect(310, 558, 56, 56, C.white, 8) +
      `<path d="M366 574 q18 8 0 26" stroke="${C.white}" stroke-width="9" fill="none"/>` +
      circle(
        326,
        556 - ((t * 80 + 20) % 80),
        7,
        C.ink200,
        `opacity="${0.5 - ((t * 80 + 20) % 80) / 180}"`,
      ) +
      circle(
        348,
        556 - ((t * 80 + 55) % 80),
        6,
        C.ink200,
        `opacity="${0.5 - ((t * 80 + 55) % 80) / 180}"`,
      ) +
      // the developer behind the desk
      person(500, 636, {
        skin: SKIN[1],
        shirt: C.green,
        hair: "low",
        size: 2.1,
        sit: true,
        sway: wave(t, 0, 2) * 3,
      }) +
      rings(500, 636 - 268, 46, t, C.yellow) +
      // big open laptop facing the viewer, real code on screen, cursor blinking
      `<polygon points="560,610 700,610 720,650 540,650" fill="${C.ink700}"/>` +
      rect(548, 418, 200, 192, C.ink, 12) +
      rect(560, 430, 176, 168, C.ink700, 6) +
      rect(560, 430, 24, 168, C.ink) +
      Array.from({ length: 6 }, (_, i) => {
        const lines = [
          ['<tspan fill="#FFC20E">&lt;?php</tspan>'],
          [
            '<tspan fill="#7FD6A4">function</tspan> <tspan fill="#FFFFFF">gist()</tspan> <tspan fill="#7FD6A4">{</tspan>',
          ],
          [
            '  <tspan fill="#7FD6A4">$room</tspan><tspan fill="#FFFFFF">-&gt;</tspan><tspan fill="#FFC20E">join</tspan><tspan fill="#FFFFFF">();</tspan>',
          ],
          [
            '  <tspan fill="#7FD6A4">echo</tspan> <tspan fill="#FFC20E">"wetin dey"</tspan><tspan fill="#FFFFFF">;</tspan>',
          ],
          ['<tspan fill="#7FD6A4">}</tspan>'],
          [
            '<tspan fill="#7FD6A4">git</tspan> <tspan fill="#FFFFFF">push</tspan> <tspan fill="#FFC20E">origin</tspan>',
          ],
        ];
        return (
          (i === Math.floor(t * 6) % 6
            ? rect(560, 438 + i * 27, 176, 20, "#FFFFFF", 0, 'opacity="0.08"')
            : "") +
          `<text x="590" y="453" font-family="Consolas, Menlo, monospace" font-size="14" dy="${i * 27}">${lines[i][0]}</text>`
        );
      }).join("") +
      rect(
        704,
        438 + (Math.floor(t * 6) % 6) * 27,
        9,
        14,
        C.white,
        2,
        `opacity="${Math.floor(t * 12) % 2}"`,
      ) +
      // typing spark drifting up off the keyboard
      rect(508 + wave(t, 0, 3) * 24, 596 - ((t * 70 + 10) % 80), 20, 5, C.yellow, 2) +
      rect(515 + wave(t, 0, 3) * 24, 589 - ((t * 70 + 10) % 80), 5, 20, C.yellow, 2) +
      // code chips bobbing around the scene
      [
        [40, 380, 72, "&lt;/&gt;", 0],
        [210, 470, 84, "PHP", 1],
        [620, 330, 80, "{ ; }", 2],
        [830, 390, 70, "JS", 3],
      ]
        .map(
          ([x, y, w, label, phase]) =>
            `<g transform="translate(${x} ${y + wave(t, phase, 2) * 12}) rotate(${wave(t, phase, 1) * 9} ${w / 2} 22)">` +
            rect(0, 0, w, 44, C.white, 10, `stroke="${C.ink}" stroke-width="4"`) +
            `<text x="${w / 2}" y="31" font-family="Consolas, Menlo, monospace" font-size="21" font-weight="700" fill="${C.ink}" text-anchor="middle">${label}</text>` +
            "</g>",
        )
        .join(""),
  },
  {
    id: "scene-auth-city",
    w: 1000,
    h: 1200,
    animated: true,
    placement: "Sign in page, a city street with a danfo and cars passing",
    alt: "A Lagos street: a yellow danfo and a keke pass tall buildings while people wait at a bus stop",
    draw: (t) =>
      // sky, sun and drifting clouds
      rect(0, 0, 1000, 800, C.greenTint) +
      circle(830, 170, 78, C.yellow) +
      circle(830, 170, 108, "none", `stroke="${C.yellow}" stroke-width="8"`) +
      [0, 1]
        .map(
          (i) =>
            circle(120 + wave(t, i * 0.5, 0.5) * 120 + i * 420, 130 + i * 90, 30, C.white) +
            circle(160 + wave(t, i * 0.5, 0.5) * 120 + i * 420, 120 + i * 90, 38, C.white) +
            circle(202 + wave(t, i * 0.5, 0.5) * 120 + i * 420, 134 + i * 90, 26, C.white),
        )
        .join("") +
      // skyline
      building(30, 800, 150, 400, "#CDE4D6") +
      building(200, 800, 170, 300, C.yellowTint) +
      building(390, 800, 150, 450, "#BFDCCB") +
      building(560, 800, 180, 330, C.yellowTint) +
      building(760, 800, 160, 380, "#CDE4D6") +
      rect(440, 350, 60, 22, C.green) +
      // sidewalk with people waiting at a bus stop
      rect(0, 800, 1000, 44, C.ink200) +
      rect(120, 700, 10, 110, C.ink700) +
      rect(96, 660, 58, 58, C.green, 10) +
      `<path d="M108 690 h34 M108 702 h34" stroke="${C.white}" stroke-width="8" stroke-linecap="round"/>` +
      person(180, 838, {
        skin: SKIN[0],
        shirt: C.yellow,
        arm: "up",
        armWave: wave(t, 0, 6) * 18,
        size: 1.1,
        sway: wave(t, 0, 2) * 4,
      }) +
      person(235, 838, { skin: SKIN[2], shirt: C.green, size: 1.1, arm: "phone" }) +
      person(285, 838, {
        skin: SKIN[4],
        shirt: C.white,
        size: 1.05,
        arm: "cup",
        sway: wave(t, 2, 2) * 2,
      }) +
      // children playing by the road, ball bouncing between them
      person(800, 838, {
        skin: SKIN[1],
        shirt: C.yellow,
        size: 0.68,
        arm: "up",
        armWave: wave(t, 1, 8) * 20,
        sway: wave(t, 1, 4) * 4,
      }) +
      person(862, 838, {
        skin: SKIN[3],
        shirt: C.greenTint,
        size: 0.65,
        arm: "up",
        armWave: wave(t, 3, 8) * 20,
        sway: wave(t, 3, 4) * 4,
      }) +
      circle(831, 818 - Math.abs(wave(t, 0.5, 4)) * 80, 15, C.yellow) +
      circle(
        831,
        818 - Math.abs(wave(t, 0.5, 4)) * 80,
        15,
        "none",
        `stroke="${C.ink}" stroke-width="3"`,
      ) +
      // a police officer directing traffic from the sidewalk
      person(720, 838, {
        skin: SKIN[0],
        shirt: C.ink,
        pants: C.ink700,
        hair: "cap",
        cap: C.ink,
        size: 1.15,
        arm: "up",
        armWave: wave(t, 2, 5) * 22,
        sway: wave(t, 1, 1) * 2,
      }) +
      rect(705, 762, 30, 6, C.yellow, 3) +
      // road with lane dashes sliding past
      rect(0, 844, 1000, 220, C.ink700) +
      Array.from({ length: 9 }, (_, i) =>
        rect(((i * 140 + t * 140) % 1400) - 80, 950, 84, 10, C.yellow, 5),
      ).join("") +
      // traffic: danfo left to right, keke and a small car right to left
      // (phase shifted so the still frame and reduced motion visitors see a busy road too)
      danfo(-380 + ((t + 0.42) % 1) * 1780, 950, 1.05, t) +
      keke(1450 - ((t + 0.55) % 1) * 1750, 1045, 0.95) +
      `<g transform="translate(${1350 - ((t + 0.85) % 1) * 1500} 880)">` +
      rect(0, 20, 150, 42, C.green, 12) +
      rect(28, 0, 88, 30, C.green, 10) +
      rect(38, 6, 30, 20, C.greenTint, 4) +
      rect(76, 6, 30, 20, C.greenTint, 4) +
      circle(38, 66, 15, C.ink) +
      circle(38, 66, 6, C.ink200) +
      circle(112, 66, 15, C.ink) +
      circle(112, 66, 6, C.ink200) +
      "</g>" +
      // an okada weaving through, rider in a yellow vest
      `<g transform="translate(${-220 + ((t + 0.5) % 1) * 1700} 1052)">` +
      circle(0, 34, 15, C.ink) +
      circle(0, 34, 6, C.ink200) +
      circle(64, 34, 15, C.ink) +
      circle(64, 34, 6, C.ink200) +
      `<line x1="0" y1="34" x2="26" y2="12" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>` +
      `<line x1="64" y1="34" x2="52" y2="10" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>` +
      rect(18, 16, 30, 10, C.yellow, 5) +
      `<line x1="52" y1="10" x2="60" y2="0" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>` +
      person(34, 16, {
        skin: SKIN[2],
        shirt: C.yellow,
        pants: C.ink700,
        hair: "cap",
        cap: C.ink,
        size: 0.62,
        sit: true,
      }) +
      "</g>" +
      // birds circling high
      `<path d="M${300 + wave(t, 0, 0.8) * 140} 90 q10 -10 20 0 q10 -10 20 0" stroke="${C.ink700}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M${340 + wave(t, 0.4, 0.8) * 140} 120 q8 -8 16 0 q8 -8 16 0" stroke="${C.ink700}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: "scene-auth-verify",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Verify page, a phone filling its code boxes while a message flies in",
    alt: "A phone on a stand filling six code boxes one by one while a letter flies in",
    draw: (t) => {
      const filled = Math.floor(t * 6.999);
      const fly = 1 - Math.pow(1 - t, 2); // ease out toward the phone
      const ex = 120 + fly * 300;
      const ey = 300 - fly * 130;
      return (
        rect(0, 0, 1000, 1000, C.white) +
        // soft backdrop card
        rect(150, 140, 700, 720, C.greenTint, 24) +
        // the phone on its stand
        rect(360, 260, 280, 460, C.ink, 26) +
        rect(376, 286, 248, 380, C.white, 14) +
        rect(468, 676, 64, 8, C.ink200, 4) +
        rect(430, 720, 140, 18, C.ink700, 6) +
        rect(480, 730, 40, 60, C.ink700) +
        // six code boxes filling one by one
        Array.from({ length: 6 }, (_, i) => {
          const x = 392 + i * 38;
          return (
            rect(
              x,
              380,
              30,
              44,
              i < filled ? C.green : (C.surface2 ?? "#EDEFEA"),
              8,
              `stroke="${C.ink200}" stroke-width="3"`,
            ) +
            (i < filled
              ? `<rect x="${x + 9}" y="${394}" width="12" height="16" rx="3" fill="${C.white}"/>`
              : "") +
            (i === filled ? rect(x - 2, 436, 34, 4, C.yellow, 2) : "")
          );
        }).join("") +
        rect(392, 330, 160, 10, C.ink200, 5) +
        rect(392, 470, 216, 10, C.ink200, 5) +
        rect(392, 490, 140, 10, C.ink200, 5) +
        // the letter flying into the phone
        `<g transform="translate(${ex} ${ey}) rotate(${20 - fly * 20})">` +
        rect(0, 0, 84, 56, C.yellow, 8) +
        poly(
          [
            [0, 0],
            [42, 30],
            [84, 0],
            [84, 8],
            [42, 38],
            [0, 8],
          ],
          C.ink700,
        ) +
        "</g>" +
        // a person checking their own phone beside it
        person(760, 800, {
          skin: SKIN[3],
          shirt: C.green,
          size: 1.25,
          arm: "phone",
          sway: wave(t, 1, 2) * 2,
        }) +
        plant(190, 810, 1.3) +
        ground(810, 1000)
      );
    },
  },
  {
    id: "scene-auth-forgot",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Forgot password page, a letter flying into a mailbox",
    alt: "A letter flying into a green mailbox while a person waits beside it",
    draw: (t) => {
      const fly = t % 1;
      const ex = 130 + fly * 400;
      const ey = 505 - Math.sin(fly * Math.PI) * 150;
      return (
        rect(0, 0, 1000, 1000, C.white) +
        rect(150, 140, 700, 720, C.greenTint, 24) +
        // the mailbox on its post
        rect(560, 620, 36, 150, C.ink700) +
        rect(470, 430, 220, 200, C.green, 20) +
        rect(470, 430, 220, 60, C.greenDark, 20) +
        rect(500, 520, 160, 16, C.ink, 8) +
        rect(640, 380, 14, 60, C.yellow, 6) +
        circle(647, 380 + wave(t, 0, 2) * 8, 16, C.yellow) +
        // the letter arcing into the slot
        `<g transform="translate(${ex} ${ey}) rotate(${-14 + fly * 26})">` +
        rect(0, 0, 88, 58, C.white, 8, `stroke="${C.ink200}" stroke-width="4"`) +
        poly(
          [
            [4, 4],
            [44, 32],
            [84, 4],
          ],
          "none",
        ) +
        `<path d="M4 4 L44 32 L84 4" stroke="${C.ink200}" stroke-width="4" fill="none"/>` +
        "</g>" +
        // the person waiting by the box, cup in hand
        person(320, 800, {
          skin: SKIN[1],
          shirt: C.yellow,
          size: 1.2,
          arm: "cup",
          sway: wave(t, 0, 2) * 2,
        }) +
        plant(880, 810, 1.3) +
        ground(810, 1000)
      );
    },
  },
  {
    id: "scene-auth-onboarding",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Onboarding page, a profile card filling in beside a waving person",
    alt: "A profile card with a photo and a checkmark while a person waves beside it",
    draw: (t) =>
      rect(0, 0, 1000, 1000, C.white) +
      rect(150, 140, 700, 720, C.greenTint, 24) +
      // the profile card on a stand
      rect(390, 640, 200, 140, C.ink700, 10) +
      rect(300, 240, 380, 420, C.white, 20, `stroke="${C.ink200}" stroke-width="4"`) +
      // the avatar in the card, head and shoulders
      circle(490, 390, 74, C.greenTint) +
      circle(490, 375, 40, SKIN[2]) +
      `<path d="M490 355 a40 40 0 0 1 40 26 a40 18 0 0 0 -80 0 a40 40 0 0 1 40 -26" fill="#1A1210"/>` +
      `<path d="M430 440 a60 44 0 0 1 120 0 Z" fill="${C.green}"/>` +
      // name and detail lines drawing in
      rect(400, 500, Math.max(50, 180 * Math.min(1, t * 2)), 16, C.ink, 8) +
      rect(420, 536, Math.max(40, 140 * Math.min(1, Math.max(0, t * 2 - 0.5))), 12, C.ink200, 6) +
      rect(430, 566, Math.max(30, 120 * Math.min(1, Math.max(0, t * 2 - 1))), 12, C.ink200, 6) +
      // the check badge stamping on
      `<g transform="translate(560 560) scale(${0.7 + pulse(t, 0, 3) * 0.35})">` +
      circle(0, 0, 36, C.yellow) +
      `<path d="M-14 0 l10 12 l18 -22" stroke="${C.ink}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      "</g>" +
      // the person presenting the card
      person(750, 800, {
        skin: SKIN[0],
        shirt: C.green,
        size: 1.25,
        arm: "up",
        armWave: wave(t, 1, 6) * 18,
      }) +
      person(240, 810, {
        skin: SKIN[4],
        shirt: C.yellow,
        hair: "wrap",
        cap: C.yellow,
        size: 1.1,
        arm: "phone",
      }) +
      rings(750, 560, 44, t, C.green, 1) +
      ground(820, 1000),
  },
  {
    id: "scene-auth-stadium",
    w: 1000,
    h: 1000,
    animated: true,
    placement: "Sign up page, a packed stadium on match day",
    alt: "A stadium with a bouncing crowd, floodlights and players on a green pitch",
    draw: (t) => {
      const fanRow = (y, flip) =>
        Array.from({ length: 15 }, (_, i) => {
          const x = 92 + i * 56;
          const bob = Math.abs(wave(t, i * 0.35 + flip, 5)) * 8;
          const shirt = [C.white, C.green, C.yellow, C.greenDark][(i + flip) % 4];
          return (
            circle(x, y - bob, 15, SKIN[(i + flip) % SKIN.length]) +
            rect(x - 17, y + 12 - bob, 34, 42, shirt, 8)
          );
        }).join("");
      return (
        rect(0, 0, 1000, 1000, C.white) +
        circle(860, 110, 60, C.yellow) +
        // floodlight masts and their glow
        rect(60, 170, 14, 300, C.ink700) +
        rect(926, 170, 14, 300, C.ink700) +
        `<g transform="translate(30 130) rotate(12)">` +
        rect(0, 0, 110, 44, C.ink, 8) +
        circle(24, 22, 11, C.yellow) +
        circle(55, 22, 11, C.yellow) +
        circle(86, 22, 11, C.yellow) +
        "</g>" +
        `<g transform="translate(860 130) rotate(-12)">` +
        rect(0, 0, 110, 44, C.ink, 8) +
        circle(24, 22, 11, C.yellow) +
        circle(55, 22, 11, C.yellow) +
        circle(86, 22, 11, C.yellow) +
        "</g>" +
        `<polygon points="110,175 320,660 60,660" fill="${C.yellow}" opacity="${0.08 + pulse(t, 0, 1) * 0.05}"/>` +
        `<polygon points="890,175 680,660 940,660" fill="${C.yellow}" opacity="${0.08 + pulse(t, 0.5, 1) * 0.05}"/>` +
        // the stands: three rows of fans bobbing
        rect(60, 300, 880, 96, C.greenTint, 8) +
        fanRow(330, 0) +
        rect(60, 400, 880, 96, C.yellowTint, 8) +
        fanRow(430, 1) +
        rect(60, 500, 880, 96, C.greenTint, 8) +
        fanRow(530, 2) +
        // flags waving on the stands
        rect(130, 210, 6, 110, C.ink700) +
        `<path d="M136 214 l${56 + wave(t, 0, 4) * 8} 14 l-${56 + wave(t, 0, 4) * 8} 16 Z" fill="${C.green}"/>` +
        rect(864, 210, 6, 110, C.ink700) +
        `<path d="M864 214 l${-56 - wave(t, 2, 4) * 8} 14 l${56 + wave(t, 2, 4) * 8} 16 Z" fill="${C.yellow}"/>` +
        // ad boards, no words
        rect(60, 616, 880, 46, C.green, 8) +
        Array.from({ length: 7 }, (_, i) =>
          rect(100 + i * 126, 632, 60, 14, C.white, 7, 'opacity="0.5"'),
        ).join("") +
        // the pitch
        rect(0, 664, 1000, 336, "#2E8B57") +
        rect(0, 664, 1000, 10, "#25764A") +
        `<line x1="500" y1="664" x2="500" y2="1000" stroke="${C.white}" stroke-width="6" opacity="0.7"/>` +
        circle(500, 832, 78, "none", `stroke="${C.white}" stroke-width="6" opacity="0.7"`) +
        circle(500, 832, 9, C.white) +
        // goal at the left edge
        rect(20, 780, 8, 130, C.white, 4) +
        rect(120, 780, 8, 130, C.white, 4) +
        rect(20, 774, 108, 10, C.white, 5) +
        // two players mid-game and the ball in the air
        person(360, 880, {
          skin: SKIN[1],
          shirt: C.white,
          pants: C.ink,
          size: 1.1,
          sway: wave(t, 0, 3) * 6,
        }) +
        person(640, 890, {
          skin: SKIN[3],
          shirt: C.yellow,
          pants: C.ink,
          size: 1.1,
          arm: "up",
          armWave: wave(t, 1, 6) * 14,
          sway: wave(t, 1, 3) * 6,
        }) +
        ball(500 + wave(t, 0, 1) * 130, 940, t, 16)
      );
    },
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
      .webp({ quality: 72, alphaQuality: 80, effort: 5, loop: 0, delay: Array(FRAMES).fill(160) })
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
    loopCount: 0,
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
