package com.pagewise.files

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.ReactApplication
import com.facebook.react.module.annotations.ReactModule
import com.pagewise.specs.NativeFileToolsSpec
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

@ReactModule(name = FileToolsModule.NAME)
class FileToolsModule(context: ReactApplicationContext) : NativeFileToolsSpec(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private fun file(path: String) = File(if (path.startsWith("file://")) Uri.parse(path).path!! else path)
  private fun work(promise: Promise, action: () -> Any?) { worker.execute { try { promise.resolve(action()) } catch (error: Exception) { promise.reject("file", error.message ?: "文件处理失败", error) } } }
  override fun sha256(path: String, promise: Promise) = work(promise) {
    val digest = MessageDigest.getInstance("SHA-256")
    file(path).inputStream().use { input -> val buffer = ByteArray(1024 * 1024); while (true) { val count = input.read(buffer); if (count < 0) break; digest.update(buffer, 0, count) } }
    digest.digest().joinToString("") { "%02x".format(it) }
  }
  override fun stat(path: String, promise: Promise) = work(promise) { val source=file(path); Arguments.createMap().apply { putBoolean("exists", source.exists()); putDouble("size", source.length().toDouble()) } }
  override fun copyFromUri(uri: String, destPath: String, promise: Promise) = work(promise) {
    val parsed = Uri.parse(uri); val resolver = reactApplicationContext.contentResolver
    var name: String? = null
    if (parsed.scheme == "content") resolver.query(parsed, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) name=cursor.getString(0) }
    val destination=file(destPath);destination.parentFile?.mkdirs()
    try { (if (parsed.scheme == "content") resolver.openInputStream(parsed) else file(uri).inputStream())?.use { input -> destination.outputStream().use { input.copyTo(it, 1024 * 1024) } } ?: error("无法读取这个文件") } catch(error:Exception) { destination.delete();throw error }
    Arguments.createMap().apply { putDouble("size", destination.length().toDouble()); putString("name", name ?: parsed.lastPathSegment); putString("mime", resolver.getType(parsed)) }
  }
  override fun saveToDownloads(srcPath: String, name: String, mime: String, promise: Promise) = work(promise) {
    require(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { "请使用分享到文件，当前系统不支持直接保存到下载" }
    val resolver=reactApplicationContext.contentResolver
    val safeName=name.substringAfterLast('/').substringAfterLast('\\')
    val values=ContentValues().apply { put(MediaStore.MediaColumns.DISPLAY_NAME,safeName);put(MediaStore.MediaColumns.MIME_TYPE,mime);put(MediaStore.MediaColumns.RELATIVE_PATH,"Download/Pagewise导出");put(MediaStore.MediaColumns.IS_PENDING,1) }
    val uri=resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values) ?: error("不能建立下载文件")
    try { resolver.openOutputStream(uri)?.use { output -> file(srcPath).inputStream().use { it.copyTo(output) } } ?: error("不能保存下载文件");resolver.update(uri,ContentValues().apply{put(MediaStore.MediaColumns.IS_PENDING,0)},null,null) } catch(error:Exception) { resolver.delete(uri,null,null);throw error }
    uri.toString()
  }
  override fun share(path: String, mime: String, promise: Promise) = work(promise) {
    val source=file(path)
    val export=File(reactApplicationContext.cacheDir,"exports/${source.name}").apply{parentFile?.mkdirs()}
    if(source.canonicalPath != export.canonicalPath)source.copyTo(export,overwrite=true)
    val uri=FileProvider.getUriForFile(reactApplicationContext,reactApplicationContext.packageName+".files",export)
    val intent=Intent(Intent.ACTION_SEND).apply{type=mime;putExtra(Intent.EXTRA_STREAM,uri);addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)}
    reactApplicationContext.startActivity(Intent.createChooser(intent,"分享文件").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));null
  }
  override fun freeSpace(promise: Promise) = work(promise) { reactApplicationContext.filesDir.usableSpace.toDouble() }
  override fun dirSize(path: String, promise: Promise) = work(promise) { file(path).walkTopDown().filter{it.isFile}.sumOf{it.length()}.toDouble() }
  override fun remove(path: String, promise: Promise) = work(promise) { val target=file(path); require(!target.exists() || target.deleteRecursively()) { "文件无法删除" };null }
  override fun restart(promise: Promise) {
    val application = reactApplicationContext.applicationContext as ReactApplication
    promise.resolve(null)
    UiThreadUtil.runOnUiThread { application.reactHost?.reload("Pagewise restored backup") }
  }
  override fun invalidate(){worker.shutdown();super.invalidate()}
  companion object { const val NAME="FileTools" }
}
