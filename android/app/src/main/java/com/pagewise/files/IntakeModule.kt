package com.pagewise.files

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.pagewise.specs.NativeIntakeSpec
import java.lang.ref.WeakReference

@ReactModule(name = IntakeModule.NAME)
class IntakeModule(context: ReactApplicationContext) : NativeIntakeSpec(context) {
  init { instance=WeakReference(this) }
  private fun read(intent: Intent?): WritableMap? {
    if (intent == null || intent.getBooleanExtra("pagewise.intake.consumed",false)) return null
    val uri = when(intent.action) {
      Intent.ACTION_VIEW -> intent.data
      Intent.ACTION_SEND -> @Suppress("DEPRECATION") (intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))
      else -> null
    } ?: return null
    val mime=intent.type ?: reactApplicationContext.contentResolver.getType(uri)
    if(mime != "application/pdf" && mime != "application/epub+zip" && !uri.toString().substringBefore('?').endsWith(".pdf",true) && !uri.toString().substringBefore('?').endsWith(".epub",true)) return null
    var name: String?=null
    if(uri.scheme=="content") reactApplicationContext.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)?.use{if(it.moveToFirst())name=it.getString(0)}
    intent.putExtra("pagewise.intake.consumed",true)
    return Arguments.createMap().apply{putString("uri",uri.toString());putString("name",name ?: uri.lastPathSegment);putString("mime",mime)}
  }
  override fun initial(promise: Promise) { try { promise.resolve(read(reactApplicationContext.currentActivity?.intent)) } catch(error:Exception){promise.reject("intake","无法读取分享文件",error)} }
  private fun dispatch(intent: Intent) { try { if(reactApplicationContext.hasActiveReactInstance())read(intent)?.let{emitOnIntake(it)} } catch(_:Exception) { /* initial() can retry the untouched intent. */ } }
  override fun invalidate(){if(instance?.get()===this)instance=null;super.invalidate()}
  companion object { const val NAME="Intake";private var instance: WeakReference<IntakeModule>?=null;fun onIntent(intent:Intent){instance?.get()?.dispatch(intent)} }
}
