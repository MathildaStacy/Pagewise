# 04 · 数据层

## 1. 基础

- `src/data/db.ts`、`drivers/opSqlite.ts`、`drivers/nodeSqlite.ts`、`migrations/index.ts` **从 AShareSim 原样复制**（`Db` 接口、事务锁、`PRAGMA user_version` 迁移）。数据库文件名 `pagewise.db`。
- 打开后执行：`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`
- 时间统一存 ISO 字符串（UTC，`2026-10-29T08:00:00.000Z`）；闪卡到期日存**本地日期** `YYYY-MM-DD`（见 05 §11）。
- 布尔用 INTEGER 0/1；JSON 列以 `_json` 结尾，读写都经过仓库里的 `parse/serialize`，带版本兜底。
- 文件存放（App 私有目录 `files/`）：

```
files/books/<bookId>/source.pdf|epub      原文件副本
files/books/<bookId>/parts/<n>.pdf        拆分后的上传片（上传成功后删除）
files/books/<bookId>/mineru/<n>/          每片的结果包解压目录（content_list、md、images/）
files/books/<bookId>/images/              入库后统一的图片目录（块里的 image_path 指向这里）
cache/pages/<bookId>/<page>@<w>.png       原版页位图缓存（可随时删除，LRU 上限 300 MB）
```

## 2. 迁移 0001_init

