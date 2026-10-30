# 06 · 导入、解析与书的地图

## 1. 导入流程

```
入口：书架「＋ 导入」→ 系统文件选择器（@react-native-documents/picker，类型 PDF / EPUB，keepLocalCopy）
     或 其他 App「分享到 / 用 Pagewise 打开」（Intake 原生模块）
 → 复制到 files/books/_incoming/<ulid>.<ext>
 → FileTools.sha256 → 已有同哈希的书：删副本，toast「这本书已经在书架上了」，打开那本书
 → PDF：PdfPages.info（页数、页面尺寸）、textLayer（抽 5 页）、outline（书签）、pageLabels；
   EPUB：读 OPF 元数据和 nav
 → 写 import_draft → 解析设置页
 → 「开始解析」：
     PDF  → 建 book（status=parsing）+ book_part 分片 → 移动原文件到 files/books/<id>/source.pdf → 启动解析队列（§2）
     EPUB → 建 book → 本地解析（§4）→ 建地图 → status=ready
```

- 「最近」分组：显示通过 Intake 收到但还没导入的文件，以及没完成的导入草稿；都没有就不显示该分组。主按钮「从其他位置选择…」打开系统选择器（Android 13+ 拿不到下载目录的文件列表，不申请存储权限）。
- 书名 / 作者：PDF 取 info 字典，取不到用文件名；EPUB 取 `dc:title`/`dc:creator`。解析设置页可改（V1 只读显示，M5 可编辑）。
- PDF 封面：首次展示书籍时用 `PdfPages.render(source, 1, 360)` 渲染原文件的第一页，复制到 `files/books/<id>/cover.png` 持久保存；书架、首页、解析进度和笔记共用该图片。已导入的书自动补齐，不依赖 MinerU 结果或解析起始页，无需重新解析。图片 URI 在展示投影中派生，不写入数据库。
- 封面色：按书名哈希从皮肤无关的 8 色列表里取（原型 `data.js` 里的颜色），存 `book.cover_color`。EPUB、演示书籍、原文件缺失或封面生成/加载失败时保留彩色文字占位。

## 2. MinerU 客户端（`services/mineru`）

### 2.1 官方接口（2026-10-29 核对 <https://mineru.net/apiManage/docs>）

| 项 | 值 |
| --- | --- |
| 地址 | `https://mineru.net/api/v4` |
| 鉴权 | `Authorization: Bearer <token>`，`Content-Type: application/json` |
| 申请上传地址 | `POST /file-urls/batch`，body `{ files: [{ name, data_id, is_ocr }], model_version: 'vlm'\|'pipeline', enable_formula: true, enable_table: true, language: 'ch' }` → `data.batch_id`、`data.file_urls[]`（24 小时有效）；单次 ≤ 50 个 |
| 上传 | `PUT <file_url>`，**不要设置 Content-Type**；上传完成后自动开始解析 |
| 查询 | `GET /extract-results/batch/{batch_id}` → `data.extract_result[]`：`file_name`、`state`（`waiting-file` / `pending` / `running` / `converting` / `done` / `failed`）、`extract_progress.{extracted_pages,total_pages}`、`full_zip_url`、`err_msg` |
| 单文件限制 | **≤ 200 MB、≤ 200 页** |
| 额度 | **每天 1000 页最高优先级**，超出部分优先级降低（不拦截） |
| 结果包 | `full.md`、`*_content_list.json`、`layout.json`（middle）、`*_model.json`、`images/` |

> 与需求文档的差异：PRODUCT_DESIGN 写的是「600 页 / 每天 2000 页」，官方文档现在是 **200 页 / 1000 页**。代码里两个数都做成常量（`MINERU_MAX_PAGES = 200`、`MINERU_DAILY_PRIORITY_PAGES = 1000`），界面文案用常量拼。已记入 QUESTIONS.md Q-1。

错误码映射（`toAppError`）：

