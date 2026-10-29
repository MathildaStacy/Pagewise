package com.pagewise.ui

import android.app.ActivityManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.PowerManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.pagewise.specs.NativeUiEnvironmentSpec

/** 只查询系统材质能力；没有权限申请、轮询或后台任务。 */
@ReactModule(name = UiEnvironmentModule.NAME)
class UiEnvironmentModule(context: ReactApplicationContext) : NativeUiEnvironmentSpec(context) {
  @Volatile private var observing = false

  private val powerReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (
        intent?.action == PowerManager.ACTION_POWER_SAVE_MODE_CHANGED &&
        observing &&
        reactApplicationContext.hasActiveReactInstance()
      ) {
        emitOnChange(readSnapshot())
      }
    }
  }

  private fun state(lowRam: Boolean, powerSave: Boolean): WritableMap =
    Arguments.createMap().apply {
      putBoolean("lowRam", lowRam)
      putBoolean("powerSave", powerSave)
      putBoolean("blurAllowed", !lowRam && !powerSave)
    }

  private fun readSnapshot(): WritableMap {
    return try {
      val activity = reactApplicationContext.getSystemService(ActivityManager::class.java)
      val power = reactApplicationContext.getSystemService(PowerManager::class.java)
      state(activity?.isLowRamDevice ?: true, power?.isPowerSaveMode ?: true)
    } catch (_: RuntimeException) {
      // 系统服务暂时不可读时使用填充材质，不让装饰效果阻止页面使用。
      state(lowRam = true, powerSave = true)
    }
  }

  override fun getCurrent(promise: Promise) {
    promise.resolve(readSnapshot())
  }

  @Synchronized
  override fun startObserving() {
    if (observing) return
    val filter = IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactApplicationContext.registerReceiver(powerReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      reactApplicationContext.registerReceiver(powerReceiver, filter)
    }
    observing = true
  }

  @Synchronized
  override fun stopObserving() {
    if (!observing) return
    observing = false
    reactApplicationContext.unregisterReceiver(powerReceiver)
  }

  override fun invalidate() {
    stopObserving()
    super.invalidate()
  }

  companion object {
    const val NAME = "UiEnvironment"
  }
}
