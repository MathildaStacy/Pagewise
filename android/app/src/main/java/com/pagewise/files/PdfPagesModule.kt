package com.pagewise.files

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.pagewise.specs.NativePdfPagesSpec
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineNode
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors
import kotlin.math.roundToInt

@ReactModule(name = PdfPagesModule.NAME)
class PdfPagesModule(context: ReactApplicationContext) : NativePdfPagesSpec(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private data class OpenPdf(val fd: ParcelFileDescriptor, val renderer: PdfRenderer)
  private val opened = LinkedHashMap<String, OpenPdf>(4, 0.75f, true)
  private fun file(path: String) = File(if (path.startsWith("file://")) Uri.parse(path).path!! else path)
  private fun work(promise: Promise, action: () -> Any?) {
    worker.execute { try { promise.resolve(action()) } catch (error: Exception) { promise.reject("pdf", error.message ?: "PDF 处理失败", error) } }
  }
  private fun renderer(path: String): PdfRenderer {
    val key = file(path).canonicalPath
    opened[key]?.let { return it.renderer }
    val fd = ParcelFileDescriptor.open(file(path), ParcelFileDescriptor.MODE_READ_ONLY)
    val reader = try { PdfRenderer(fd) } catch (error: Exception) { fd.close(); throw error }
    opened[key] = OpenPdf(fd, reader)
    while (opened.size > 2) { val oldest = opened.entries.first(); oldest.value.renderer.close(); oldest.value.fd.close(); opened.remove(oldest.key) }
    return reader
  }
  override fun info(path: String, promise: Promise) = work(promise) {
    val reader = renderer(path)
    val sizes = Arguments.createArray()
    for (i in 0 until reader.pageCount) reader.openPage(i).use { page -> sizes.pushMap(Arguments.createMap().apply { putDouble("w", page.width.toDouble()); putDouble("h", page.height.toDouble()) }) }
    val output = Arguments.createMap().apply { putInt("pageCount", reader.pageCount); putArray("sizes", sizes) }
    PDDocument.load(file(path)).use { doc -> output.putString("title", doc.documentInformation.title); output.putString("author", doc.documentInformation.author) }
    output
  }
  override fun render(path: String, page: Double, widthPx: Double, promise: Promise) = work(promise) {
    val source = file(path)
    val reader = renderer(path)
    val index = page.toInt() - 1
    require(index in 0 until reader.pageCount) { "PDF 页码超出范围" }
    val width = widthPx.toInt().coerceIn(1, 1440)
    val key = MessageDigest.getInstance("SHA-256").digest("${source.canonicalPath}:${source.lastModified()}:${source.length()}:$index:$width".toByteArray()).joinToString("") { "%02x".format(it) }
    val directory = File(reactApplicationContext.cacheDir, "pages").apply { mkdirs() }
    val target = File(directory, "$key.png")
    reader.openPage(index).use { pdfPage ->
      val height = (width.toDouble() * pdfPage.height / pdfPage.width).roundToInt().coerceAtLeast(1)
      if (!target.exists()) {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        try { bitmap.eraseColor(Color.WHITE); pdfPage.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY); target.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) } } finally { bitmap.recycle() }
        // Render cache is disposable; limit disk use without touching book sources.
        val images = directory.listFiles()?.sortedBy { it.lastModified() } ?: emptyList()
        var bytes = images.sumOf { it.length() }
        for (image in images) { if (bytes <= 100_000_000L) break; if (image != target) { bytes -= image.length(); image.delete() } }
      }
      target.setLastModified(System.currentTimeMillis())
      Arguments.createMap().apply { putString("uri", Uri.fromFile(target).toString()); putInt("w", width); putInt("h", height) }
    }
  }
  override fun outline(path: String, promise: Promise) = work(promise) {
    val result = Arguments.createArray()
    PDDocument.load(file(path)).use { doc ->
      fun walk(parent: PDOutlineNode, level: Int) {
        var item = parent.firstChild
        while (item != null) {
          val current = item
          val page = current.findDestinationPage(doc)
          if (page != null) result.pushMap(Arguments.createMap().apply { putString("title", current.title ?: ""); putInt("page", doc.pages.indexOf(page) + 1); putInt("level", level) })
          walk(current, level + 1)
          item = current.nextSibling
        }
      }
      doc.documentCatalog.documentOutline?.let { walk(it, 1) }
    }
    result
  }
  override fun pageLabels(path: String, promise: Promise) = work(promise) {
    PDDocument.load(file(path)).use { doc -> doc.documentCatalog.pageLabels?.labelsByPageIndices?.let { labels -> Arguments.createArray().apply { labels.forEach { pushString(it) } } } }
  }
  override fun textLayer(path: String, pages: ReadableArray, promise: Promise) = work(promise) {
    var sampled = 0; var withText = 0
    PDDocument.load(file(path)).use { doc ->
      val stripper = PDFTextStripper()
      for (i in 0 until pages.size()) { val page = pages.getInt(i); if (page !in 1..doc.numberOfPages) continue; stripper.startPage = page; stripper.endPage = page; sampled++; if (stripper.getText(doc).count { !it.isWhitespace() } >= 20) withText++ }
    }
    Arguments.createMap().apply { putInt("sampled", sampled); putInt("withText", withText) }
  }
  override fun split(path: String, from: Double, to: Double, outPath: String, promise: Promise) = work(promise) {
    val output = file(outPath); output.parentFile?.mkdirs()
    PDDocument.load(file(path)).use { doc ->
      require(from.toInt() >= 1 && to.toInt() <= doc.numberOfPages && from <= to) { "分片页码超出范围" }
      PDDocument().use { part -> for (page in from.toInt()..to.toInt()) part.importPage(doc.getPage(page - 1)); part.save(output) }
    }
    Arguments.createMap().apply { putDouble("sizeBytes", output.length().toDouble()) }
  }
  override fun close(path: String, promise: Promise) = work(promise) { opened.remove(file(path).canonicalPath)?.let { it.renderer.close(); it.fd.close() }; null }
  override fun invalidate() { worker.execute { opened.values.forEach { it.renderer.close(); it.fd.close() }; opened.clear() }; worker.shutdown(); super.invalidate() }
  companion object { const val NAME = "PdfPages" }
}