| code | 中文说明 | 处理 |
| --- | --- | --- |
| `A0202` | MinerU Token 不对 | 暂停队列，去「我的 → 解析服务」 |
| `A0211` | MinerU Token 已过期 | 同上；更新 Token 后从失败的片继续 |
| `-60005` / `-60006` | 文件太大 / 页数超限 | 该片自动对半再拆（§2.3），重新排队 |
| `-60009` | 提交队列已满 | 60 秒后自动重试，最多 5 次 |
| `-60018` | 今天的解析任务数到上限了 | 暂停，提示「明天再解析」，次日 App 打开时自动继续 |
| `-60002`/`-60003`/`-60004`/`-60011`/`-60015`/`-60020`/`-60021` | 文件读不了 / 格式不对 | 该片失败，可重试；连续失败 2 次提示检查文件 |
| `-60007`/`-60008`/`-60010`/`-10001` | MinerU 服务暂时不可用 / 解析失败 | 指数退避重试 3 次，之后标失败可手动重试 |
| 网络错误 / 超时 | 网络不可用 | 保留 batch_id，恢复网络后继续轮询，不重复上传 |

Token 有效期：API 不返回有效期。`MeMineru` 里更新 Token 时让用户可选填有效期（MinerU 后台能看到），`≤ 7 天` 时提醒；收到 `A0211` 时标记已过期。

### 2.2 客户端接口

```ts
interface MineruClient {
  requestUpload(files: { name: string; dataId: string; ocr: boolean }[], model: 'vlm' | 'pipeline'): Promise<{ batchId: string; urls: string[] }>;
  upload(url: string, filePath: string, onProgress: (sent: number, total: number) => void, signal: AbortSignal): Promise<void>;  // react-native-blob-util 流式 PUT
  query(batchId: string): Promise<MineruResult[]>;
  download(zipUrl: string, destDir: string, onProgress): Promise<string>;   // 下载 + react-native-zip-archive 解压，返回目录
  test(): Promise<{ ok: boolean; latencyMs: number; error?: AppError }>;     // 用一个不存在的 batch 查询判断 Token 是否有效
}
```
Token 每次调用前从 KeyStore 取，不缓存在 JS 变量里超过一次调用。

### 2.3 分片

- 按页切成 ≤ 200 页、且估算大小 ≤ 190 MB 的片（大小按「总大小 × 页数占比」估算，拆完以实际大小为准，超了再对半拆）。
- 顺序：先排「优先页」所在的片，然后往后，最后回到前面。例：1136 页、从 p.300 开始 → 片 [201–400]、[401–600]、[601–800]、[801–1000]、[1001–1136]、[1–200]。
- 拆分用原生 `PdfPages.split(src, from, to, out)`（PDFBox，保留文字层）。拆好一片传一片，上传成功后删除该片文件。
- 不用 `page_ranges` 参数代替本地拆分：官方对超过 200 页的文件是否接受 `page_ranges` 没写清，本地拆还能少传数据。

### 2.4 解析队列（`app/usecases/parseQueue.ts`）

- 单例，App 启动和回到前台时 `resume()`：读所有 `book_part.stage ∉ {done, failed}`，按书、片号继续。
- 并发：同时最多 1 个上传、3 个轮询。
- 每片的阶段推进（写库 + 更新 `library` 店铺）：

| stage | 做什么 | 界面阶段 |
| --- | --- | --- |
| `queued` → `splitting` | 本地拆分 | 上传 |
| `requesting` | `requestUpload` | 上传 |
| `uploading` | `upload`（进度 = 已传字节） | 上传 |
| `waiting` | 轮询到 `waiting-file`/`pending` | 排队 |
| `running` | 轮询到 `running`/`converting`（进度 = extracted/total） | 解析 |
| `downloading` | 下载结果包 | 下载结果 |
| `importing` | 入库 + 建地图（§2.5、§5） | 建地图 |
| `done` / `failed` | | 完成 / 已暂停 |

