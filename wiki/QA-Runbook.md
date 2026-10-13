# QA runbook

Step by step checks for a real person with three browsers or profiles. Each step has an expected result and a box for pass or fail. Run it before a release and after anything that touches rooms, calls or notifications.

## Setup

1. Set `QA_PASSWORD` (at least 10 characters) in your shell or `.env`. Never commit it.
2. Create the QA accounts:
   - Dev or test schema: `npm run seed:qa`
   - Production: `npm run seed:qa -- --allow-prod-qa` (owner only, the script refuses production without the flag)
3. The six accounts all use `QA_PASSWORD`. They are marked internal, so normal people never see them in search, suggestions, Discover or public pages.

| Account       | Email                      | Role in the tests           |
| ------------- | -------------------------- | --------------------------- |
| QA Host       | `qa.host@example.com`      | creates rooms, moderates    |
| QA Moderator  | `qa.moderator@example.com` | promoted to moderator       |
| QA Member One | `qa.member1@example.com`   | plain member                |
| QA Member Two | `qa.member2@example.com`   | plain member, second device |
| QA Outsider   | `qa.outsider@example.com`  | knows nobody, not invited   |
| QA New User   | `qa.newuser@example.com`   | no friends, no interests    |

The host, moderator and both members are already friends and have a chat. The outsider and the new user know nobody.

Use three browser profiles: **A** (Host), **B** (Member One), **C** (Moderator or Outsider, as the step says). Allow the microphone and camera when asked. On a phone, install the app first for push.

Mark each step: [ ] pass, [ ] fail.

## 1. Sign up and username availability

| Step                                                          | Expected                                                       | Result |
| ------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| Open `/signup` in a private window, enter a new email you own | A 6 digit code arrives by email                                | [ ]    |
| Enter the code, set a password with a weak value              | The strength bar says Weak and Continue stays blocked          | [ ]    |
| Set a strong password and a matching confirmation             | Eye buttons show and hide both fields, you move on             | [ ]    |
| Type `qa_host` as the username                                | A spinner, then a red cross and "That username is taken"       | [ ]    |
| Type a free name                                              | A green check and "@name is available"                         | [ ]    |
| Pick 3 to 8 topics                                            | The counter reads "N of 3 picked" until 3, then Continue works | [ ]    |

## 2. Friends and chats (A and B, plus the outsider in C)

| Step                                                             | Expected                                                                                          | Result |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| C (Outsider) searches for "QA Host"                              | Not found. Internal accounts are hidden from search                                               | [ ]    |
| A opens Friends, searches a normal test user and sends a request | "Request sent"                                                                                    | [ ]    |
| That user accepts                                                | A gets a notification, both can chat                                                              | [ ]    |
| A and B open their chat and send text                            | Appears on both sides in real time with timestamps                                                | [ ]    |
| A sends an image and a file                                      | Both render. The image has a lightbox                                                             | [ ]    |
| A records a voice note (hold the mic button)                     | Waveform shows, B can play it at 1x, 1.5x, 2x                                                     | [ ]    |
| B reacts with a quick reaction, then "More reactions"            | Chips appear under the bubble on both sides. A number shows only when two people chose it         | [ ]    |
| A edits a message within 15 minutes                              | "Edited" with a time appears on both sides                                                        | [ ]    |
| A deletes a message for everyone within 15 minutes               | Both see "This message was deleted"                                                               | [ ]    |
| After 15 minutes the Edit and Delete for everyone items          | They are no longer offered                                                                        | [ ]    |
| A archives the chat                                              | A confirm modal first. The chat moves behind the Archived bar. An Activity line appears with Undo | [ ]    |
| Press Undo in Notifications, then Activity                       | The chat comes back                                                                               | [ ]    |

## 3. 1:1 call (A and B)

| Step                                   | Expected                                               | Result |
| -------------------------------------- | ------------------------------------------------------ | ------ |
| A starts an audio call from the chat   | B rings in the app and gets a push                     | [ ]    |
| B answers                              | Both hear each other, timer runs                       | [ ]    |
| B taps the camera                      | The video tile appears on A without a reconnect        | [ ]    |
| B taps the camera again                | Back to audio only                                     | [ ]    |
| A ends the call                        | Both see it in Calls with a duration                   | [ ]    |
| A calls, B declines                    | A sees the outcome, B sees a Declined entry            | [ ]    |
| A calls, nobody answers for 45 seconds | Missed call for B, a notification and, if on, an email | [ ]    |

## 4. Rooms: create, join, people (A host, B member, C moderator)

| Step                                                                               | Expected                                                                              | Result |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| A starts a public room, searching "foot" in Topic and picking Football, type Video | The room opens. Cards show the Video tag                                              | [ ]    |
| B opens Discover                                                                   | B sees the room, because internal accounts see each other. A normal account would not | [ ]    |
| B joins                                                                            | Tiles show avatars, not initials. The header reads "2 people"                         | [ ]    |
| A opens People                                                                     | Avatar, name, Host badge, mic and camera state for each person                        | [ ]    |
| A promotes C to moderator                                                          | C sees "You are now a moderator in this room."                                        | [ ]    |
| A makes a private room                                                             | Only invited people can enter. C (Outsider) sees "You are not invited" with no title  | [ ]    |

