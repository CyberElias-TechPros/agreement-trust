#!/usr/bin/env bash
# JVM test runner — no Gradle/JUnit needed.
#   bash android/tools/test.sh domain   → pure domain tests (Json/Crypto/Rules/Time)
#   bash android/tools/test.sh api      → RemoteApi E2E vs a running worker (BASE_URL, default http://127.0.0.1:8787/api/v1)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
SRC="$ROOT/app/src/main/java/com/taskcontract/android"
TEST="$ROOT/app/src/test/java"
OUT="$ROOT/build/tests"
: "${JAVA_HOME:?}"; : "${KOTLIN_HOME:?}"
export PATH="$JAVA_HOME/bin:$PATH"
mkdir -p "$OUT"

WHICH="${1:-domain}"

COMMON="$SRC/core/Json.kt $SRC/core/Crypto.kt $SRC/domain/Models.kt $SRC/domain/Rules.kt"

if [ "$WHICH" = "domain" ]; then
  "$KOTLIN_HOME/bin/kotlinc" $COMMON "$TEST/DomainTests.kt" -jvm-target 17 -no-reflect -d "$OUT/domain.jar" 2>&1 | grep -v "^warning:" || true
  "$JAVA_HOME/bin/java" -cp "$OUT/domain.jar:$KOTLIN_HOME/lib/kotlin-stdlib.jar" com.taskcontract.android.tests.DomainTestsKt
elif [ "$WHICH" = "api" ]; then
  "$KOTLIN_HOME/bin/kotlinc" $COMMON "$SRC/remote/RemoteApi.kt" "$TEST/ApiTests.kt" -jvm-target 17 -no-reflect -d "$OUT/api.jar" 2>&1 | grep -v "^warning:" || true
  "$JAVA_HOME/bin/java" -cp "$OUT/api.jar:$KOTLIN_HOME/lib/kotlin-stdlib.jar" com.taskcontract.android.tests.ApiTestsKt "${BASE_URL:-http://127.0.0.1:8787/api/v1}"
else
  echo "usage: test.sh [domain|api]"; exit 1
fi