- 轮询间隔：2s 起，×1.5 退避，最长 30s；`running` 时固定 5s。App 在后台时不轮询（V1 不做后台任务，M5 再考虑 WorkManager）。
- 上传中 App 被杀：重启后该片回到 `requesting`（上传地址可能已失效，重新申请）。
- 额度：成功提交后把该片页数加到 `mineru.usedToday`（按本地日期归零），设置页显示。
- 每片 `done` 后：更新 `book.ready_to_page`（从第 1 页开始连续完成的最大页；优先片不连续时，地图里该范围的章节照样可学——「可学」看小节所在页是否已入库，不看 `ready_to_page`）。全部完成 → `status=ready`，做最终书签核对，toast「《书名》解析完成」。

### 2.5 结果包适配（`services/mineru/adapter.ts`）

MinerU 的输出格式在变（官方 API 的 zip 和开源 4.0 的保存格式不同），所以**只在适配器里认格式**，其余代码只看 `RawBlock`：

```ts
interface RawBlock {
  page: number;                  // 原书 PDF 页序号，1-based（= 片内 page_idx + part.page_from）
  bbox: [number, number, number, number] | null;   // 0..1 相对页面
  type: BlockType; level?: number;
  text: string; latex?: string; html?: string;
  imageFile?: string;            // 解压目录里的相对路径
  caption?: string;
}
function adapt(dir: string, part: { pageFrom: number }, pageSizes: { w: number; h: number }[]): Promise<RawBlock[]>
```

- 找 `*_content_list.json`；按 `page_idx`（0-based）、数组顺序读取。预期字段（以 T8 抓到的真实样本为准）：`type`（`text`/`title`… 或 `text` + `text_level`）、`text`、`text_level`、`page_idx`、`bbox`、`img_path`、`image_caption[]`、`image_footnote[]`、`table_body`（HTML）、`table_caption[]`、`text_format`（`latex`）。
- `bbox` 的坐标系（PDF 点 / 0–1000 归一化 / 像素）**以真实样本为准**：用 `layout.json` 里的页面尺寸或 `PdfPages.info` 的页面尺寸归一化到 0..1，写单测锁定。
- 丢弃：页眉、页脚、页码、空文本块；但先用页码块推断 `page_offset`（§5.4）。
- 列表项合并成 `list`；图说明（caption）挂到前一个 image/table 的 `caption`，同时保留成 `caption` 块（让讲解能引用）。
- 每个块 `seq = page * 1000 + 页内序号`（从 1 开始，一页 ≥ 1000 块时报错——实际不会）。同一片重新解析时先 `deleteByPages(from, to)` 再写。
- 图片复制到 `files/books/<id>/images/p<page>_<i>.<ext>`。
- 空页 > 20%（有块的页 / 片页数 < 0.8）：标记该片，进度页显示「可能是扫描版，建议打开 OCR 重新解析这一片」+「用 OCR 重新解析」按钮。

**T8 的第一件事**：用负责人自己的 Token 解析《人工智能：现代方法》第 3 章所在的 1–2 片，把结果包放进 `fixtures/private/aima-ch3/`（git 忽略，书的内容有版权），据此写适配器和测试；同时手写一个合成的小结果包 `fixtures/mineru-synthetic/`（自编内容，可提交）给 CI 用。

## 3. 原生模块（Kotlin，TurboModule）

规格写在 `src/platform/specs/*.ts`（codegen），实现放 `android/app/src/main/java/com/pagewise/`，JS 侧在 `src/platform/*.ts` 包一层，`platform/fakes/` 有假实现。

