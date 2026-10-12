-- Topics: one list for interests, rooms, filters and topic pages (packages/shared/src/topics.ts).

-- faith-and-life became religion-and-spirituality. Rename in place so rooms and interests stay linked.
UPDATE "Topic" SET "slug" = 'religion-and-spirituality', "name" = 'Religion and Spirituality', "description" = 'Faith, doubt and the questions people carry.', "updatedAt" = now()
WHERE "slug" = 'faith-and-life' AND NOT EXISTS (SELECT 1 FROM "Topic" WHERE "slug" = 'religion-and-spirituality');
UPDATE "UserInterest" SET "topicSlug" = 'religion-and-spirituality'
WHERE "topicSlug" = 'faith-and-life' AND NOT EXISTS (
  SELECT 1 FROM "UserInterest" other WHERE other."userId" = "UserInterest"."userId" AND other."topicSlug" = 'religion-and-spirituality'
);
DELETE FROM "UserInterest" WHERE "topicSlug" = 'faith-and-life';

-- Every topic, created or brought up to date.
INSERT INTO "Topic" ("id", "slug", "name", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'politics-and-governance', 'Politics, Government and Policy', 'Policy, elections and what is happening in your area.', now(), now()),
  (gen_random_uuid()::text, 'news-and-current-affairs', 'News and Current Affairs', 'What happened today and what it means for you.', now(), now()),
  (gen_random_uuid()::text, 'law-and-justice', 'Law and Justice', 'Your rights, the courts and how the system works.', now(), now()),
  (gen_random_uuid()::text, 'history-and-heritage', 'History and Heritage', 'Where we come from and the stories worth keeping.', now(), now()),
  (gen_random_uuid()::text, 'culture-and-tradition', 'Culture and Tradition', 'Festivals, languages, customs and what makes home home.', now(), now()),
  (gen_random_uuid()::text, 'diaspora-and-japa', 'Diaspora and Japa', 'Moving abroad, staying connected and coming back.', now(), now()),
  (gen_random_uuid()::text, 'religion-and-spirituality', 'Religion and Spirituality', 'Faith, doubt and the questions people carry.', now(), now()),
  (gen_random_uuid()::text, 'relationships', 'Relationships', 'Dating, friendship and everything in between.', now(), now()),
  (gen_random_uuid()::text, 'marriage-and-family', 'Marriage and Family', 'Home life, in-laws and keeping the peace.', now(), now()),
  (gen_random_uuid()::text, 'parenting', 'Parenting', 'Raising children, school runs and sharing what works.', now(), now()),
  (gen_random_uuid()::text, 'health-and-wellness', 'Health and Wellness', 'Body, mind and habits that help.', now(), now()),
  (gen_random_uuid()::text, 'business-and-money', 'Business and Money', 'Side hustles, saving, investing and staying afloat.', now(), now()),
  (gen_random_uuid()::text, 'careers-and-jobs', 'Careers and Jobs', 'Interviews, offers, switching paths and getting ahead.', now(), now()),
  (gen_random_uuid()::text, 'tech-and-startups', 'Tech and Startups', 'Builders, products and how to get something off the ground here.', now(), now()),
  (gen_random_uuid()::text, 'crypto-and-fintech', 'Crypto and Fintech', 'Payments, apps and digital money explained plainly.', now(), now()),
  (gen_random_uuid()::text, 'real-estate-and-housing', 'Real Estate and Housing', 'Renting, buying, building and avoiding the traps.', now(), now()),
  (gen_random_uuid()::text, 'agriculture', 'Agriculture', 'Farming, food supply and the people who grow it.', now(), now()),
  (gen_random_uuid()::text, 'music-and-gbedu', 'Music and Gbedu', 'New releases, old classics and the beats that move the room.', now(), now()),
  (gen_random_uuid()::text, 'nollywood-and-entertainment', 'Nollywood and Movies', 'Films, actors, box office and the scenes everyone is quoting.', now(), now()),
  (gen_random_uuid()::text, 'series-and-tv', 'Series and TV', 'What to watch next and what you cannot stop talking about.', now(), now()),
  (gen_random_uuid()::text, 'books-and-reading', 'Books and Reading', 'Novels, poetry, authors and what is on your shelf.', now(), now()),
  (gen_random_uuid()::text, 'comedy', 'Comedy', 'Skits, stand up and the jokes that travel.', now(), now()),
  (gen_random_uuid()::text, 'gaming', 'Gaming', 'Console, mobile and PC, tournaments and tips.', now(), now()),
  (gen_random_uuid()::text, 'art-and-photography', 'Art and Photography', 'Paintings, shots, studios and the eye behind them.', now(), now()),
  (gen_random_uuid()::text, 'fashion-and-owambe', 'Fashion and Owambe', 'Style, aso ebi, weddings and the party after.', now(), now()),
  (gen_random_uuid()::text, 'food-and-chop', 'Food and Chop', 'Recipes, restaurants and the jollof debate.', now(), now()),
  (gen_random_uuid()::text, 'entertainment-and-pop-culture', 'Entertainment and Pop Culture', 'Celebrities, trends and whatever is going round.', now(), now()),
  (gen_random_uuid()::text, 'football', 'Football', 'Match talk, transfers and the argument nobody wins.', now(), now()),
  (gen_random_uuid()::text, 'other-sports', 'Other Sports', 'Basketball, athletics, boxing and everything outside the pitch.', now(), now()),
  (gen_random_uuid()::text, 'education', 'Education', 'Schools, scholarships, exams and learning something new.', now(), now()),
  (gen_random_uuid()::text, 'campus-life', 'Campus Life', 'Lectures, hostels, clubs and surviving semester.', now(), now()),
  (gen_random_uuid()::text, 'science-and-innovation', 'Science and Innovation', 'Discoveries, inventions and how things work.', now(), now()),
  (gen_random_uuid()::text, 'travel-and-tourism', 'Travel and Tourism', 'Places to go, routes to take and stories from the road.', now(), now()),
  (gen_random_uuid()::text, 'open-gist', 'Open Gist', 'Anything goes. Bring a topic and see who shows up.', now(), now())
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description", "updatedAt" = now();
