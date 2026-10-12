/**
 * The reactions people can send, in chats and in rooms. Written as escapes so no emoji character sits in source (R1).
 * The same ten everywhere, so a reaction means the same thing in a chat and in a room.
 */
export interface ReactionOption {
  /** A stable word for tests and the server. */
  id: string;
  emoji: string;
  label: string;
}

export const REACTIONS: readonly ReactionOption[] = [
  { id: "clap", emoji: "\u{1F44F}", label: "Clap" },
  { id: "celebrate", emoji: "\u{1F389}", label: "Celebrate" },
  { id: "heart", emoji: "\u{2764}\u{FE0F}", label: "Love" },
  { id: "laugh", emoji: "\u{1F602}", label: "Laugh" },
  { id: "cry", emoji: "\u{1F62D}", label: "Cry" },
  { id: "flowers", emoji: "\u{1F490}", label: "Flowers" },
  { id: "fire", emoji: "\u{1F525}", label: "Fire" },
  { id: "hundred", emoji: "\u{1F4AF}", label: "One hundred" },
  { id: "pray", emoji: "\u{1F64F}", label: "Thank you" },
  { id: "wow", emoji: "\u{1F62E}", label: "Wow" },
];

export const REACTION_EMOJIS: readonly string[] = REACTIONS.map((r) => r.emoji);

export const isReactionEmoji = (emoji: string): boolean => REACTION_EMOJIS.includes(emoji);

/** Room reactions float for everyone, so only these ten are accepted there. A chat message takes any emoji. */
export const ROOM_REACTION_RATE = { burst: 5, perSeconds: 10 } as const;
