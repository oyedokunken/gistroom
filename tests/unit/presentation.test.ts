import { describe, expect, it } from "vitest";
import {
  LIMITS,
  PRESENT_QUALITY_FULL,
  PRESENT_QUALITY_REDUCED,
  canCaptureScreen,
  noPresentation,
  presentActionSchema,
  presentQuality,
  presentationFromColumns,
  presentationFromDto,
  presentationReducer,
  presentationRules,
  presentationToColumns,
  settle,
  type PresentRulesInput,
  type PresentationEvent,
  type PresentationState,
} from "../../packages/shared/src";

const NOW = 1_800_000_000_000;
const state = (over: Partial<PresentationState> = {}): PresentationState => ({
  ...noPresentation,
  ...over,
});

const room = (over: Partial<PresentRulesInput> = {}): PresentRulesInput => ({
  scope: "room",
  role: "MEMBER",
  memberState: "JOINED",
  session: "LIVE",
  locked: false,
  viewerId: "me",
  state: noPresentation,
  presenterRole: null,
  now: NOW,
  ...over,
});

const call = (over: Partial<PresentRulesInput> = {}): PresentRulesInput => ({
  scope: "call",
  role: "CALLER",
  memberState: null,
  session: "LIVE",
  locked: false,
  viewerId: "me",
  state: noPresentation,
  presenterRole: null,
  now: NOW,
  ...over,
});

describe("presentation rules: who may start", () => {
  it("lets the caller and the callee present in a live call", () => {
    expect(presentationRules(call({ role: "CALLER" })).canStart).toBe(true);
    expect(presentationRules(call({ role: "CALLEE" })).canStart).toBe(true);
  });
  it("lets the host, a moderator and a member present in a live room", () => {
    for (const role of ["HOST", "MODERATOR", "MEMBER"] as const) {
      expect(presentationRules(room({ role })).canStart).toBe(true);
    }
  });
  it("keeps the right to present in a locked room for people already inside", () => {
    expect(presentationRules(room({ locked: true })).canStart).toBe(true);
  });
  it("refuses a removed person, a banned person and someone who is not in the room", () => {
    expect(presentationRules(room({ memberState: "REMOVED" }))).toMatchObject({
      canStart: false,
      denied: "REMOVED",
    });
    expect(presentationRules(room({ memberState: "BANNED" }))).toMatchObject({
      canStart: false,
      denied: "BANNED",
    });
    expect(presentationRules(room({ role: null, memberState: null }))).toMatchObject({
      canStart: false,
      denied: "NOT_IN",
    });
    expect(presentationRules(room({ memberState: "LEFT" })).denied).toBe("NOT_IN");
    expect(presentationRules(room({ memberState: "INVITED" })).canStart).toBe(false);
  });
  it("refuses everything once the session ended or before it started", () => {
    const ended = presentationRules(room({ role: "HOST", session: "ENDED" }));
    expect(ended).toMatchObject({ canStart: false, canStopOwn: false, denied: "ENDED" });
    expect(presentationRules(call({ session: "ENDED" })).denied).toBe("ENDED");
    expect(presentationRules(call({ session: "NOT_STARTED" })).denied).toBe("NOT_STARTED");
    expect(presentationRules(room({ session: "NOT_STARTED" })).canStart).toBe(false);
  });
});

