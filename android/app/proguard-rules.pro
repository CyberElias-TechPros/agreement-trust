# TaskContract release rules.
# Keep the four components referenced by name from the manifest.
-keep class com.taskcontract.android.App
-keep class com.taskcontract.android.MainActivity
-keep class com.taskcontract.android.platform.** { *; }

# Kotlin metadata is not needed at runtime.
-dontnote kotlin.**
-dontwarn kotlin.**