```sql
CREATE TABLE book (
  id TEXT PRIMARY KEY,                       -- ulid
  sha256 TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL CHECK (format IN ('pdf','epub')),
  pages INTEGER,                             -- PDF 页数；EPUB 为 NULL
  size_bytes INTEGER NOT NULL,
  has_text_layer INTEGER,                    -- PDF：抽样页有文字层
  has_outline INTEGER,                       -- PDF：有书签目录
  outline_json TEXT,                         -- 书签目录 [{title, page, level}]，用于核对地图
  page_offset INTEGER NOT NULL DEFAULT 0,    -- 印刷页码 = PDF 页序号 - page_offset（见 06 §5.4）
  cover_color TEXT NOT NULL,
  parse_model TEXT CHECK (parse_model IN ('vlm','pipeline')),
  ocr INTEGER NOT NULL DEFAULT 0,
  priority_from INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('importing','parsing','paused','ready','failed')),
  ready_to_page INTEGER NOT NULL DEFAULT 0,  -- 从第 1 页起连续可学到第几页
  tokens_total INTEGER NOT NULL DEFAULT 0,   -- 这本书累计 AI token（冗余，方便显示）
  created_at TEXT NOT NULL,
  last_opened_at TEXT
);

CREATE TABLE book_part (                     -- 解析分片（STUDY_ENGINE 的 BookFile）
  book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  part_no INTEGER NOT NULL,                  -- 从 1 开始，按解析顺序（优先页所在片先）
  page_from INTEGER NOT NULL, page_to INTEGER NOT NULL,   -- 原书 PDF 页序号，1-based，含两端
  file_path TEXT, size_bytes INTEGER,
  batch_id TEXT, data_id TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('queued','splitting','requesting','uploading','waiting','running','downloading','importing','done','failed')),
  extracted_pages INTEGER, total_pages INTEGER,
  error_code TEXT, error_msg TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_poll_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (book_id, part_no)
);

CREATE TABLE block (
  id INTEGER PRIMARY KEY,                    -- 全局 rowid（给 FTS 用）
  book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,                      -- 全书内稳定、有序的块号；PDF = 页序号*1000 + 页内序号，EPUB = 1..N；对外引用 'b'||seq（06 §2.5）
  page INTEGER,                              -- PDF 页序号（1-based）；EPUB 为 NULL
  loc TEXT,                                  -- EPUB 的位置标签（'第 3 章 · 12'）
  x0 REAL, y0 REAL, x1 REAL, y1 REAL,        -- 0..1，相对页面左上角
  type TEXT NOT NULL CHECK (type IN ('title','text','equation','image','table','list','code','caption','footnote')),
  level INTEGER,                             -- 标题层级（仅 title）
  text TEXT NOT NULL DEFAULT '',             -- 纯文本（行内公式写成 $..$）；图 / 表为说明文字
  latex TEXT,                                -- 独立公式
  html TEXT,                                 -- 表格 HTML
  image_path TEXT,                           -- 相对 files/books/<id>/
  section_id TEXT,                           -- 所属叶子小节（地图建好后回填）
  chars INTEGER NOT NULL,
  UNIQUE (book_id, seq)
);
CREATE INDEX block_page ON block(book_id, page);
CREATE INDEX block_section ON block(book_id, section_id, seq);

CREATE VIRTUAL TABLE block_fts USING fts5(
  text, book_id UNINDEXED,
  content='block', content_rowid='id', tokenize='trigram'
);
CREATE TRIGGER block_ai AFTER INSERT ON block BEGIN
  INSERT INTO block_fts(rowid, text, book_id) VALUES (new.id, new.text || ' ' || coalesce(new.latex,''), new.book_id);
END;
CREATE TRIGGER block_ad AFTER DELETE ON block BEGIN
  INSERT INTO block_fts(block_fts, rowid, text, book_id) VALUES ('delete', old.id, old.text || ' ' || coalesce(old.latex,''), old.book_id);
END;

CREATE TABLE section (
  book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  id TEXT NOT NULL,                          -- '3.5.2'；章 'ch3'；附录 'appA'；无编号 'u<seq>'
  parent_id TEXT,
  level INTEGER NOT NULL CHECK (level IN (1,2,3)),
  ord INTEGER NOT NULL,                      -- 全书先序遍历顺序
  no TEXT,                                   -- 显示编号：'3' / '3.5.2'
  title TEXT NOT NULL,
  is_leaf INTEGER NOT NULL,
  block_from INTEGER, block_to INTEGER,      -- seq 范围（含两端）
  page_from INTEGER, page_to INTEGER,
  chars INTEGER NOT NULL DEFAULT 0,
  parts INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','learning','done')),
  summary TEXT,
  guide TEXT,                                -- 本节导读（第一次展开时生成）
  source TEXT NOT NULL CHECK (source IN ('auto','bookmark','manual')),
  flag TEXT CHECK (flag IN ('missing','level','merged','split')),
  flag_detail_json TEXT,
  merged_into TEXT,                          -- < 300 字并入的目标小节
  PRIMARY KEY (book_id, id)
);
CREATE INDEX section_ord ON section(book_id, ord);

CREATE TABLE section_part (                  -- 长小节切出的段
  book_id TEXT NOT NULL, section_id TEXT NOT NULL, part_no INTEGER NOT NULL,   -- 从 0 开始
  block_from INTEGER NOT NULL, block_to INTEGER NOT NULL, name TEXT NOT NULL,
  PRIMARY KEY (book_id, section_id, part_no),
  FOREIGN KEY (book_id, section_id) REFERENCES section(book_id, id) ON DELETE CASCADE
);

CREATE TABLE lesson_plan (
  book_id TEXT NOT NULL, section_id TEXT NOT NULL, part_no INTEGER NOT NULL,
  steps_json TEXT NOT NULL,                  -- [{no,title,kind,block_from,block_to,status}]，见 05 §5
  source TEXT NOT NULL CHECK (source IN ('model','fallback')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (book_id, section_id, part_no)
);

CREATE TABLE study_state (
  book_id TEXT PRIMARY KEY REFERENCES book(id) ON DELETE CASCADE,
  main_section TEXT, main_part INTEGER NOT NULL DEFAULT 0, main_step INTEGER NOT NULL DEFAULT 0,
  phase TEXT NOT NULL DEFAULT 'idle' CHECK (phase IN ('idle','planning','teaching','quiz','ready')),
  detours_json TEXT NOT NULL DEFAULT '[]',   -- 岔路栈 [{sectionId, detourId, reviewStuckId?}]
  mode TEXT NOT NULL DEFAULT 'listen' CHECK (mode IN ('listen','read')),
  reader_view TEXT NOT NULL DEFAULT 'orig' CHECK (reader_view IN ('orig','flow')),
  read_anchor INTEGER,                       -- block seq
  resume_shown_at TEXT,                      -- 本次续学回顾生成时间（防止重复生成）
  last_active_at TEXT
);

CREATE TABLE detour (
  id INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  from_section TEXT NOT NULL, to_section TEXT NOT NULL, depth INTEGER NOT NULL,
  title TEXT,                                -- 回主线时由整理模型起的标题（'A* 和一致代价搜索的关系'）
  stuck_id INTEGER,                          -- 复习卡点进入的岔路
  started_at TEXT NOT NULL, ended_at TEXT
);

CREATE TABLE message (
  id INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,                  -- 主线小节（岔路消息也记主线小节，另有 detour_id）
  part_no INTEGER, step_no INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('user','assistant','tool','card')),
  intent TEXT,                               -- next|nextPart|alt|example|derive|skip|quiz|ask|explain|resume|backMain|plan…
  content TEXT NOT NULL,                     -- 显示用文本（assistant 为带标记的原文）；card 为 JSON（quiz/proposal/resume/done/divider/stepHeader）
  parts_json TEXT,                           -- 协议无关消息 Part[]（AShareSim 格式），重放请求用
  raw_json TEXT,                             -- 模型原始输出（AShareSim RawOutput），保证缓存字节一致
  allowed_refs_json TEXT,                    -- 本轮允许引用的块 seq（引用校验用）
  unverified INTEGER NOT NULL DEFAULT 0,
  detour_id INTEGER REFERENCES detour(id),
  quote_seq INTEGER,                         -- 用户带着的引用块
  in_context INTEGER NOT NULL DEFAULT 1,     -- 是否计入第 6 层（被摘要替代后为 0）
  usage_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX message_thread ON message(book_id, section_id, id);

CREATE TABLE qa (                            -- 问答（主线和岔路），记在被问的那一节
  id INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL, section_id TEXT NOT NULL,
  q TEXT NOT NULL, a TEXT NOT NULL,
  from_section TEXT,                         -- 岔路：主线小节
  detour_id INTEGER, message_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE stuck (
  id INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL, section_id TEXT NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ai','quiz','card','user','section_end')),
  card_id INTEGER,
  resolved_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE section_note (
  book_id TEXT NOT NULL, section_id TEXT NOT NULL, user_text TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL,
  PRIMARY KEY (book_id, section_id)
);
CREATE TABLE highlight (
  id INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL, block_seq INTEGER NOT NULL,
  start INTEGER, end INTEGER,                -- V1 为 NULL（整块）
  color TEXT NOT NULL DEFAULT 'yellow', note TEXT, created_at TEXT NOT NULL,
  UNIQUE (book_id, block_seq, start, end)
);
CREATE TABLE pin (                           -- 问答便签
  id INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL, block_seq INTEGER NOT NULL, section_id TEXT NOT NULL,
  question TEXT NOT NULL, answer_summary TEXT NOT NULL, message_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE card (
  id INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL, section_id TEXT NOT NULL,
  front TEXT NOT NULL, back TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  due_on TEXT NOT NULL,                      -- 本地日期 YYYY-MM-DD
  origin TEXT NOT NULL CHECK (origin IN ('section_end','detour','manual')),
  created_at TEXT NOT NULL
);
CREATE INDEX card_due ON card(due_on);
CREATE TABLE review_log (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  rated TEXT NOT NULL CHECK (rated IN ('again','hard','good')),
  box_from INTEGER NOT NULL, box_to INTEGER NOT NULL, at TEXT NOT NULL
);
CREATE TABLE ai_usage (
  id INTEGER PRIMARY KEY,
  book_id TEXT, provider_id TEXT NOT NULL, model TEXT NOT NULL,
  purpose TEXT NOT NULL,                     -- teach|tidy|plan|summary|recap|explain|translate|guide
  input INTEGER NOT NULL, cache_read INTEGER NOT NULL, cache_write INTEGER NOT NULL, output INTEGER NOT NULL,
  cache_reported INTEGER NOT NULL, at TEXT NOT NULL
);
CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);   -- 值为 JSON
CREATE TABLE math_cache (
  key TEXT PRIMARY KEY,                      -- sha1(display + tex)
  svg TEXT NOT NULL, width REAL NOT NULL, height REAL NOT NULL, baseline REAL NOT NULL,
  used_at TEXT NOT NULL
);
CREATE TABLE import_draft (                  -- 解析设置页的草稿（选好文件、还没开始解析）
  id TEXT PRIMARY KEY, file_path TEXT NOT NULL, info_json TEXT NOT NULL, created_at TEXT NOT NULL
);
```