describe("presentation rules: one presenter at a time", () => {
  const busy = state({ presenterId: "other" });

  it("tells a second person it is busy and lets them ask", () => {
    const r = presentationRules(room({ state: busy, presenterRole: "MEMBER" }));
    expect(r).toMatchObject({ canStart: false, denied: "BUSY", canAsk: true });
    expect(r.canForceStop).toBe(false);
    expect(r.canTakeOver).toBe(false);
  });
  it("lets the presenter stop their own and nothing else", () => {
    const r = presentationRules(room({ state: state({ presenterId: "me" }) }));
    expect(r).toMatchObject({ canStopOwn: true, canStart: false, canAsk: false });
  });
  it("shows the presenter a request to answer only while one is open", () => {
    const open = state({ presenterId: "me", requesterId: "x", requestExpiresAt: NOW + 5000 });
    expect(presentationRules(room({ state: open })).canAnswerRequest).toBe(true);
    const stale = state({ presenterId: "me", requesterId: "x", requestExpiresAt: NOW - 1 });
    expect(presentationRules(room({ state: stale })).canAnswerRequest).toBe(false);
  });
  it("lets only one person ask for the next turn, and the asker cancel", () => {
    const asked = state({ presenterId: "other", requesterId: "x", requestExpiresAt: NOW + 5000 });
    expect(presentationRules(room({ state: asked })).canAsk).toBe(false);
    const mine = state({ presenterId: "other", requesterId: "me", requestExpiresAt: NOW + 5000 });
    expect(presentationRules(room({ state: mine })).canCancelAsk).toBe(true);
  });
  it("reserves the turn for the person a presenter handed over to", () => {
    const handed = state({ handoffToId: "x", handoffExpiresAt: NOW + 5000 });
    expect(presentationRules(room({ state: handed }))).toMatchObject({
      canStart: false,
      denied: "HANDOFF_RESERVED",
    });
    expect(presentationRules(room({ viewerId: "x", state: handed })).canStart).toBe(true);
    // The reservation lapses by itself.
    const lapsed = state({ handoffToId: "x", handoffExpiresAt: NOW - 1 });
    expect(presentationRules(room({ state: lapsed })).canStart).toBe(true);
  });
});

describe("presentation rules: stopping someone else", () => {
  const busy = state({ presenterId: "other" });
  it("lets the host stop a moderator or a member, never themselves", () => {
    for (const presenterRole of ["MODERATOR", "MEMBER"] as const) {
      const r = presentationRules(room({ role: "HOST", state: busy, presenterRole }));
      expect(r.canForceStop).toBe(true);
      expect(r.canTakeOver).toBe(true);
    }
  });
  it("lets a moderator stop a member only", () => {
    expect(
      presentationRules(room({ role: "MODERATOR", state: busy, presenterRole: "MEMBER" }))
        .canForceStop,
    ).toBe(true);
    expect(
      presentationRules(room({ role: "MODERATOR", state: busy, presenterRole: "HOST" }))
        .canForceStop,
    ).toBe(false);
    expect(
      presentationRules(room({ role: "MODERATOR", state: busy, presenterRole: "MODERATOR" }))
        .canForceStop,
    ).toBe(false);
  });
  it("never lets a member stop anyone", () => {
    expect(
      presentationRules(room({ role: "MEMBER", state: busy, presenterRole: "MEMBER" }))
        .canForceStop,
    ).toBe(false);
  });
  it("never lets one person in a call stop the other", () => {
    const r = presentationRules(call({ state: busy, presenterRole: "CALLEE" }));
    expect(r.canForceStop).toBe(false);
    expect(r.canTakeOver).toBe(false);
    expect(r.canAsk).toBe(true);
  });
});

const run = (s: PresentationState, e: PresentationEvent) => presentationReducer(s, e);

