# App Store submission — psst

Everything needed to submit the iOS app for App Store review, in one place.
Fill-in items for Ale are marked **[ALE]**.

## App identity

| Field | Value |
| --- | --- |
| App name | psst |
| Subtitle (30 chars max) | A canvas for your people |
| Bundle ID | `you.psst.app` |
| SKU | `psst-ios-1` (any unique string works) |
| Team | 49MWCX22SN |
| Primary category | Social Networking |
| Secondary category | Lifestyle (optional) |
| Price | Free |
| Age rating | 4+ (no objectionable content; questionnaire: answer "No" to everything, "Yes" to none. Unrestricted web access is **not** needed — the webview only loads psst.you) |

## Version metadata

**Promotional text** (170 chars, editable without review):

> A private daily canvas for you and yours. Drop links, notes, photos and stickers on today's board — tomorrow it becomes a page in your scrapbook.

**Description:**

> psst is a private shared canvas for tiny groups — you and a partner, your family, your best friends.
>
> Every day you get a fresh board. Drop links, notes, photos, doodles, voice notes and emoji stickers on it. Drag things around. Flip a card to write on its back. React with a little burst of warmth.
>
> At the end of the day, the canvas archives itself into a timeline — a scrapbook of your days together.
>
> psst is explicitly not a chat. No read receipts, no typing indicators, no pressure to reply. Just a quiet corner of the internet for the people you whisper to.
>
> • A new canvas every day, archived into a shared scrapbook
> • Links unfurl into postcards, notes become paper slips, photos become prints
> • Draw with a pencil, leave voice notes, sticker everything
> • Home-screen widget: today's canvas at a glance
> • Push notifications with the psst whisper when someone drops something
> • No ads, no tracking, no algorithms

**Keywords** (100 chars):
`shared canvas,couple,scrapbook,private,friends,family,notes,photo,widget,daily,journal,collage`

**URLs:**

| Field | Value |
| --- | --- |
| Support URL | https://www.psst.you |
| Marketing URL | https://www.psst.you |
| Privacy Policy URL | https://www.psst.you/privacy |

## Privacy (App Privacy section in App Store Connect)

Data collection: **minimal, never for tracking.** Answer "Yes, we collect data" and declare:

| Data type | Collected? | Linked to identity | Used for tracking | Purpose |
| --- | --- | --- | --- | --- |
| Contact info → Email address | Yes | Yes | No | App functionality (account) |
| Contact info → Name | Yes | Yes | No | App functionality (shown to your group) |
| User content → Photos or videos | Yes | Yes | No | App functionality (canvas items) |
| User content → Audio data | Yes | Yes | No | App functionality (voice notes) |
| User content → Other user content | Yes | Yes | No | App functionality (notes, links, drawings) |
| Identifiers → Device ID | No — the APNs push token is not an "identifier" in Apple's taxonomy; do not declare it | | | |

Everything else (location, browsing history, purchases, diagnostics, analytics): **not collected**.
"Data Used to Track You": **none** — psst has no analytics, no ads, no third-party SDKs.

## Sign-in for the review team

- Sign in with Apple is offered, so reviewers can use their own Apple ID — but
  also provide a demo account (required whenever an app has accounts):
  - **[ALE]** create a fresh account on https://www.psst.you (e.g.
    `appstore-review@psst.you` + a strong password), make one space with a few
    items on it, and paste the credentials into App Review Information → Sign-In
    Information.
- Review notes (paste into "Notes"):

  > psst is a private shared canvas for small groups. Sign in with the demo account (or Sign in with Apple) — you land on the group's daily canvas. Type in the bottom bar to drop a note or link, use the + for photos, drawing, voice notes and stickers. Double-tap a card to react; tap the speech bubble to write on its back. The home-screen widget ("Today's canvas") shows the board; notifications play a short custom "psst" sound when another member adds something. There is no user discovery — people join a space only via a private invite link.

## Technical checklist (already done in the repo)

- [x] `ITSAppUsesNonExemptEncryption = NO` baked into the build settings — no
  export-compliance question at upload (standard HTTPS only).
- [x] Sign in with Apple entitlement + native flow (required because email
  sign-in exists).
- [x] Push entitlement (`aps-environment`), custom sound `psst.wav` (< 30 s).
- [x] App icon (1024 pt, no alpha), asset catalog.
- [x] Associated domains (`webcredentials:psst.you`, `webcredentials:www.psst.you`)
  \+ AASA file served at https://www.psst.you/.well-known/apple-app-site-association.
- [x] Privacy policy + terms pages live, linked from the app's login screen.
- [x] Microphone usage description (voice notes in the canvas).
- [x] Widget extension (small / medium / large) with its own entitlements.

## Remaining steps (in order)

1. **[ALE]** In App Store Connect: create the app record (name **psst**, bundle
   `you.psst.app`, SKU above).
2. **[ALE]** In Xcode: Product → Archive on **Any iOS Device (arm64)** with the
   Release scheme, then Distribute → App Store Connect. (Signing is automatic;
   the APNs key/cert for production push must exist in the developer account —
   the `.p8` key you use for `APNS_*` env covers it.)
3. **[ALE]** Switch `aps-environment` to `production` for the store build
   (Xcode does this automatically when archiving with a distribution profile).
4. Upload 6.7" and 6.9" iPhone screenshots (and 13" iPad if keeping iPad
   support): canvas with items, a flipped card, the timeline, the widget on a
   home screen, login. Simulator screenshots at exact device sizes are fine.
5. Fill in the metadata above, attach the demo account, submit for review.

## Known review risks & answers

- **Webview-heavy app (guideline 4.2 minimum functionality):** the app is not a
  website wrapper only — call out native login, Sign in with Apple, push with
  custom sound, home-screen widgets, and keychain/session integration in the
  review notes if asked.
- **Account deletion (guideline 5.1.1(v)):** apps with accounts must offer
  account deletion. Today deletion is via email (hello@psst.you, stated in the
  privacy policy). Apple increasingly requires **in-app** deletion — if the
  reviewer pushes back, add a "Delete account" action to the profile sheet on
  the web app and resubmit.
- **User-generated content (guideline 1.2):** psst has private, invite-only
  spaces (no public content, no discovery). If asked about moderation: content
  is only ever visible to a space's handful of members, members can delete
  items, and accounts violating the terms can be suspended (terms page).
