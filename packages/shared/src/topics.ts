import type { Language } from "./limits";

export type TopicGroup =
  | "society"
  | "faith-and-life"
  | "money-and-work"
  | "entertainment"
  | "sports"
  | "learning"
  | "open";

export interface TopicInfo {
  slug: string;
  name: string;
  description: string;
  group: TopicGroup;
  /** The custom icon in /images/icons, without the extension. */
  icon: string;
}

/** The picker and the filters list groups in this order. */
export const TOPIC_GROUPS: readonly { id: TopicGroup; label: string }[] = [
  { id: "society", label: "Society" },
  { id: "faith-and-life", label: "Faith and life" },
  { id: "money-and-work", label: "Money and work" },
  { id: "entertainment", label: "Entertainment" },
  { id: "sports", label: "Sports" },
  { id: "learning", label: "Learning" },
  { id: "open", label: "Open" },
];

const t = (
  group: TopicGroup,
  slug: string,
  name: string,
  description: string,
  icon: string = slug,
): TopicInfo => ({ slug, name, description, group, icon });

/**
 * The one list of topics. It drives the interests picker, Room categories, Discover filters, the public topic pages
 * and the sitemap. Slugs from older versions stay valid through TOPIC_ALIASES.
 */
export const TOPICS: readonly TopicInfo[] = [
  // Society
  t(
    "society",
    "politics-and-governance",
    "Politics, Government and Policy",
    "Policy, elections and what is happening in your area.",
  ),
  t(
    "society",
    "news-and-current-affairs",
    "News and Current Affairs",
    "What happened today and what it means for you.",
    "news",
  ),
  t(
    "society",
    "law-and-justice",
    "Law and Justice",
    "Your rights, the courts and how the system works.",
    "law",
  ),
  t(
    "society",
    "history-and-heritage",
    "History and Heritage",
    "Where we come from and the stories worth keeping.",
    "history",
  ),
  t(
    "society",
    "culture-and-tradition",
    "Culture and Tradition",
    "Festivals, languages, customs and what makes home home.",
    "culture",
  ),
  t(
    "society",
    "diaspora-and-japa",
    "Diaspora and Japa",
    "Moving abroad, staying connected and coming back.",
  ),
  // Faith and life
  t(
    "faith-and-life",
    "religion-and-spirituality",
    "Religion and Spirituality",
    "Faith, doubt and the questions people carry.",
    "faith-and-life",
  ),
  t(
    "faith-and-life",
    "relationships",
    "Relationships",
    "Dating, friendship and everything in between.",
  ),
  t(
    "faith-and-life",
    "marriage-and-family",
    "Marriage and Family",
    "Home life, in-laws and keeping the peace.",
    "marriage",
  ),
  t(
    "faith-and-life",
    "parenting",
    "Parenting",
    "Raising children, school runs and sharing what works.",
    "parenting",
  ),
  t(
    "faith-and-life",
    "health-and-wellness",
    "Health and Wellness",
    "Body, mind and habits that help.",
  ),
  // Money and work
  t(
    "money-and-work",
    "business-and-money",
    "Business and Money",
    "Side hustles, saving, investing and staying afloat.",
  ),
  t(
    "money-and-work",
    "careers-and-jobs",
    "Careers and Jobs",
    "Interviews, offers, switching paths and getting ahead.",
  ),
  t(
    "money-and-work",
    "tech-and-startups",
    "Tech and Startups",
    "Builders, products and how to get something off the ground here.",
  ),
  t(
    "money-and-work",
    "crypto-and-fintech",
    "Crypto and Fintech",
    "Payments, apps and digital money explained plainly.",
    "crypto",
  ),
  t(
    "money-and-work",
    "real-estate-and-housing",
    "Real Estate and Housing",
    "Renting, buying, building and avoiding the traps.",
    "real-estate",
  ),
  t(
    "money-and-work",
    "agriculture",
    "Agriculture",
    "Farming, food supply and the people who grow it.",
    "agriculture",
  ),
  // Entertainment
  t(
    "entertainment",
    "music-and-gbedu",
    "Music and Gbedu",
    "New releases, old classics and the beats that move the room.",
  ),
  t(
    "entertainment",
    "nollywood-and-entertainment",
    "Nollywood and Movies",
    "Films, actors, box office and the scenes everyone is quoting.",
  ),
  t(
    "entertainment",
    "series-and-tv",
    "Series and TV",
    "What to watch next and what you cannot stop talking about.",
    "series",
  ),
  t(
    "entertainment",
    "books-and-reading",
    "Books and Reading",
    "Novels, poetry, authors and what is on your shelf.",
    "education",
  ),
  t("entertainment", "comedy", "Comedy", "Skits, stand up and the jokes that travel."),
  t("entertainment", "gaming", "Gaming", "Console, mobile and PC, tournaments and tips."),
  t(
    "entertainment",
    "art-and-photography",
    "Art and Photography",
    "Paintings, shots, studios and the eye behind them.",
    "art",
  ),
  t(
    "entertainment",
    "fashion-and-owambe",
    "Fashion and Owambe",
    "Style, aso ebi, weddings and the party after.",
  ),
  t(
    "entertainment",
    "food-and-chop",
    "Food and Chop",
    "Recipes, restaurants and the jollof debate.",
  ),
  t(
    "entertainment",
    "entertainment-and-pop-culture",
    "Entertainment and Pop Culture",
    "Celebrities, trends and whatever is going round.",
    "pop-culture",
  ),
  // Sports
  t("sports", "football", "Football", "Match talk, transfers and the argument nobody wins."),
  t(
    "sports",
    "other-sports",
    "Other Sports",
    "Basketball, athletics, boxing and everything outside the pitch.",
    "other-sports",
  ),
  // Learning
  t(
    "learning",
    "education",
    "Education",
    "Schools, scholarships, exams and learning something new.",
  ),
  t("learning", "campus-life", "Campus Life", "Lectures, hostels, clubs and surviving semester."),
  t(
    "learning",
    "science-and-innovation",
    "Science and Innovation",
    "Discoveries, inventions and how things work.",
    "science",
  ),
  t(
    "learning",
    "travel-and-tourism",
    "Travel and Tourism",
    "Places to go, routes to take and stories from the road.",
    "travel",
  ),
  // Open
  t(
    "open",
    "open-gist",
    "Open Gist",
    "Anything goes. Bring a topic and see who shows up.",
    "open-gist",
  ),
];

/** Old slugs that moved. Links and saved interests keep working. */
export const TOPIC_ALIASES: Record<string, string> = {
  "faith-and-life": "religion-and-spirituality",
};

/** The current slug for a slug that may be an old one. */
export function canonicalTopicSlug(slug: string): string {
  return TOPIC_ALIASES[slug] ?? slug;
}

export function topicBySlug(slug: string): TopicInfo | undefined {
  const current = canonicalTopicSlug(slug);
  return TOPICS.find((topic) => topic.slug === current);
}

/** Topics grouped for the picker, in group order. */
export function topicsByGroup(): { id: TopicGroup; label: string; topics: TopicInfo[] }[] {
  return TOPIC_GROUPS.map((g) => ({
    ...g,
    topics: TOPICS.filter((topic) => topic.group === g.id),
  })).filter((g) => g.topics.length > 0);
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  ENGLISH: "English",
  PIDGIN: "Pidgin",
  YORUBA: "Yoruba",
  IGBO: "Igbo",
  HAUSA: "Hausa",
  OTHER: "Other",
};

/** Interests: pick at least this many and at most MAX_INTERESTS. */
export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 8;
