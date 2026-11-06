#!/usr/bin/env bash
# TaskContract Android — direct SDK build (no Gradle required).
# Pipeline: aapt2 compile → aapt2 link → kotlinc → d8 → package → zipalign → apksigner
#
# Requirements (env or defaults):
#   JAVA_HOME       — JDK 17+ (javac/java)
#   KOTLIN_HOME     — kotlinc distribution (bin/kotlinc)
#   ANDROID_SDK     — dir with build-tools/34.0.0 and platforms/android-34
#
# Usage: ./build.sh [debug|release]
set -euo pipefail

MODE="${1:-debug}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
APP="$ROOT/app"
SRC="$APP/src/main"
OUT="$ROOT/build"
PKG="com.taskcontract.android"

: "${JAVA_HOME:?Set JAVA_HOME to a JDK 17+}"
: "${KOTLIN_HOME:?Set KOTLIN_HOME to the kotlinc distribution}"
: "${ANDROID_SDK:?Set ANDROID_SDK to the SDK root}"

BT="$ANDROID_SDK/build-tools/34.0.0"
PLATFORM="$ANDROID_SDK/platforms/android-34/android.jar"
export PATH="$JAVA_HOME/bin:$PATH"

mkdir -p "$OUT/obj" "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT/apk"

echo "==> [1/7] aapt2 compile resources"
find "$SRC/res" -type f \( -name '*.xml' -o -name '*.png' -o -name '*.ttf' -o -name '*.webp' -o -name '*.jpg' \) | while read -r f; do
  "$BT/aapt2" compile "$f" -o "$OUT/obj/" 2>>"$OUT/aapt2-compile.log" || { cat "$OUT/aapt2-compile.log"; exit 1; }
done

echo "==> [2/7] aapt2 link"
# AGP 8 forbids package= in the source manifest (namespace lives in Gradle);
# inject it into a build-time copy for the direct aapt2 pipeline.
sed 's|<manifest xmlns:android="http://schemas.android.com/apk/res/android"|<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="'"$PKG"'"|' \
  "$SRC/AndroidManifest.xml" > "$OUT/AndroidManifest.xml"
"$BT/aapt2" link -o "$OUT/apk/base.apk" \
  -I "$PLATFORM" \
  --manifest "$OUT/AndroidManifest.xml" \
  --java "$OUT/gen" \
  --auto-add-overlay \
  --min-sdk-version 26 --target-sdk-version 34 \
  $(find "$OUT/obj" -name '*.flat' | sort)

echo "==> [3/7] kotlinc"
KOTLIN_SOURCES=$(find "$SRC/java" "$OUT/gen" -name '*.kt' -o -name '*.java' | grep -E '\.kt$' ; find "$OUT/gen" -name '*.java')
"$KOTLIN_HOME/bin/kotlinc" \
  -classpath "$PLATFORM" \
  -jvm-target 17 \
  -no-reflect \
  -d "$OUT/classes" \
  $KOTLIN_SOURCES 2>&1 | grep -v "^warning:" || true
# fail hard if compilation produced no output
test -d "$OUT/classes/com" || { echo "Kotlin compilation failed"; exit 1; }

echo "==> [4/7] javac R.java (generated resources)"
find "$OUT/gen" -name '*.java' -exec "$JAVA_HOME/bin/javac" -source 17 -target 17 -classpath "$PLATFORM" -d "$OUT/classes" {} + 2>/dev/null || true

echo "==> [5/7] d8 dex"
CLASSFILES=$(find "$OUT/classes" -name '*.class')
"$BT/d8" --release --lib "$PLATFORM" --min-api 26 --output "$OUT/dex" \
  $CLASSFILES "$KOTLIN_HOME/lib/kotlin-stdlib.jar" 2>"$OUT/d8.log" || { cat "$OUT/d8.log"; exit 1; }

echo "==> [6/7] package + align"
cd "$OUT/dex"
cp "$OUT/apk/base.apk" "$OUT/apk/unsigned.apk"
zip -q -j "$OUT/apk/unsigned.apk" classes.dex
cd "$ROOT"
"$BT/zipalign" -f 4 "$OUT/apk/unsigned.apk" "$OUT/apk/aligned.apk"

echo "==> [7/7] sign ($MODE)"
if [ "$MODE" = "release" ] && [ -f "$ROOT/keystore/release.jks" ]; then
  KS="$ROOT/keystore/release.jks"
  KSPASS="${KEYSTORE_PASSWORD:-taskcontract}"
  KALIAS="${KEY_ALIAS:-taskcontract}"
else
  KS="$ROOT/keystore/debug.jks"
  if [ ! -f "$KS" ]; then
    mkdir -p "$ROOT/keystore"
    "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$KS" -storepass taskcontract -keypass taskcontract \
      -alias taskcontract -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=TaskContract, O=CyberElias TechPros, C=NG" 2>/dev/null
  fi
  KSPASS="taskcontract"; KALIAS="taskcontract"
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KSPASS" --ks-key-alias "$KALIAS" --key-pass "pass:$KSPASS" \
  --out "$OUT/TaskContract-$MODE.apk" "$OUT/apk/aligned.apk"
"$BT/apksigner" verify "$OUT/TaskContract-$MODE.apk" && echo "==> DONE: $OUT/TaskContract-$MODE.apk ($(du -h "$OUT/TaskContract-$MODE.apk" | cut -f1))"
