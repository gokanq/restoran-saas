plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.restoransaas.callerid"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.restoransaas.callerid"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
}

kotlin {
    jvmToolchain(17)
}