### 2.1 setting 的键

| key | 值 | 默认 |
| --- | --- | --- |
| `ui.skin` | `'paper' \| 'glass'` | `'paper'` |
| `ui.scheme` | `'system' \| 'light' \| 'dark'` | `'system'` |
| `ui.readingSize` | `'s' \| 'm' \| 'l'` | `'m'` |
| `prefs.teach` | `{ intuitionFirst, length:'短'\|'中'\|'长', askEachStep, quizAtEnd, bilingual, recap, extra }` | `{true,'中',true,true,true,true,''}` |
| `mineru` | `{ model, confirmUpload, tokenTail, tokenExpiresOn?, usedToday:{date,pages} }` | `{ 'vlm', true }` |
| `ai.providers` | AShareSim 的 `AiProvider[]`（不含 Key，Key 在 Keychain，键名 `ai.key.<providerId>`） | `[]` |
| `ai.assign` | `{ teach: {providerId, model}, tidy: {providerId, model} }` | 无 |
| `ai.installId` | 每台设备固定的 prompt_cache_key | 首次生成 |
| `review.dailyLimit` | number | 30 |
| `export` | `{ format:'md'\|'anki', strip:boolean }` | `{ 'md', true }` |

MinerU Token 在 Keychain，键名 `mineru.token`。

