# Edge Cases

Status: Grows with each phase.

Known edge cases and how the product handles them.

- Render sleeps or restarts: clients reconnect with backoff and resync by cursor. Joining a call or Room does not depend on the realtime service.
- Graphik has no naira sign or Yoruba, Igbo and Hausa letters: Noto Sans covers them through `unicode-range` (Decisions D15).
- A nonce based CSP breaks prerendered pages, so every page renders per request (Decisions D20).
