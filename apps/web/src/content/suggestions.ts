/** Copy for suggested friends (R10). */
export const suggestionsCopy = {
  heading: "People you may know",
  lead: "Picked from your interests, friends in common and public rooms you were in.",
  loading: "Finding people",
  error: "We could not load suggestions. Check your connection, then try again.",
  retry: "Try again",
  empty: "No suggestions right now. Pick more interests or join a room and check back.",
  notInterested: "Not interested",
  notInterestedLabel: (name: string) => `Not interested in ${name}`,
  dismissFailed: "We could not save that. Try again.",
} as const;