## 3. 仓库接口（`src/data/repos/`）

每个仓库是 `(db: Db) => {...}` 的工厂，只做 SQL ⇄ 领域类型（`core/types.ts`）转换，不含业务规则。必须有的方法（实现者可以加）：

```ts
books:    list(), get(id), bySha(sha), insert(b), update(id, patch), remove(id), touchOpened(id)
parts:    list(bookId), upsert(p), update(bookId, partNo, patch), pending()        // 所有未完成的分片（恢复轮询用）
blocks:   insertMany(bookId, blocks) /* 事务内批量，1000 条一批 */, range(bookId, from, to), byPage(bookId, page),
          bySection(bookId, sectionId), get(bookId, seq), deleteByPages(bookId, from, to), search(bookId, q, limit=8)
sections: tree(bookId), get(bookId, id), replaceAll(bookId, sections) /* 保留 manual */, update(...), leaves(bookId),
          nextLeaf(bookId, id), parts(bookId, id), setParts(...)
plans:    get(bookId, sectionId, part), put(plan), setStepStatus(...)
study:    get(bookId), put(state), patch(bookId, patch)
messages: thread(bookId, sectionId, opts), append(m), update(id, patch), markOutOfContext(ids)
detours:  start(...), end(id, title), get(id)
notes:    qa.add/list, stuck.add/list/resolve, userText.get/set, highlights.toggle/list, pins.add/list
cards:    addMany, due(today, limit), get, rate(id, rated, boxTo, dueOn, at) /* 写 review_log */, stats()
usage:    add(u), byBook(), month(yyyymm)
settings: get<T>(key, fallback), set(key, value)
math:     get(key), put(entry), touch(key), prune(maxRows=5000)
```

## 4. 全文搜索

- 用 FTS5 `trigram` 分词（中文无需分词器）。`search(bookId, q)`：
  - `q` 去空白后长度 ≥ 3：`SELECT … FROM block_fts WHERE block_fts MATCH ? AND book_id = ? ORDER BY rank LIMIT ?`，`MATCH` 参数用双引号包起来做短语查询（转义内部引号）。
  - 长度 1–2（很多中文词只有两个字）：退回 `block.text LIKE '%' || ? || '%'`，限制在该书内，按 seq 排序。
- 返回：块引用、页码、所在小节、命中片段（命中处前 18 字 + 命中 + 后 30 字，和原型 `searchRun` 一致）。
- 测试：`node:sqlite` 若不支持 FTS5/trigram，FTS 相关测试 `describe.skip` 并打印原因，但 LIKE 分支必须测。T4 确认真机 op-sqlite 支持（在 App 启动自检里跑一次 `SELECT * FROM block_fts LIMIT 0`）。

## 5. 备份与恢复

- 导出：`pagewise-backup-YYYY-MM-DD.zip` = `db.sqlite`（`VACUUM INTO` 生成的副本，**先删掉 setting 里任何密钥相关键**——本来就不该有，导出前再校验一次）+ `manifest.json`（版本、schema 版本、书列表）+ `books/<id>/images/` 中被块引用且存在的图片（manifest 可选 `imageFiles`，兼容旧备份）+ 可选的原文件（导出选项，默认不含，太大）。快照里的绝对图片路径转换为书相对路径，活动库不变。
- 恢复：校验 manifest → schema 版本 ≤ 当前 → 关闭数据库 → 替换 → 迁移 → 重启 JS。缺原文件的书标记为需要重新导入原文件（同 SHA-256 才接受）。
- V1 做导出和恢复（M5 打磨），但数据格式在 V1 定下来。

## 6. 数据完整性规则（仓库测试必须覆盖）

1. 同一本书 `block.seq` 唯一、按阅读顺序递增、**一旦写入不再变**（分片先后到达也不重编号，06 §2.5）。这偏离了 STUDY_ENGINE「重新编号」的说法，原因是边解析边学时，重编号会让已有的引用、高亮、便签指错块。
2. 叶子小节的 `[block_from, block_to]` 互不重叠，按 `ord` 首尾相接覆盖全书正文块。
3. `lesson_plan.steps` 覆盖该段全部块、连续、不重叠（core 校验，仓库只存）。
4. 重新解析一本书时：`source='manual'` 的小节保留；学习记录（message、qa、stuck、card、highlight、pin）按 `block_seq` 关联的，用「旧块文本 → 新块」的匹配迁移（06 §5.6），匹配不上的保留并标记失联。
5. 清理解析缓存：删除 block、section_part、lesson_plan、页缓存和 `mineru/`、`images/`；**保留** section（含摘要）、message、qa、stuck、card、highlight、pin、section_note。
