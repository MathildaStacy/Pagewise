package com.pagewise.ui

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class UiEnvironmentPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == UiEnvironmentModule.NAME) UiEnvironmentModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        UiEnvironmentModule.NAME to ReactModuleInfo(
          UiEnvironmentModule.NAME,
          UiEnvironmentModule::class.java.name,
          false,
          false,
          false,
          true,
        )
      )
    }
}
