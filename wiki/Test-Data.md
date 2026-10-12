# Test data

Two kinds of test data exist. Neither is meant to stay once Gistroom is live.

## Prime test world (`npm run seed:friends`)

A world around real accounts, so you can see every screen with real looking content.

- 30 Nigerian people with real sounding names from Lagos, Abuja, Kano, Port Harcourt, Enugu, Ibadan and more. Emails are on gmail.com and yahoo.com (`first.last.gistroom@...`). Every bio ends with "Test account." They have no password, so nobody can sign in as them, and they are never emailed.
- Friends of the prime user (eight with chat history in plain English and Pidgin), friends of the second user, requests waiting, one pending request the prime user sent, one rejected, one blocked person.
- Five calls shown in the middle of the chats and in the call log, twelve scheduled public rooms across topics, one private room and four ended rooms with summaries.
- Real Nigerian topics and keywords: football, japa, amapiano, jollof, fuel price, NYSC, owambe, WAEC and JAMB.

```
npm run seed:friends                          dry run, changes nothing
npm run seed:friends -- --apply               writes it (add --allow-prod on the production schema)
npm run seed:friends -- --remove              removes every seeded person and everything about them
npm run seed:friends -- --email you@gmail.com --second other@gmail.com
```

It looks the accounts up by email, so sign up first. Re-running it adds nothing twice. Everything it makes is marked `User.isSeed`, and removing uses only that mark, never an email or a name.

### Making a seeded person act

Live rooms and live calls cannot be faked. Messages and requests can be sent for real, through the same services, so realtime and push fire:

```
npm run seed:act -- --as okonkwo_adaeze --to felixdrann@gmail.com --do message --text "Oya, you dey come?"
npm run seed:act -- --as etim_blessing --to felixdrann@gmail.com --do request
```

It calls `/api/internal/seed/act` on `APP_URL` (or `SEED_SITE`) with `INTERNAL_SERVICE_TOKEN`. Only seeded people can act, and only on real accounts.

For a live room or a call, use your second account in another browser. That is what exercises LiveKit.

## Dev demo world (`npm run seed:demo`)

Ten and then twenty four labelled demo people on example.com for the dev and test schemas only. It refuses every other schema.

## QA accounts (`npm run seed:qa`)

Six internal accounts for the QA runbook. See `wiki/QA-Runbook.md`.

## Before launch

Run `npm run seed:friends -- --remove --allow-prod` on production. Then check with `npm run sessions:ends` and the admin tools that no seeded person is left.
