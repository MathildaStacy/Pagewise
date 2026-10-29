/* Pagewise Win11 风原型 · 书架（Tab 2）、书架搜索、导入、解析设置、解析进度、书的更多操作 */
'use strict';
const statusTag = s => s === 'done' ? '<span class="tag ok">已学</span>' : s === 'learning' ? '<span class="tag acc">在学</span>' : '';
const sstIcon = s => '<span class="sst ' + s + '">' + (s === 'done' ? I('check') : '') + '</span>';
const stepsDone = st => st.ss.filter(x => x === 'done' || x === 'skipped').length;
// 封面占位：渐变底 + 书名 + 作者小字（size: 默认 68×94 / lg 84×116 / sm 54×74 / xs 30×42 只有颜色）
const CV = { aima: 'cv1', slm: 'cv3', ddia: 'cv2', imp0: 'cv5', imp1: 'cv4', imp2: 'cv3' };
function cover(b, size) {
  const t = b.title.replace(/[（(].*$/, ''), m = b.title.match(/[（(](.*)[）)]/);
  return '<div class="cover ' + (CV[b.id] || 'cv4') + (size ? ' ' + size : '') + '" aria-hidden="true">' + (size === 'xs' ? '' : esc(t.length > 12 ? t.slice(0, 12) + '…' : t) + '<small>' + esc(m ? m[1] : b.author.split(/[,，]/)[0]) + '</small>') + '</div>';
}

SCREENS.shelf = {
  title: '书架', short: '书架', root: true,
  kicker: () => S.flags.emptyShelf ? '还没有书' : S.books.length + ' 本书' + (S.books.some(b => b.status === 'parsing') ? ' · 1 本在解析' : ''),
  right: () => S.flags.emptyShelf ? '' : '<button class="ib" aria-label="搜索书架" onclick="openShelfSearch()">' + I('search') + '</button><button class="ib" aria-label="' + (S.shelfView === 'grid' ? '列表视图' : '网格视图') + '" onclick="' + on(() => { S.shelfView = S.shelfView === 'grid' ? 'list' : 'grid'; refresh(); }) + '">' + I(S.shelfView === 'grid' ? 'list' : 'grid') + '</button>',
  render() {
    if (S.flags.emptyShelf) return '<section class="card" style="margin:8px 16px">' + empty('folder', '导入第一本书', '支持 PDF 和 EPUB。也可以在其他 App 里把文件「分享到 Pagewise」。同一本书按文件内容识别，不会重复解析。', '<button class="btn pri" onclick="openImport()">' + I('add') + '导入</button>') + '</section>';
    const F = S.shelfFilter;
    const kind = b => b.id === 'aima' ? 'learning' : b.status === 'parsing' ? 'parsing' : 'new';
    const list = S.books.filter(b => F === 'all' || kind(b) === F);
    let h = '<div class="chips filt">' + [['all', '全部'], ['learning', '在学'], ['parsing', '解析中'], ['new', '未开始']].map(([k, l]) => '<button class="chip' + (F === k ? ' on' : '') + '" onclick="' + on(() => { S.shelfFilter = k; refresh(); }) + '">' + l + ' <span class="n">' + S.books.filter(b => k === 'all' || kind(b) === k).length + '</span></button>').join('') + '</div>';
    if (!list.length) return h + '<div class="empty">这个分类下没有书</div>';
    if (S.shelfView === 'grid') {
      return h + '<div class="bgrid">' + list.map(b => '<button class="bg" onclick="' + on(() => openBook(b.id)) + '">' + cover(b, 'lg') + '<b>' + esc(b.title) + '</b><span class="st">' + bookStatus(b, true) + '</span></button>').join('') + '</div>';
    }
    return h + '<div class="card list blist">' + list.map(b =>
      '<button class="book" onclick="' + on(() => openBook(b.id)) + '">' + cover(b, 'sm') + '<span class="grow"><b class="tt">' + esc(b.title) + '</b><span class="meta">' + esc(b.author) + ' · ' + b.fmt + (b.pages ? ' · ' + b.pages + ' 页' : ' · ' + b.chapters.length + ' 章') + '</span><span class="st">' + bookStatus(b) + '</span>' +
      (b.id === 'aima' ? '<span class="bar"><i style="width:' + bookPct(b) + '%"></i></span>' : b.status === 'parsing' ? '<span class="bar ' + (b.parts.some(x => x.err) ? 'bad' : 'ai') + '"><i style="width:' + parsePct(b) + '%"></i></span>' : '') + '</span>' + chev() + '</button>').join('') + '</div>';
  },
  fab: () => S.flags.emptyShelf ? '' : '<button class="fab" onclick="openImport()">' + I('add') + '导入</button>'
};
const parsePct = b => Math.round(b.parts.reduce((a, x) => a + Math.min(x.stage, STAGES.length) * 20 + (x.stage < STAGES.length ? (x.pct || 0) / 5 : 0), 0) / b.parts.length);
function bookStatus(b, short) {
  const st = S.study;
  if (b.id === 'aima') return '<span class="dot" style="color:var(--accent)"></span><span>在学 ' + esc(st.sec) + (short ? '' : ' · 已学 ' + doneCount() + '/' + leafSecs().length + ' 个小节') + '</span>';
  if (b.status === 'parsing') {
    const err = b.parts.find(x => x.err);
    const p = b.parts.find(x => x.stage < STAGES.length) || b.parts[b.parts.length - 1];
    return err ? '<span class="dot" style="color:var(--bad)"></span><span style="color:var(--bad-ink)">解析暂停' + (short ? '' : '：Token 已过期') + '</span>'
      : '<span class="dot" style="color:var(--stuck)"></span><span>解析中 · ' + (short ? '' : STAGES[Math.min(p.stage, 4)] + ' · ') + '<span class="n">' + parsePct(b) + '%</span>' + (b.readyTo && !short ? ' · p.1–' + b.readyTo + ' 可学' : '') + '</span>';
  }
  return '<span class="dot" style="color:var(--ink3)"></span><span>' + (b.fmt === 'EPUB' && !short ? 'EPUB · 本地解析 · ' : '') + '已就绪 · 未开始</span>';
}
function openBook(id) {
  const b = bookOf(id);
  if (b.status === 'parsing') return go('parse', { book: id });
  go('map', { book: id });
}
// 听讲的「←」回到书的地图（03 §5）：从今天 / 书架进来时把地图垫在下面
function openStudy(mode) {
  if (cur().name === 'study') return;
  if (mode) S.study.mode = mode;
  if (cur().name !== 'map') { closeOverlay(true); R.stack.push({ name: 'map', p: { book: 'aima' } }); }
  go('study');
}
function openShelfSearch() {
  const run = q => {
    const k = q.trim().toLowerCase(), box = $('#shres'); if (!box) return;
    const hits = S.books.filter(b => !k || (b.title + b.author).toLowerCase().includes(k));
    box.innerHTML = hits.length ? '<div class="card list">' + hits.map(b => '<button class="row tap" onclick="' + on(() => { closeOverlay(true); openBook(b.id); }) + '">' + cover(b, 'xs') + '<span class="grow"><b>' + esc(b.title) + '</b><small>' + esc(b.author) + '</small></span></button>').join('') + '</div>' : '<div class="empty">书架上没有「' + esc(q) + '」</div>';
  };
  sheet({ title: '搜索书架', sub: '按书名、作者在本机过滤', body: '<label class="srch">' + I('search') + '<input id="shq" placeholder="书名、作者" oninput="' + on(e => run(e.target.value)) + '"></label><div id="shres"></div>' +
    '<button class="row tap link" style="margin-top:6px" onclick="' + on(() => { closeOverlay(true); go('ask'); }) + '">' + I('spark') + '想搜书里的内容？去「问书架」</button>' });
  run(''); setTimeout(() => $('#shq') && $('#shq').focus(), 300);
}

// ---------- 导入 ----------
function openImport() {
  sheet({ title: '导入一本书', sub: '最近下载的 PDF 和 EPUB', body: '<div class="card list">' +
    IMPORTABLE.map((f, i) => '<button class="row tap" onclick="' + on(() => go('importSet', { i })) + '">' + T3(f.fmt === 'EPUB' ? 'epub' : 'pdf', 'sm') + '<span class="grow"><b>' + esc(f.name) + '</b><small>' + f.size + (f.pages ? ' · ' + f.pages + ' 页' : '') + ' · 下载</small></span>' + chev() + '</button>').join('') +
    '<button class="row tap link" onclick="' + on(() => showToast('打开系统文件选择器（原型未实现）')) + '">' + I('open') + '从其他位置选择…</button></div>' +
    '<div style="margin-top:12px">' + noteHtml('', '支持 PDF 和 EPUB。也可以在其他 App 里把文件「分享到 Pagewise」。同一本书按文件内容识别，不会重复解析。', 'info') + '</div>' });
}

SCREENS.importSet = {
  title: '解析设置', short: '解析设置',
  render(p) {
    const f = IMPORTABLE[p.i];
    if (!p.o) p.o = { model: S.mineru.model, ocr: !f.text, from: 1 };
    const o = p.o;
    const fake = { id: 'imp' + p.i, title: f.title, author: f.author };
    let h = '<div class="fhead">' + cover(fake, 'lg') + '<div><span class="tag ' + (f.fmt === 'EPUB' ? 'ok' : 'bad') + '">' + f.fmt + '</span><b>' + esc(f.title) + '</b><small>' + esc(f.author) + '<br>' + esc(f.name) + '</small></div></div>' +
      '<div class="facts">' + [[f.pages ? '页数' : '章节', '<span class="n">' + (f.pages || f.chapters.length) + '</span>'], ['大小', '<span class="n">' + f.size + '</span>']].concat(f.fmt === 'PDF'
        ? [['文字层', f.text ? '<span class="ok">有</span>' : '<span class="no">没有 · 扫描版</span>'], ['书签目录', f.outline ? '<span class="ok">有 · 用来核对地图</span>' : '<span class="no">没有</span>']]
        : [['目录', '<span class="ok">有</span>'], ['解析位置', '本机']]).map(([k, v]) => '<div class="card">' + k + '<b>' + v + '</b></div>').join('') + '</div>';
    if (f.fmt === 'EPUB') {
      return h + '<div class="pad" style="margin-bottom:20px">' + noteHtml('acc', 'EPUB 本身是结构化的，直接在本机解析目录和章节，不上传、不占 MinerU 额度。', 'info') + '</div>' +
        '<div class="pad"><button class="btn pri block" onclick="' + on(() => doImport(p.i, o)) + '">导入</button></div>';
    }
    const parts = [];
    for (let a = 1; a <= f.pages; a += MINERU_MAX_PAGES) parts.push([a, Math.min(f.pages, a + MINERU_MAX_PAGES - 1)]);
    const after = S.mineru.used + f.pages, over = after > MINERU_DAILY_PRIORITY_PAGES;
    h += grp('解析方式 · MinerU 精准解析 API',
      '<div class="fld">' + segHtml([['vlm', 'vlm（推荐）'], ['pipeline', 'pipeline']], o.model, k => { o.model = k; refresh(); }) + '<div class="muted" style="font-size:12px;margin-top:8px">' + (o.model === 'vlm' ? '公式、表格、复杂排版效果更好，速度稍慢。' : '速度更快；公式密集的书效果会差一些。') + '</div></div>' +
      row({ t: 'OCR 文字识别', d: f.text ? '书有文字层，一般不需要' : '扫描版，已自动打开', right: swHtml(o.ocr, () => { o.ocr = !o.ocr; refresh(); }, 'OCR 文字识别') }) +
      row({ t: '从第几页开始解析', d: '先解析你要读的部分，就绪的章节马上能学', right: '<input class="box n" style="width:64px" inputmode="numeric" aria-label="起始页" value="' + o.from + '" oninput="' + on(e => { o.from = +e.target.value || 1; }) + '">' }) +
      row({ t: '分片', d: parts.length > 1 ? '单个文件最多 ' + MINERU_MAX_PAGES + ' 页，拆成 ' + parts.length + ' 片，合并后保持原书页码：' + parts.map(x => 'p.' + x[0] + '–' + x[1]).join('、') : MINERU_MAX_PAGES + ' 页以内，一次上传' }) +
      row({ t: '今日额度', d: over ? '超出最高优先级额度的部分会排队变慢，不会被拦截' : '每天 ' + MINERU_DAILY_PRIORITY_PAGES + ' 页最高优先级', val: '<span class="n" style="' + (over ? 'color:var(--stuck-ink);font-weight:600' : '') + '">' + S.mineru.used + ' → ' + after + ' / ' + MINERU_DAILY_PRIORITY_PAGES + '</span>' }),
      '整本书会上传到 MinerU 服务器解析；解析结果（Markdown、内容块、图片）下载后保存在本机，之后阅读和讲解都不用再联网解析。');
    if (S.flags.noToken) return h + '<div class="pad">' + noteHtml('warn', '还没有配置 MinerU Token，PDF 需要先交给 MinerU 解析。', 'warn') + '<button class="btn pri block" style="margin-top:12px" onclick="go(\'meMineru\')">先配置 MinerU Token</button></div>';
    return h + '<div class="pad"><button class="btn pri block" onclick="' + on(() => confirmUpload(p.i, o, parts)) + '">开始解析</button></div>';
  }
};
function confirmUpload(i, o, parts) {
  const f = IMPORTABLE[i];
  if (!S.mineru.confirm) return doImport(i, o, parts);
  modal({ title: '上传到 MinerU？', body: '《' + esc(f.title) + '》（' + f.size + '，' + f.pages + ' 页）会上传到 MinerU 官方服务器解析，使用你在「我的 → 解析服务」里配置的 Token。', ok: '上传并解析', onOk: () => { setTimeout(() => doImport(i, o, parts), 320); } });
}
function doImport(i, o, parts) {
  const f = IMPORTABLE[i];
  if (S.books.some(b => b.src === i)) { showToast('这本书已经在书架上了'); return tab('shelf'); }
  const b = { id: 'imp' + i, src: i, title: f.title, author: f.author, fmt: f.fmt, pages: f.pages, size: f.size, color: f.color, chapters: f.chapters, model: o.model, ocr: o.ocr };
  S.books.push(b); S.flags.emptyShelf = false;
  if (f.fmt === 'EPUB') { b.status = 'ready'; showToast('已导入，地图已建好', 'ok'); R.stack = [{ name: 'shelf', p: {} }]; return go('map', { book: b.id }); }
  b.parts = parts.map(([from, to], k) => ({ from, to, stage: 0, pct: 0, speed: k ? 0.5 : 1 }));
  startParse(b);
  R.stack = [{ name: 'shelf', p: {} }];
  go('parse', { book: b.id });
}

SCREENS.parse = {
  title: '解析进度', sub: p => bookOf(p.book).title.replace(/（.*$/, ''), short: '解析进度',
  right: p => '<button class="ib" aria-label="更多" onclick="' + on(() => bookMenu(p.book)) + '">' + I('more') + '</button>',
  render(p) {
    const b = bookOf(p.book), done = b.status === 'ready';
    let h = '<div class="fhead">' + cover(b, 'lg') + '<div><b>' + esc(b.title) + '</b><small>' + b.pages + ' 页 · MinerU · ' + b.model + (b.ocr ? ' · OCR' : '') + '</small>' +
      '<div class="ptotal"><span class="n">' + (done ? 100 : parsePct(b)) + '%</span><div class="bar ' + (b.parts.some(x => x.err) ? 'bad' : done ? 'ok' : 'ai') + '"><i style="width:' + (done ? 100 : parsePct(b)) + '%"></i></div></div></div></div>';
    h += '<section class="grp"><div class="grp-h">分片 <span>' + b.parts.length + ' 片 · 每片最多 ' + MINERU_MAX_PAGES + ' 页</span></div>';
    b.parts.forEach((x, k) => {
      const ok = x.stage >= STAGES.length;
      h += '<div class="card part"><div class="l1"><span>第 ' + (k + 1) + ' 片 · <span class="n">p.' + x.from + '–' + x.to + '</span></span><span class="n ps ' + (x.err ? 'bad' : ok ? 'ok' : '') + '">' + (x.err ? '已暂停' : ok ? '完成' : STAGES[x.stage] + ' ' + Math.round(x.pct || 0) + '%') + '</span></div>' +
        '<div class="stg">' + STAGES.map((s, j) => '<span class="' + (j < x.stage ? 'done' : j === x.stage ? (x.err ? 'err' : 'cur') : '') + '"><i>' + (j < x.stage ? I('check') : j === x.stage && x.err ? '!' : j + 1) + '</i>' + s + '</span>').join('') + '</div>' +
        (x.stage < STAGES.length && !x.err ? '<div class="bar ai" style="margin-top:10px"><i style="width:' + (x.pct || 0) + '%"></i></div>' : '') +
        (x.err ? '<div style="margin-top:12px">' + noteHtml('bad', esc(x.err), 'warn') + '</div><div class="btns" style="margin-top:10px"><button class="btn sm pri" onclick="go(\'meMineru\')">去更新 Token</button><button class="btn sm" onclick="' + on(() => { if (S.sim.tokenExpired) return showToast('Token 仍然无效，请先更新', 'bad'); x.err = null; startParse(b); refresh(); }) + '">' + I('retry') + '重试这一片</button>' +
          '<button class="btn sm" onclick="' + on(() => { x.err = null; b.ocr = true; x.stage = 0; x.pct = 0; S.sim.tokenExpired = false; startParse(b); refresh(); showToast('这一片会打开 OCR 重新解析'); }) + '">用 OCR 重新解析</button><button class="btn sm text" onclick="' + on(() => showToast('明天额度刷新后自动继续')) + '">明天再试</button></div>' : '') + '</div>';
    });
    h += '</section>';
    if (b.readyTo || done) h += '<div class="pad">' + noteHtml('acc', done ? '全书已解析完成，书的地图已和书签核对。' : 'p.1–' + b.readyTo + ' 已就绪，这部分的章节现在就能学。', 'check') + '<button class="btn pri block" style="margin-top:14px" onclick="' + on(() => replace('map', { book: b.id })) + '">查看书的地图</button></div>';
    else h += '<div class="pad">' + noteHtml('', '解析在后台进行，可以离开这个页面。每片完成后，那部分的章节就能开始学。', 'clock') + '</div>';
    return h;
  }
};

// ---------- 书的更多操作（书的地图 / 解析进度顶栏右侧 ⋯） ----------
function bookMenu(id) {
  const b = bookOf(id);
  sheet({ title: esc(b.title), sub: esc(b.author) + ' · ' + b.fmt + (b.pages ? ' · ' + b.pages + ' 页' : ''), body: '<div class="card list">' +
    row({ t: '书的信息', d: '文件、大小、解析方式、导入时间', i3: 'info', fn: () => bookInfo(id) }) +
    (b.fmt === 'PDF' && b.status !== 'parsing' ? row({ t: '重新解析', d: '换解析模型或打开 OCR；学习记录保留', i3: 'gear', fn: () => modal({ title: '重新解析这本书？', body: '会重新上传到 MinerU，消耗约 ' + b.pages + ' 页额度。书的地图会重新核对，<b>学习记录、笔记和闪卡都保留</b>。', ok: '重新解析', onOk: () => setTimeout(() => showToast('原型里不演示重新解析'), 300) }) }) : '') +
    (id === 'aima' ? row({ t: '导出笔记', d: 'Markdown / Anki CSV', i3: 'export', fn: () => { closeOverlay(true); go('notesBook', { book: id }); setTimeout(openExport, 120); } }) : '') +
    row({ t: '从书架移除', d: '删除原文件和解析结果', i3: 'trash', cls: 'danger', fn: () => modal({ title: '移除《' + esc(b.title.replace(/（.*$/, '')) + '》？', body: '会删除原文件、解析结果、学习记录、笔记和闪卡。<b>删除前可以先导出笔记。</b>这一步不能撤销。', ok: '移除', danger: true, onOk: () => setTimeout(() => showToast('原型里不真的删除'), 300) }) }) + '</div>' });
}
function bookInfo(id) {
  const b = bookOf(id);
  sheet({ title: '书的信息', sub: esc(b.title), body: '<div class="kv">' + [['作者', esc(b.author)], ['格式', b.fmt], ['页数', b.pages ? b.pages + ' 页' : (b.chapters.length || b.chapters) + ' 章'], ['原文件', b.size], ['解析', b.fmt === 'EPUB' ? '本机' : 'MinerU · ' + (b.model || 'vlm')], ['导入时间', '2026-10-12 21:14'], ['文件指纹', '<span class="n">sha256 · 9f3c…a41e</span>']].map(([k, v]) => '<span>' + k + '</span><span>' + v + '</span>').join('') + '</div>', acts: [['好的', closeOverlay, 'pri']] });
}
