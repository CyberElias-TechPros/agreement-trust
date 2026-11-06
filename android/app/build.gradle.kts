plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.taskcontract.android"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.taskcontract.android"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    // The domain/API JVM suites run via tools/test.sh (no JUnit dependency);
    // exclude them from the APK sources.
    sourceSets {
        getByName("main") {
            java.srcDirs("src/main/java")
        }
    }
}

dependencies {
    // Only the Kotlin stdlib — everything else is the Android framework.
    implementation(kotlin("stdlib"))
}