## 5. Moderation (A host, C moderator, B member)

| Step                                                                    | Expected                                                                              | Result |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| C chooses "Mute audio" on B                                             | B sees "A moderator muted your microphone." and the mic goes off                      | [ ]    |
| C chooses "Turn off video" on B while B has the camera on               | B sees "A moderator turned off your camera."                                          | [ ]    |
| C chooses "Mute everyone" and ticks "Only moderators can unmute people" | Every member is muted. B cannot unmute and sees why                                   | [ ]    |
| A turns the lock off in Room settings                                   | B can unmute again                                                                    | [ ]    |
| C removes B                                                             | B sees "You were removed from this room." A public room can be rejoined               | [ ]    |
| A bans B                                                                | B sees "You cannot join this room." and cannot come back                              | [ ]    |
| A opens the Moderator log                                               | Every action above is listed with the person who did it                               | [ ]    |
| Lock the room (first time)                                              | A modal explains what locking does. Someone new sees "This room is locked right now." | [ ]    |

## 6. Room settings, chat and reactions

| Step                                                                        | Expected                                          | Result |
| --------------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| A changes the title and description in Room settings                        | Everyone inside sees the new title right away     | [ ]    |
| A sets Chat to Moderators only                                              | Members see "Only moderators can chat right now." | [ ]    |
| A sets slow mode to 15 seconds                                              | A member who sends twice quickly is told to wait  | [ ]    |
| A turns Cameras allowed off                                                 | Members cannot turn their camera on               | [ ]    |
| A turns on Join muted and C joins                                           | C arrives muted                                   | [ ]    |
| B sends a reaction from the bar                                             | The emoji floats up over B's tile on every screen | [ ]    |
| A turns Reactions off                                                       | The reaction button disappears                    | [ ]    |
| A member deletes their own chat message, a moderator deletes someone else's | Both disappear live for everyone                  | [ ]    |
| Chat messages show avatar, name and a Moderator or Host badge               | Yes                                               | [ ]    |

## 7. Notes

| Step                            | Expected                                                                   | Result |
| ------------------------------- | -------------------------------------------------------------------------- | ------ |
| Open Notes in the room          | "Notes are private to you" under the heading, an empty state with Add note | [ ]    |
| Press Add note                  | The empty state goes, an input is focused and "0 of 2000" appears          | [ ]    |
| Save a note, edit it, delete it | Each works. Nobody else can see it                                         | [ ]    |

## 8. Invites and links (A host)

| Step                                                        | Expected                                                         | Result |
| ----------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| Invite tab, Invite friends, tick B and C, press Send invite | Each gets a Room card in their chat and a result line per person | [ ]    |
| Invite link tab, pick 1 hour, press Create link             | The full link shows, wrapped, with Copy and Create another link  | [ ]    |
| Press Copy                                                  | The button reads "Copied" with a check for a few seconds         | [ ]    |
| Open the link in a signed out window                        | You are asked to sign in, then land in the room                  | [ ]    |
| Active links list                                           | Full link, uses, expiry in 12 hour time and "Expires in ..."     | [ ]    |
| Revoke the link and confirm                                 | The old link now shows "This invite link is no longer valid."    | [ ]    |
| As a member of a public room, open Invite                   | The plain room link only. Members cannot make expiring links     | [ ]    |

## 9. Ending a room, the ended screen and Past rooms

| Step                                 | Expected                                                                                        | Result |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ------ |
| A leaves as host                     | A modal offers hand over to a moderator, leave, or end for everyone                             | [ ]    |
| A ends the room                      | Everyone is disconnected                                                                        | [ ]    |
| Open the room link as an attendee    | "This room has ended." and the summary: duration, peak, people, messages, reactions, your notes | [ ]    |
| Open it as the host                  | The summary also shows moderator actions                                                        | [ ]    |
| Open it as someone who was not there | Only the ended message and a Browse live rooms button                                           | [ ]    |
| Rooms, Past rooms                    | The room is listed with the same summary                                                        | [ ]    |
| Room chat                            | The chat messages are gone                                                                      | [ ]    |

## 10. Push on a closed tab and the rest

| Step                                                     | Expected                                                                                                             | Result |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| On a phone or laptop, turn on alerts, then close the tab | Alerts stay on                                                                                                       | [ ]    |
| From another account, call or message                    | A system notification arrives within seconds                                                                         | [ ]    |
| Press Answer on the call notification                    | The app opens on the call                                                                                            | [ ]    |
| Cookie banner: accept, reload, open a new tab, navigate  | It never returns                                                                                                     | [ ]    |
| Deploy a new version, keep the app open                  | A small bar reads "A new version is ready. Refresh when you can." and nothing is interrupted during a call or a room | [ ]    |
| Notifications: open an item                              | A modal with the actions. It is marked read                                                                          | [ ]    |
| Notifications: Select, pick several, Delete              | A modal says how many will go                                                                                        | [ ]    |

