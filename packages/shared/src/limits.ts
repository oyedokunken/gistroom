export const LIMITS = {
  // Rooms
  ROOM_MAX_PARTICIPANTS: 32,
  ROOM_MAX_VIDEO_PUBLISHERS: 32,
  ROOM_TITLE_MAX: 80,
  ROOM_REJOIN_GRACE_SEC: 120,
  ROOM_EMPTY_END_GRACE_SEC: 60,
  ROOM_CHAT_RETENTION_HOURS: 24,
  INVITE_LINK_DEFAULT_TTL_HOURS: 24,
  INVITE_LINK_TTL_OPTIONS_HOURS: [1, 24, 168],
  // Calls
  CALL_RING_TIMEOUT_SEC: 45,
  // Auth
  OTP_LENGTH: 6,
  OTP_TTL_MIN: 10,
  OTP_RESEND_COOLDOWN_SEC: 60,
  OTP_MAX_ATTEMPTS: 5,
  OTP_SENDS_PER_HOUR: 5,
  SESSION_DAYS: 30,
  REALTIME_PASS_MIN: 15,
  // Social
  FRIEND_REQUEST_COOLDOWN_DAYS: 7,
  FRIEND_REQUESTS_PER_HOUR: 10,
  FRIEND_REQUESTS_PER_DAY: 30,
  // Chat
  MESSAGE_MAX_CHARS: 4000,
  DELETE_FOR_EVERYONE_WINDOW_MIN: 60,
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

export const SEED_TOPICS = [
  "Football",
  "Music and Gbedu",
  "Politics and Governance",
  "Tech and Startups",
  "Business and Money",
  "Relationships",
  "Faith and Life",
  "Campus Life",
  "Nollywood and Entertainment",
  "Food and Chop",
  "Health and Wellness",
  "Careers and Jobs",
  "Education",
  "Comedy",
  "Diaspora and Japa",
  "Fashion and Owambe",
  "Gaming",
  "Open Gist",
] as const;
