export const LIMITS = {
  // Rooms
  ROOM_MAX_PARTICIPANTS: 32,
  ROOM_MAX_VIDEO_PUBLISHERS: 32,
  ROOM_TITLE_MAX: 80,
  ROOM_REJOIN_GRACE_SEC: 120,
  ROOM_EMPTY_END_GRACE_SEC: 60,
  INVITE_LINK_DEFAULT_TTL_HOURS: 24,
  INVITE_LINK_TTL_OPTIONS_HOURS: [1, 12, 24, 168],
  // Calls
  CALL_RING_TIMEOUT_SEC: 45,
  /** The other person in a 1:1 call stays disconnected this long and the call ends. */
  CALL_PEER_GONE_SEC: 60,
  /** A call or room participant that stops sending heartbeats this long counts as left. */
  HEARTBEAT_GONE_SEC: 20,
  /** A removed person can come back to a public room after this long. */
  ROOM_REMOVE_COOLDOWN_MIN: 10,
  /** Rooms end after this long, with a warning 15 minutes before. */
  ROOM_MAX_DURATION_HOURS: 8,
  /** A live room with nobody connected for this long is ended by the sweeper. */
  ROOM_EMPTY_SWEEP_MIN: 5,
  /** The host dropped. Everyone sees "Host is reconnecting" this long, then the room passes on. */
  HOST_RECONNECT_GRACE_SEC: 120,
  /** One ring per person every 30 seconds, and at most three rings per room in ten minutes. */
  ROOM_RING_COOLDOWN_SEC: 30,
  ROOM_RING_PER_ROOM: 3,
  ROOM_RING_WINDOW_MIN: 10,
  // Rooms, schedule
  ROOM_REMINDER_LEAD_MIN: 15,
  /** A reminder that is more than this late is dropped in favour of "live now", or nothing. */
  ROOM_REMINDER_LATE_MIN: 10,
  /** A scheduled room whose host has not started it this long after its time is cancelled. */
  ROOM_SCHEDULE_GRACE_MIN: 30,
  /** Above this many people, join and leave notices become a single count chip. */
  ROOM_CHIP_CROWD: 24,
  /** Join and leave sounds only play in rooms this small. */
  ROOM_SOUND_MAX_PEOPLE: 12,
  // Auth
  OTP_LENGTH: 6,
  OTP_TTL_MIN: 10,
  OTP_RESEND_COOLDOWN_SEC: 60,
  OTP_MAX_ATTEMPTS: 5,
  OTP_SENDS_PER_HOUR: 5,
  SESSION_DAYS: 30,
  /** A session never lives longer than this, however active the person is. */
  SESSION_MAX_DAYS: 90,
  /** Ended sessions stay this long before the sweep removes them. */
  SESSION_SWEEP_GRACE_DAYS: 7,
  /** Sensitive actions need a sign in this recent. */
  RECENT_AUTH_MIN: 15,
  /** After a session ends, a device still gets plain alerts this long. */
  PUSH_GRACE_DAYS: 30,
  /** A subscription with no successful delivery for this long is removed. */
  PUSH_STALE_DAYS: 90,
  /** In a row, before a device is called unhealthy. */
  PUSH_UNHEALTHY_FAILURES: 3,
  DEVICE_COOKIE_DAYS: 365,
  REALTIME_PASS_MIN: 15,
  // Social
  FRIEND_REQUEST_COOLDOWN_DAYS: 7,
  FRIEND_REQUESTS_PER_HOUR: 10,
  FRIEND_REQUESTS_PER_DAY: 30,
  // Chat
  MESSAGE_MAX_CHARS: 4000,
  DELETE_FOR_EVERYONE_WINDOW_MIN: 15,
  EDIT_WINDOW_MIN: 15,
  NOTE_MAX_CHARS: 2000,
  NOTES_PER_SCOPE_MAX: 100,
  VOICE_NOTE_MAX_SEC: 300,
  IMAGE_MAX_RAW_MB: 15,
  IMAGE_TARGET_KB: 1500,
  MAX_VIDEO_UPLOAD_MB: 50,
  FILE_MAX_MB: 20,
  // Profile
  NAME_MAX: 60,
  USERNAME_REGEX: /^[a-z0-9_]{3,20}$/,
  // Lists
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50],
  SEARCH_MIN_CHARS: 2,
} as const;

export const LANGUAGES = ["ENGLISH", "PIDGIN", "YORUBA", "IGBO", "HAUSA", "OTHER"] as const;
export type Language = (typeof LANGUAGES)[number];