## Automated live checks

`tests/browser/live.spec.ts` covers the moderator mute and remove flow and the camera switch between two browser contexts. It needs a real LiveKit project, so it is skipped unless `E2E_LIVE=1`:

```
$env:E2E_LIVE = "1"; npx playwright test --grep @live
```

## 11. Alerts after the session ends (real devices)

Use Settings, Notifications, then press Send a test notification on each device. It pushes to that device only and says what happened.

| Step                                                                                                 | Expected                                                                                                                                | Result |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Android Chrome: turn alerts on, close the tab, swipe the app away, then message from another account | An alert arrives with the sender and text                                                                                               | [ ]    |
| Android with battery saver on, same steps                                                            | Alert arrives. If it is late or missing, follow the Not getting alerts help                                                             | [ ]    |
| Windows Chrome with all windows closed and Continue running background apps ON                       | Alert arrives                                                                                                                           | [ ]    |
| Windows Chrome with all windows closed and that setting OFF                                          | No alert until Chrome is opened. This is expected                                                                                       | [ ]    |
| macOS Chrome fully quit                                                                              | No alert. This is expected and documented                                                                                               | [ ]    |
| Firefox desktop with Firefox running, tab closed                                                     | Alert arrives. With Firefox closed, none                                                                                                | [ ]    |
| iPhone with the app added to the Home Screen, signed in inside it, app closed                        | Alert arrives. In Safari only, alerts are not offered                                                                                   | [ ]    |
| Expire a session on purpose (set its expiry in the past, or wait 31 days)                            | Alerts keep coming as plain text: "You have a new message", no names. Opening the app asks you to sign in                               | [ ]    |
| Tap that plain alert                                                                                 | You land on the sign in page, and after signing in you are at the same chat or room                                                     | [ ]    |
| Call that device while its session is ended                                                          | "Incoming call. Open Gistroom to sign in and answer." If you sign in within the ring time you can answer, otherwise it is a missed call | [ ]    |
| After 30 days signed out                                                                             | Alerts stop. Settings shows "Needs a sign in". Signing in on that device brings full alerts back                                        | [ ]    |
| Sign out on purpose on a shared computer, then message the account                                   | No alert on that computer                                                                                                               | [ ]    |
| Sign out everywhere else from device A                                                               | Device B stops getting alerts. Device A keeps its session and its alerts                                                                | [ ]    |
| Two people use one browser: A turns alerts on, signs out, B signs in                                 | A's messages never show on that browser. B's do                                                                                         | [ ]    |
| Block notifications in the browser after turning them on, then open Gistroom                         | A modal explains how to turn them back on, and Settings shows Blocked                                                                   | [ ]    |
| Press Send a test notification with alerts on                                                        | "Sent" and the alert appears                                                                                                            | [ ]    |

## 12. Connections, calls and rooms on real devices

Do these on a real phone and a laptop. None of them can be proved by the automated tests.

1. Airplane mode on, wait 5 seconds, then off, during a 1:1 call and during a room. Expect "You're offline" with a counter, then a "You're back" chip. After a minute offline expect "You were disconnected" with Rejoin.
2. Switch from Wi-Fi to mobile data in a call. Expect the "Switching networks" banner and no dialog if it reconnects in 3 seconds.
3. Walk out of signal. Expect the weak banner with "Switch to audio only" after 10 seconds, and the other person's video getting smaller.
4. Bluetooth headset on and off in a call. Expect "Switched to {device}", and if the active microphone vanishes, the microphone dialog.
5. Open another app that takes the camera, then turn your camera on. Expect "Camera is not available. You are still in audio."
6. Put the browser in the background on iPhone and Android for a minute, then come back. Expect "Your mic paused" with Unmute.
7. Open a room link inside Facebook or Instagram. Expect "Open in your browser to join" before any join.
8. Sign in on two devices and join the same room on both. The older one must say "You joined from another device".
9. A host drops (airplane mode) and returns inside 2 minutes. Everyone sees "Host is reconnecting" and the room stays theirs. Past 2 minutes the room passes on.
10. A moderator ends a room. The moderator reads "You ended the room", everyone else reads who ended it with the length.
11. Ring an invited person from the People panel. Expect Ringing, then Joined with a time, and the rate limits (30 seconds per person, 3 per room per 10 minutes).
12. Play every sound in Settings, Notifications, Sounds on each device, and check quiet hours silence them.
13. Reload during a call and during a room. Expect "Rejoin your call" or an automatic rejoin of the room.
14. Close the tab during a call. The other person should see "Waiting for {name} to reconnect" and, after a minute, the call ending.