describe("presentation state machine", () => {
  it("starts and ignores a duplicate start from the presenter", () => {
    const first = run(noPresentation, { type: "start", by: "a", now: NOW });
    expect(first).toMatchObject({ outcome: "started", state: { presenterId: "a" } });
    expect(run(first.state, { type: "start", by: "a", now: NOW }).outcome).toBe("unchanged");
  });
  it("never replaces the presenter by starting", () => {
    const s = state({ presenterId: "a" });
    const r = run(s, { type: "start", by: "b", now: NOW });
    expect(r).toMatchObject({ outcome: "busy", state: { presenterId: "a" } });
  });
  it("stops when the presenter stops, ends the share in the browser or drops", () => {
    for (const cause of ["self", "browser", "disconnect", "left", "removed"] as const) {
      const r = run(state({ presenterId: "a" }), { type: "stop", cause, userId: "a" });
      expect(r).toMatchObject({
        outcome: "stopped",
        previousPresenterId: "a",
        state: { presenterId: null },
      });
    }
  });
  it("ignores a stop that names someone who is not presenting", () => {
    const r = run(state({ presenterId: "a" }), { type: "stop", cause: "browser", userId: "b" });
    expect(r).toMatchObject({ outcome: "not-presenter", state: { presenterId: "a" } });
    const none = run(noPresentation, { type: "stop", cause: "self", userId: "a" });
    expect(none.outcome).toBe("unchanged");
  });
  it("lets a moderator stop whoever presents", () => {
    const r = run(state({ presenterId: "a" }), { type: "stop", cause: "moderator" });
    expect(r).toMatchObject({ outcome: "stopped", previousPresenterId: "a" });
  });
  it("wipes requests and handoffs when the session ends or is cleaned up", () => {
    const busy = state({
      presenterId: "a",
      requesterId: "b",
      requestExpiresAt: NOW + 9000,
    });
    for (const cause of ["session-ended", "cleanup"] as const) {
      expect(run(busy, { type: "stop", cause }).state).toEqual(noPresentation);
    }
  });
  it("runs a full handoff: ask, allow, only the asker may start", () => {
    const presenting = state({ presenterId: "a" });
    const asked = run(presenting, { type: "request", by: "b", now: NOW });
    expect(asked).toMatchObject({ outcome: "requested", state: { requesterId: "b" } });
    expect(asked.state.requestExpiresAt).toBe(NOW + LIMITS.PRESENT_REQUEST_TTL_SEC * 1000);

    const handed = run(asked.state, { type: "accept", by: "a", now: NOW + 1000 });
    expect(handed).toMatchObject({
      outcome: "handed",
      previousPresenterId: "a",
      requesterId: "b",
      state: { presenterId: null, handoffToId: "b", requesterId: null },
    });

    expect(run(handed.state, { type: "start", by: "c", now: NOW + 2000 }).outcome).toBe(
      "handoff-reserved",
    );
    expect(run(handed.state, { type: "start", by: "b", now: NOW + 2000 })).toMatchObject({
      outcome: "started",
      state: { presenterId: "b", handoffToId: null },
    });
    // After the window the turn is free for anyone.
    const late = NOW + 1000 + LIMITS.PRESENT_HANDOFF_SEC * 1000 + 1;
    expect(run(handed.state, { type: "start", by: "c", now: late }).outcome).toBe("started");
  });
  it("lets the presenter decline, and tells who was declined", () => {
    const asked = state({ presenterId: "a", requesterId: "b", requestExpiresAt: NOW + 9000 });
    const r = run(asked, { type: "decline", by: "a" });
    expect(r).toMatchObject({
      outcome: "denied",
      requesterId: "b",
      state: { presenterId: "a", requesterId: null },
    });
  });
  it("keeps one pending request and lets the asker cancel", () => {
    const asked = state({ presenterId: "a", requesterId: "b", requestExpiresAt: NOW + 9000 });
    expect(run(asked, { type: "request", by: "c", now: NOW }).outcome).toBe("request-taken");
    expect(run(asked, { type: "cancel-request", by: "c" }).outcome).toBe("no-request");
    expect(run(asked, { type: "cancel-request", by: "b" }).outcome).toBe("request-cancelled");
  });
  it("rejects an answer from anyone but the presenter, or with nothing to answer", () => {
    const asked = state({ presenterId: "a", requesterId: "b", requestExpiresAt: NOW + 9000 });
    expect(run(asked, { type: "accept", by: "z", now: NOW }).outcome).toBe("not-presenter");
    expect(run(state({ presenterId: "a" }), { type: "accept", by: "a", now: NOW }).outcome).toBe(
      "no-request",
    );
    expect(run(state({ presenterId: "a" }), { type: "decline", by: "a" }).outcome).toBe(
      "no-request",
    );
  });
  it("lets an expired request be replaced and reports the expiry on a tick", () => {
    const old = state({ presenterId: "a", requesterId: "b", requestExpiresAt: NOW - 1 });
    expect(run(old, { type: "tick", now: NOW }).outcome).toBe("expired");
    expect(run(old, { type: "request", by: "c", now: NOW })).toMatchObject({
      outcome: "requested",
      state: { requesterId: "c" },
    });
  });
  it("takes over and reports who lost the turn", () => {
    const r = run(state({ presenterId: "a", requesterId: "b", requestExpiresAt: NOW + 9 }), {
      type: "take-over",
      by: "m",
    });
    expect(r).toMatchObject({
      outcome: "taken",
      previousPresenterId: "a",
      state: { presenterId: "m", requesterId: null },
    });
  });
  it("settles a lapsed request and handoff", () => {
    const s = state({
      requesterId: "b",
      requestExpiresAt: NOW - 1,
      handoffToId: "c",
      handoffExpiresAt: NOW - 1,
    });
    expect(settle(s, NOW)).toEqual(noPresentation);
    expect(settle(noPresentation, NOW)).toBe(noPresentation);
  });
});

