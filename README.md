# Hold

Keep your thumb on the circle. Lift it and you lose.

## How the project is laid out

| Path | What it is |
| --- | --- |
| `www/index.html` | The whole game: one HTML file. Also published as the web test build. |
| `assets/` | App icon, adaptive icon layers, splash, and the 512px Play Store icon. |
| `scripts/build-web.mjs` | Makes `dist/` for the app: full HTML page, fonts bundled so it works offline. |
| `scripts/patch-android.mjs` | Applies Hold's Android settings: target SDK 36+, portrait, screen stays on, signing, version numbers. |
| `.github/workflows/android.yml` | GitHub builds the app on every push and attaches the files to the run. |

## Getting a build

1. Push to `main` (or press **Run workflow** under the Actions tab).
2. When the run turns green, open it and download **hold-build-N** at the bottom.
3. Inside:
   - `hold-N-phone-test.apk`: install straight onto an Android phone to test.
   - `hold-N.aab`: upload this to Play Console.

The version code goes up by one on every run, so each upload is accepted.

## Signing

Release builds are signed with the upload key from these repository secrets:
`HOLD_KEYSTORE_B64`, `HOLD_KEYSTORE_PASSWORD`, `HOLD_KEY_ALIAS`, `HOLD_KEY_PASSWORD`.
Without them the `.aab` is unsigned and Play Console will refuse it.

## App ID

`com.twelfthhouseprotocol.hold`, published by 12th House Protocol. It becomes permanent at the first Play upload, so never change it after that.
