// Applies Hold's native settings to the Android project that `npx cap add android` generates.
// Safe to run more than once. Fails loudly if the template changed shape, so a build never ships half-patched.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = resolve(root, process.env.ANDROID_DIR || 'android');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const MIN_TARGET_SDK = 36; // Google Play: new apps must target Android 16 (API 36) from 31 Aug 2026

const edit = (file, fn) => {
  const p = join(android, file);
  const before = readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) writeFileSync(p, after);
  console.log(`${after !== before ? 'patched' : 'unchanged'}: ${file}`);
};
const must = (cond, msg) => { if (!cond) throw new Error('patch-android: ' + msg); };

// 1. SDK levels: never lower than Play's current requirement
edit('variables.gradle', s => {
  for (const key of ['compileSdkVersion', 'targetSdkVersion']) {
    const re = new RegExp(`(${key}\\s*=\\s*)(\\d+)`);
    const m = s.match(re);
    must(m, `${key} not found in variables.gradle`);
    if (Number(m[2]) < MIN_TARGET_SDK) s = s.replace(re, `$1${MIN_TARGET_SDK}`);
  }
  return s;
});

// 2. Version numbers, release signing from environment variables
const versionCode = Number(process.env.VERSION_CODE || process.env.GITHUB_RUN_NUMBER || 1);
edit('app/build.gradle', s => {
  must(/versionCode\s+\d+/.test(s), 'versionCode not found');
  s = s.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  s = s.replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
  if (!s.includes('HOLD_KEYSTORE')) {
    must(/android\s*\{/.test(s), 'android block not found');
    s = s.replace(/android\s*\{/, `android {
    signingConfigs {
        release {
            if (System.getenv("HOLD_KEYSTORE")) {
                storeFile file(System.getenv("HOLD_KEYSTORE"))
                storePassword System.getenv("HOLD_KEYSTORE_PASSWORD")
                keyAlias System.getenv("HOLD_KEY_ALIAS")
                keyPassword System.getenv("HOLD_KEY_PASSWORD")
            }
        }
    }`);
    must(/buildTypes\s*\{\s*release\s*\{/.test(s), 'release build type not found');
    s = s.replace(/(buildTypes\s*\{\s*release\s*\{)/, `$1
            if (System.getenv("HOLD_KEYSTORE")) { signingConfig signingConfigs.release }`);
  }
  return s;
});

// 3. Portrait only
edit('app/src/main/AndroidManifest.xml', s => {
  if (s.includes('android:screenOrientation')) return s;
  must(/<activity\b/.test(s), 'activity not found in manifest');
  return s.replace(/<activity\b/, '<activity\n            android:screenOrientation="portrait"');
});

// 4. Keep the screen on while the app is open (a run can last an hour)
const findMain = dir => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { const r = findMain(p); if (r) return r; }
    else if (/^MainActivity\.(java|kt)$/.test(f)) return p;
  }
  return null;
};
const mainPath = findMain(join(android, 'app/src/main/java'));
must(mainPath, 'MainActivity not found');
const main = readFileSync(mainPath, 'utf8');
if (!main.includes('FLAG_KEEP_SCREEN_ON')) {
  let out;
  if (mainPath.endsWith('.java')) {
    must(/public class MainActivity extends BridgeActivity\s*\{\s*\}/.test(main), 'unexpected MainActivity.java shape');
    out = main
      .replace(/(package [^;]+;)/, '$1\n\nimport android.os.Bundle;\nimport android.view.WindowManager;')
      .replace(/public class MainActivity extends BridgeActivity\s*\{\s*\}/, `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}`);
  } else {
    must(/class MainActivity\s*:\s*BridgeActivity\(\)/.test(main), 'unexpected MainActivity.kt shape');
    out = main
      .replace(/(package [^\n]+)/, '$1\n\nimport android.os.Bundle\nimport android.view.WindowManager')
      .replace(/class MainActivity\s*:\s*BridgeActivity\(\)\s*(\{\s*\})?/, `class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}`);
  }
  writeFileSync(mainPath, out);
  console.log('patched: ' + mainPath.replace(android + '/', ''));
} else console.log('unchanged: MainActivity');

console.log(`Android project ready: versionCode ${versionCode}, versionName ${pkg.version}, target SDK >= ${MIN_TARGET_SDK}`);