```ts
// NativePdfPages.ts
export interface Spec extends TurboModule {
  info(path: string): Promise<{ pageCount: number; sizes: { w: number; h: number }[] }>;          // 点（pt）
  render(path: string, page: number, widthPx: number): Promise<{ uri: string; w: number; h: number }>;   // PdfRenderer，PNG 写到 cache/pages，命中缓存直接返回
  outline(path: string): Promise<{ title: string; page: number; level: number }[]>;                // PDFBox，page 1-based
  pageLabels(path: string): Promise<string[] | null>;                                              // PDFBox PDPageLabels
  textLayer(path: string, pages: number[]): Promise<{ withText: number; sampled: number }>;       // PDFBox PDFTextStripper，每页 ≥ 20 个非空白字符算有
  split(path: string, from: number, to: number, outPath: string): Promise<{ sizeBytes: number }>;
  close(path: string): Promise<void>;
}
// NativeFileTools.ts
export interface Spec extends TurboModule {
  sha256(path: string): Promise<string>;                      // 流式 1MB 缓冲，后台线程
  stat(path: string): Promise<{ size: number; exists: boolean }>;
  copyFromUri(uri: string, destPath: string): Promise<{ size: number; name: string | null; mime: string | null }>;
  saveToDownloads(srcPath: string, name: string, mime: string): Promise<string>;   // MediaStore.Downloads，子目录 Pagewise导出/
  share(path: string, mime: string): Promise<void>;           // FileProvider + ACTION_SEND
  freeSpace(): Promise<number>;
  dirSize(path: string): Promise<number>;
  remove(path: string): Promise<void>;
}
// NativeIntake.ts
export interface Spec extends TurboModule {
  initial(): Promise<{ uri: string; name: string | null; mime: string | null } | null>;
  addListener(event: string): void; removeListeners(count: number): void;   // 事件 'intake'
}
```

- `PdfRenderer` 不是线程安全的：每个打开的文件一个单线程 executor；同一时间最多打开 2 本书，LRU 关闭。
- 渲染宽度 = 屏幕宽 × 设备像素比，最多 1440px；读书页预渲染当前页 ±2 页。
- `AndroidManifest.xml`：`MainActivity` 加 intent-filter：`VIEW` 和 `SEND`，mime `application/pdf`、`application/epub+zip`；`FileProvider` 配 `cache/exports`。
- 权限：只要 `INTERNET`。不申请存储权限。

## 4. EPUB 本地解析（`services/epub`）

1. 解压到 `files/books/<id>/epub/`。
2. `META-INF/container.xml` → OPF：元数据、manifest、spine。
3. 目录：EPUB 3 `nav.xhtml`（`epub:type="toc"`），否则 EPUB 2 `toc.ncx`。得到 `{title, href#anchor, level}` 树。
4. 按 spine 顺序用 `htmlparser2` 解析每个 XHTML 成块：`h1–h6` → title（level），`p` → text，`ul/ol` → list，`pre` → code，`img`/`svg image` → image（复制文件），`table` → table（保留 HTML，text 为纯文本），`math` → equation（有 `alttext` 用它当 latex，否则用纯文本），`figcaption` → caption。行内 `<b>`/`<strong>` 保留成 `**`。
5. `seq` 从 1 连续编号；`page=NULL`；`loc` = 所在目录项标题 + 段序号；`bbox=NULL`。
6. 地图直接来自目录树（`source='bookmark'`），用目录项的锚点定位 `block_from`；小节编号沿用标题里的数字，没有就生成 `u<seq>`。
7. 读书模式只有「重排」（原版按钮置灰，提示「EPUB 只有重排模式」）；引用胶囊显示 `loc` 而不是页码。

## 5. 书的地图构建（`core/map`）

纯函数：`buildMap(blocks: Block[], outline: OutlineItem[] | null, prev: Section[] /* 含 manual */): { sections: Section[]; parts: SectionPart[]; flags: Flag[]; pageOffset: number }`。每片入库后对**全书已有的块**重跑一次（结果确定、幂等），保留 `manual`。

### 5.1 识别标题

