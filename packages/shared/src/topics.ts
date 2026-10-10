import type { Language } from "./limits";

export interface TopicInfo {
  slug: string;
  name: string;
  description: string;
}

/** Seed topics (Section 26). Descriptions drive the topic pages and the discover filter. */
export const TOPICS: readonly TopicInfo[] = [
  {
    slug: "football",
    name: "Football",
    description: "Match talk, transfers and the argument nobody wins.",
  },
  {
    slug: "music-and-gbedu",
    name: "Music and Gbedu",
    description: "New releases, old classics and the beats that move the room.",
  },
  {
    slug: "politics-and-governance",
    name: "Politics and Governance",
    description: "Policy, elections and what is happening in your area.",
  },
  {
    slug: "tech-and-startups",
    name: "Tech and Startups",
    description: "Builders, products and how to get something off the ground here.",
  },
  {
    slug: "business-and-money",
    name: "Business and Money",
    description: "Side hustles, savings, prices and doing business in Naija.",
  },
  {
    slug: "relationships",
    name: "Relationships",
    description: "Love, family and friendships, with honesty and respect.",
  },
  {
    slug: "faith-and-life",
    name: "Faith and Life",
    description: "Faith, purpose and questions that matter, for every belief.",
  },
  {
    slug: "campus-life",
    name: "Campus Life",
    description: "Lectures, hostel gist, results and life after school.",
  },
  {
    slug: "nollywood-and-entertainment",
    name: "Nollywood and Entertainment",
    description: "Films, series, celebrities and what to watch next.",
  },
  {
    slug: "food-and-chop",
    name: "Food and Chop",
    description: "Recipes, street food and the best jollof argument.",
  },
  {
    slug: "health-and-wellness",
    name: "Health and Wellness",
    description: "Fitness, mental health and looking after yourself.",
  },
  {
    slug: "careers-and-jobs",
    name: "Careers and Jobs",
    description: "Interviews, skills, remote work and moving up.",
  },
  {
    slug: "education",
    name: "Education",
    description: "Learning, exams, scholarships and teaching each other.",
  },
  {
    slug: "comedy",
    name: "Comedy",
    description: "Jokes, skits and rooms where laughing is the point.",
  },
  {
    slug: "diaspora-and-japa",
    name: "Diaspora and Japa",
    description: "Moving abroad, staying connected and coming back.",
  },
  {
    slug: "fashion-and-owambe",
    name: "Fashion and Owambe",
    description: "Style, aso ebi, weddings and the party after.",
  },
  { slug: "gaming", name: "Gaming", description: "Console, mobile and PC, tournaments and tips." },
  {
    slug: "open-gist",
    name: "Open Gist",
    description: "Anything goes. Bring a topic and see who shows up.",
  },
];

export function topicBySlug(slug: string): TopicInfo | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  ENGLISH: "English",
  PIDGIN: "Pidgin",
  YORUBA: "Yoruba",
  IGBO: "Igbo",
  HAUSA: "Hausa",
  OTHER: "Other",
};
