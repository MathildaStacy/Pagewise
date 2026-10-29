import { FileTools } from '@platform/FileTools';
import { PdfPages } from '@platform/PdfPages';
import { bookFiles } from '@platform/bookFiles';

/** Debug menu acceptance harness. The source is copied into app cache by adb. */
export async function runNativePdfSmoke() {
  const source = `${bookFiles.cacheDir}/acceptance.pdf`;
  const [info, hash, stat, outline, labels] = await Promise.all([
    PdfPages.info(source),
    FileTools.sha256(source),
    FileTools.stat(source),
    PdfPages.outline(source),
    PdfPages.pageLabels(source),
  ]);
  if (info.pageCount < 1 || !stat.exists || hash.length !== 64)
    throw new Error('PDF 元数据或哈希校验失败');
  const samples = [
    1,
    Math.min(20, info.pageCount),
    Math.min(50, info.pageCount),
    Math.min(100, info.pageCount),
    info.pageCount,
  ];
  const text = await PdfPages.textLayer(source, samples);
  const first = await PdfPages.render(source, 1, 1080);
  const cached = await PdfPages.render(source, 1, 1080);
  if (first.uri !== cached.uri) throw new Error('PDF 页面缓存未命中');
  const sampleFrom = Math.min(101, info.pageCount),
    sampleTo = Math.min(sampleFrom + 9, info.pageCount);
  const split = `${bookFiles.cacheDir}/acceptance-sample.pdf`;
  const part = await PdfPages.split(source, sampleFrom, sampleTo, split);
  const splitInfo = await PdfPages.info(split);
  if (splitInfo.pageCount !== sampleTo - sampleFrom + 1 || part.sizeBytes <= 0)
    throw new Error('PDF 分片验证失败');
  const report = {
    pages: info.pageCount,
    size: stat.size,
    hash,
    title: info.title,
    author: info.author,
    outline: outline.length,
    labels: labels?.length ?? 0,
    text,
    first,
    cached: cached.uri === first.uri,
    sampleFrom,
    sampleTo,
    samplePages: splitInfo.pageCount,
    sampleBytes: part.sizeBytes,
  };
  await bookFiles.writeText(
    `${bookFiles.cacheDir}/native-smoke.json`,
    JSON.stringify(report),
  );
  await bookFiles.writeText(
    `${bookFiles.cacheDir}/acceptance-outline.json`,
    JSON.stringify(outline),
  );
  await PdfPages.close(source);
  await PdfPages.close(split);
  return report;
}

export async function runNativeReaderSmoke() {
  const source = `${bookFiles.cacheDir}/acceptance.pdf`;
  const samples: number[] = [];
  const started = Date.now();
  for (let page = 51; page <= 100; page++) {
    const before = Date.now();
    const image = await PdfPages.render(source, page, 1080);
    if (!image.uri || image.w !== 1080 || image.h <= 0)
      throw new Error('PDF 连续渲染失败');
    samples.push(Date.now() - before);
  }
  const cacheBytes = await FileTools.dirSize(`${bookFiles.cacheDir}/pages`);
  if (cacheBytes > 100_000_000) throw new Error('PDF 缓存超过上限');
  const ordered = [...samples].sort((a, b) => a - b);
  const report = {
    pages: samples.length,
    totalMs: Date.now() - started,
    medianMs: ordered[24],
    p95Ms: ordered[47],
    maxMs: ordered[49],
    cacheBytes,
    samplesMs: samples,
  };
  await bookFiles.writeText(
    `${bookFiles.cacheDir}/reader-smoke.json`,
    JSON.stringify(report),
  );
  await PdfPages.close(source);
  return report;
}
