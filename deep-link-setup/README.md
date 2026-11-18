# Making shared comment links clickable (hitlit.pk)

This makes links shared from the Share button (comments + community posts)
show up as real tappable links in WhatsApp/SMS/etc. instead of plain text,
and open the app directly.

Two things are already done in the app's code:
- `app.json` now declares `hitlit.pk` as the app's associated domain
  (iOS `associatedDomains`, Android `intentFilters`).
- Shared links now look like `https://hitlit.pk/comment/<id>` instead of
  the old `playoye://comment/<id>`.

What's left needs your domain's hosting, which I can't set up myself —
here's exactly what to do:

## 1. Fill in the two files in this folder

**`.well-known/apple-app-site-association`** — replace
`REPLACE_WITH_APPLE_TEAM_ID` with your Apple Team ID (10 characters, found
at developer.apple.com → Account → Membership, or in App Store Connect
under your app → App Information).

**`.well-known/assetlinks.json`** — replace
`REPLACE_WITH_ANDROID_SHA256_FINGERPRINT` with your Android release
signing certificate's SHA-256 fingerprint. Get it by running
`eas credentials` → Android → select the `preview`/`production` profile →
view the keystore — it'll show a line like
`SHA256 Fingerprint: AA:BB:CC:...`. Use it with the colons, uppercase,
exactly as shown.

## 2. Host both files on hitlit.pk

They must be reachable at exactly:
- `https://hitlit.pk/.well-known/apple-app-site-association`
- `https://hitlit.pk/.well-known/assetlinks.json`

Served as plain JSON (no login/redirect in front of them), over HTTPS.

Important: the DNS panel from your registrar (client.domain.pk) only lets
you point `hitlit.pk` at **nameservers** — it doesn't host files itself.
You need an actual web host behind those nameservers. The simplest free
options:
- **Cloudflare Pages** (free): create a Cloudflare account, add `hitlit.pk`,
  point your domain's nameservers (in the .pk panel) to the two Cloudflare
  nameservers it gives you, then deploy this `.well-known` folder as a
  static site.
- Or any existing hosting you already have for hitlit.pk — just drop these
  two files in at the paths above.

## 3. Tell me once it's live

I'll verify both files are reachable, then this needs a **new app build**
to actually pick up the `app.json` changes (associatedDomains/
intentFilters are native config — a JS-only update can't add them). I
won't build automatically; just let me know when you're ready.