1. 候选 = `type='title'` 的块，外加「看起来像标题的 text 块」（以编号开头、≤ 40 字、独占一段，且 MinerU 给了 level 或者字号明显大——V1 只用前三个条件）。
2. 编号规则：
   - `^(\d+)\.(\d+)\.(\d+)\s*(.+)$` → 小节（level 3）
   - `^(\d+)\.(\d+)\s*(.+)$` → 节（level 2）
   - `^第\s*([0-9一二三四五六七八九十百零]+)\s*章\s*(.*)$` 或 `^(?:Chapter\s+)?(\d+)\s+(.+)$`（且后面有 `n.1` 节）→ 章（level 1）
   - `^附录\s*([A-Z])\s*(.*)$` / `^Appendix\s+([A-Z])` → 附录（level 1，id `appA`）
3. 没编号的标题：按 MinerU `level` 挂到最近的上级；章首「本章引言」类内容并入第一节（规则 5）。
4. 跨两行被拆成两个标题的（第二个标题没有编号、紧跟在第一个后面、同一页、两者之间没有正文块）：合并，标 `flag='merged'`（原型 3.5.4 的例子）。

### 5.2 范围

小节范围 = 从它的标题块到下一个同级或更高级标题块之前（seq）。页码范围由块推出。

### 5.3 段与长短小节

- 叶子小节 > 4000 字：在段落边界切成若干段，每段 1500–3000 字，`equation|image|table|code` 和它前后一块不切开；段名 = 段内第一个子标题，或「第 i 段」。
- 叶子小节 < 300 字：并入后一个兄弟（没有后一个就并入前一个），`merged_into` 记目标；章首引言并入第一节。

### 5.4 页码偏移

书上印的页码和 PDF 页序号不同（前言、目录占页）。显示给用户的「p.103」必须是印刷页码：
1. 有 PDF `pageLabels` 且是阿拉伯数字 → 用它（逐页映射，存 `book.page_offset` 的同时缓存 labels）。
2. 否则用 MinerU 识别出的页码块：统计 `PDF 页序号 - 页码数字` 的众数，覆盖率 ≥ 60% 时采用。
3. 都没有 → 0；地图页顶部提示「页码可能和书上不一致」，点开可以输入「书上第 1 页是 PDF 的第几页」。
所有 UI 显示页码都通过 `core/ids.ts` 的 `pageLabel(book, pdfPage)`。

### 5.5 书签核对

对比 `outline`（只取 level 1–3）与识别结果：标题去空白、去编号后做编辑距离相似度（≥ 0.8 算同一个），页码差 ≤ 1（都换成 PDF 页序号比较）。

| 情况 | 处理 |
| --- | --- |
| 书签有、解析没有 | `flag='missing'`，用书签的标题和页码补一个小节（范围从该页第一个块开始），用户可一键确认或删除 |
| 解析有、书签没有 | 正常保留（书签往往只到二级） |
| 层级不同 | 以书签为准，`flag='level'` |
| 合并的跨行标题 | `flag='merged'`，用户可选「保持合并 / 拆成两个」 |

核对结果写进地图页顶部的核对条（03 §4）。

### 5.6 重新解析时迁移学习记录

同一本书重新解析（OCR 重来、换模型）后，旧块 seq 可能变。迁移：对每个被引用的旧块（message 引用、highlight、pin、quote），在新块里找「同页 ±1、规范化文本（去空白和标点）相似度 ≥ 0.9」的块；找到就改 seq，找不到在笔记里显示「原文位置已变化」。写单测。

### 5.7 测试

- 合成夹具：3 章、含跨行标题、长小节、短小节、附录、页码偏移 12 的书；断言章节树、范围、段、flag、偏移。
- 私有夹具（本机有 `fixtures/private/aima-ch3/` 时才跑）：第 3 章得到 6 个节、26 个小节，页码和书签一致（STUDY_ENGINE §11）。
