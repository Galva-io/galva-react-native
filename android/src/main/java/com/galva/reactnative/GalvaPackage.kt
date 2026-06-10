package com.galva.reactnative

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Legacy [ReactPackage] (not [com.facebook.react.BaseReactPackage]) — registered
 * with autolinking via react-native.config.js so it resolves deterministically
 * across RN versions. Returns the single [GalvaModule]; no view managers.
 */
class GalvaPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): List<NativeModule> = listOf(GalvaModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