describe("presentation columns and wire shapes", () => {
  it("round trips a request and a handoff through the database columns", () => {
    const asked = state({
      presenterId: "a",
      requesterId: "b",
      requestExpiresAt: NOW + LIMITS.PRESENT_REQUEST_TTL_SEC * 1000,
    });
    expect(presentationFromColumns(presentationToColumns(asked))).toEqual(asked);
    const handed = state({
      handoffToId: "b",
      handoffExpiresAt: NOW + LIMITS.PRESENT_HANDOFF_SEC * 1000,
    });
    const cols = presentationToColumns(handed);
    expect(cols.presentRequesterId).toBe("b");
    expect(cols.presentHandoffAt?.getTime()).toBe(NOW);
    expect(presentationFromColumns(cols)).toEqual(handed);
    expect(presentationToColumns(noPresentation)).toEqual({
      presenterId: null,
      presentRequesterId: null,
      presentRequestedAt: null,
      presentHandoffAt: null,
    });
  });
  it("validates actions and refuses unknown ones", () => {
    expect(presentActionSchema.safeParse({ action: "start" }).success).toBe(true);
    expect(presentActionSchema.safeParse({ action: "force-stop" }).success).toBe(true);
    expect(presentActionSchema.safeParse({ action: "record" }).success).toBe(false);
    expect(presentActionSchema.safeParse({}).success).toBe(false);
  });
  it("never carries a source name in the state it hands to a tab", () => {
    const dto = {
      scope: "room" as const,
      meId: "me",
      presenter: { id: "a", name: "Ada" },
      requester: null,
      requestExpiresAt: null,
      handoffTo: null,
      handoffExpiresAt: null,
      serverNow: new Date(NOW).toISOString(),
    };
    expect(presentationFromDto(dto).presenterId).toBe("a");
    expect(Object.keys(dto)).not.toContain("title");
    expect(Object.keys(dto)).not.toContain("source");
  });
});

describe("presentation limits and quality", () => {
  it("allows one presenter and short turns", () => {
    expect(LIMITS.PRESENT_MAX_PRESENTERS).toBe(1);
    expect(LIMITS.PRESENT_REQUEST_TTL_SEC).toBeGreaterThan(0);
    expect(LIMITS.PRESENT_HANDOFF_SEC).toBeGreaterThan(0);
  });
  it("caps data saver sharing below full quality", () => {
    expect(presentQuality(true)).toBe(PRESENT_QUALITY_REDUCED);
    expect(presentQuality(false)).toBe(PRESENT_QUALITY_FULL);
    expect(PRESENT_QUALITY_REDUCED.height).toBeLessThan(PRESENT_QUALITY_FULL.height);
    expect(PRESENT_QUALITY_REDUCED.frameRate).toBeLessThan(PRESENT_QUALITY_FULL.frameRate);
  });
  it("explains an unsupported browser, a phone and an insecure page", () => {
    const base = { hasGetDisplayMedia: true, isSecureContext: true, coarsePointer: false };
    expect(canCaptureScreen(base)).toEqual({ ok: true });
    expect(canCaptureScreen({ ...base, hasGetDisplayMedia: false })).toEqual({
      ok: false,
      reason: "UNSUPPORTED",
    });
    expect(canCaptureScreen({ ...base, hasGetDisplayMedia: false, coarsePointer: true })).toEqual({
      ok: false,
      reason: "MOBILE",
    });
    expect(canCaptureScreen({ ...base, isSecureContext: false })).toEqual({
      ok: false,
      reason: "INSECURE",
    });
  });
});
