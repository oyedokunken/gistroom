# Calls

Status: Planned, Phase 4.

1:1 audio and video on LiveKit. Switching media toggles the camera track in the same room, with no reconnect.

- Ring timeout 45 seconds, enforced by the realtime scheduler and the catch-up sweeper.
- Glare merges two simultaneous calls into one. A busy callee gets a missed call entry.
- Data saver starts calls audio only and caps video at 360p.
