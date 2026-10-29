/* Pagewise 新谷歌风原型 · 书架、导入、解析设置、解析进度 */
'use strict';
const statusTag = s => s === 'done' ? '<span class="tag ok">已学</span>' : s === 'learning' ? '<span class="tag acc">在学</span>' : '';
const sstIcon = s => '<span class="sst ' + s + '">' + (s === 'done' ? I('check') : '') + '</span>';
function cover(b, lg) { return '<div class="cover' + (lg ? ' lg' : '') + '" style="background-color:' + b.color + '"><span>' + esc(b.title.replace(/[（(].*$/, '').slice(0, 12)) + '</span></div>'; }
const stepsDone = st => st.ss.filter(x => x === 'done' || x === 'skipped').length;

SCREENS.shelf = {
  title: 'Pagewise', short: '书架', root: true,
  right: () => '<button class="nb" aria-label="搜索书架" onclick="openShelfSearch()">' + I('search') + '</button>',
  render() {
    const st = S.study, inSec = st.sec === '3.5.2';
    const stuck = S.stuck.find(s => !s.ok && s.sec === '3.4.2');
    const k = stepsDone(st);
    let h = '<button class="cont" onclick="openStudy()" aria-label="继续学习 ' + esc(secName(st.sec)) + '">' +
      '<div class="k">继续学习 · 人工智能：现代方法（第4版）</div><div class="t">' + esc(secName(st.sec)) + '</div>' +
      '<div class="b">第 3 章 通过搜索进行问题求解 · ' + pagesOf(st.sec) + '</div>' +
      (S.daysAway && stuck && inSec ? '<div class="s">上次 ' + S.daysAway + ' 天前，讲完了第 1 步。卡点：' + esc(stuck.x) + '</div>' : '') +
      '<div class="go"><div class="pts">' + (k || st.phase !== 'teach' || inSec ? st.ss.map(x => '<i class="' + (x === 'done' || x === 'skipped' ? 'on' : '') + '"></i>').join('') + '<span>第 ' + Math.min(k + 1, st.n) + '/' + st.n + ' 步</span>' : '<span>新的一节</span>') + '</div><span class="gob">继续' + I('chev') + '</span></div></button>';
    h += '<section class="grp"><div class="grp-h big">我的书 <small>' + S.books.length + ' 本</small></div><div class="list">';
    S.books.forEach(b => {
      h += '<button class="book" onclick="' + on(() => openBook(b.id)) + '">' + cover(b) + '<span class="grow"><div class="tt">' + esc(b.title) + '</div><div class="meta">' + esc(b.author) + ' · ' + b.fmt + (b.pages ? ' · ' + b.pages + ' 页' : ' · ' + b.chapters.length + ' 章') + '</div><div class="st">' + bookStatus(b) + '</div></span>' + chev() + '</button>';
    });
    return h + '</div></section>';
  },
  fab: () => '<button class="fab" onclick="openImport()">' + I('add') + '导入</button>'
};
function bookStatus(b) {
  const st = S.study;
  if (b.id === 'aima') return '<span class="dot" style="color:var(--tint)"></span><span>在学 ' + esc(st.sec) + ' · 已学 ' + doneCount() + '/' + leafSecs().length + ' 个小节</span>';
  if (b.status === 'parsing') {
    const err = b.parts.find(x => x.err);
    const p = b.parts.find(x => x.stage < STAGES.length) || b.parts[b.parts.length - 1];
    const pct = Math.round(b.parts.reduce((a, x) => a + Math.min(x.stage, STAGES.length) * 20 + (x.stage < STAGES.length ? (x.pct || 0) / 5 : 0), 0) / b.parts.length);
    return err ? '<span class="dot" style="color:var(--red)"></span><span style="color:var(--red-ink)">解析暂停：Token 已过期</span>'
      : '<span class="dot" style="color:var(--orange)"></span><span>解析中 · ' + STAGES[Math.min(p.stage, 4)] + ' · <span class="n">' + pct + '%</span>' + (b.readyTo ? ' · p.1–' + b.readyTo + ' 可学' : '') + '</span>';
  }
  return '<span class="dot" style="color:var(--label3)"></span><span>' + (b.fmt === 'EPUB' ? 'EPUB · 本地解析 · ' : '') + '已就绪 · 未开始</span>';
}
function openBook(id) {
  const b = bookOf(id);
  if (b.status === 'parsing') return go('parse', { book: id });
  go('map', { book: id });
}
// 听讲的「‹」回到书的地图（03 §5）：从书架进来时把地图垫在下面
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
    box.innerHTML = hits.length ? '<div class="list">' + hits.map(b => '<button class="book" onclick="' + on(() => { closeOverlay(true); openBook(b.id); }) + '">' + cover(b) + '<span class="grow"><div class="tt">' + esc(b.title) + '</div><div class="meta">' + esc(b.author) + '</div></span></button>').join('') + '</div>' : '<div class="empty">书架上没有「' + esc(q) + '」</div>';
  };
  sheet({ title: '搜索书架', body: '<label class="srch">' + I('search') + '<input id="shq" placeholder="书名、作者" oninput="' + on(e => run(e.target.value)) + '"></label><div id="shres"></div>' });
  run(''); setTimeout(() => $('#shq') && $('#shq').focus(), 300);
}

// ---------- 导入 ----------
function openImport() {
  sheet({ title: '导入一本书', body: '<div class="sub">最近 · 下载</div><div class="list ic" style="--inset:68px">' +
    IMPORTABLE.map((f, i) => '<button class="row tap" onclick="' + on(() => go('importSet', { i })) + '"><span class="fic' + (f.fmt === 'EPUB' ? ' epub' : '') + '">' + f.fmt + '</span><span class="grow"><b style="font-size:15px">' + esc(f.name) + '</b><small>' + f.size + (f.pages ? ' · ' + f.pages + ' 页' : '') + '</small></span></button>').join('') +
    '<button class="row tap link" onclick="' + on(() => showToast('打开系统文件选择器（原型未实现）')) + '">从其他位置选择…</button></div>' +
    '<div class="note" style="margin:12px 0 4px">支持 PDF 和 EPUB。也可以在其他 App 里把文件"分享到 Pagewise"。同一本书按文件内容识别，不会重复解析。</div>' });
}

SCREENS.importSet = {
  title: '解析设置', short: '解析设置',
  render(p) {
    const f = IMPORTABLE[p.i];
    if (!p.o) p.o = { model: S.mineru.model, ocr: !f.text, from: 1 };
    const o = p.o;
    let h = '<div class="fhead">' + cover(f, true) + '<div><b>' + esc(f.title) + '</b><small>' + esc(f.author) + '<br>' + esc(f.name) + '</small></div></div>' +
      '<div class="facts"><div>' + (f.pages ? '页数<b class="n">' + f.pages + '</b>' : '章节<b class="n">' + f.chapters.length + '</b>') + '</div><div>大小<b class="n">' + f.size + '</b></div>' +
      (f.fmt === 'PDF' ? '<div>文字层<b class="' + (f.text ? 'ok' : 'no') + '">' + (f.text ? '有' : '没有 · 扫描版') + '</b></div><div>书签目录<b class="' + (f.outline ? 'ok' : 'no') + '">' + (f.outline ? '有 · 用来核对地图' : '没有') + '</b></div>' : '<div>目录<b class="ok">有</b></div><div>解析位置<b>本机</b></div>') + '</div>';
    if (f.fmt === 'EPUB') {
      return h + '<div class="pad" style="margin-bottom:20px"><div class="note acc">EPUB 本身是结构化的，直接在本机解析目录和章节，不上传、不占 MinerU 额度。</div></div>' +
        '<div class="pad"><button class="btn pri block" onclick="' + on(() => doImport(p.i, o)) + '">导入</button></div>';
    }
    const parts = [];
    for (let a = 1; a <= f.pages; a += MINERU_MAX_PAGES) parts.push([a, Math.min(f.pages, a + MINERU_MAX_PAGES - 1)]);
    const after = S.mineru.used + f.pages, over = after > MINERU_DAILY_PRIORITY_PAGES;
    h += grp('解析方式 · MinerU 精准解析 API',
      '<div class="fld">' + segHtml([['vlm', 'vlm（推荐）'], ['pipeline', 'pipeline']], o.model, k => { o.model = k; refresh(); }) + '<div class="muted" style="font-size:13px;margin-top:8px">' + (o.model === 'vlm' ? '公式、表格、复杂排版效果更好，速度稍慢。' : '速度更快；公式密集的书效果会差一些。') + '</div></div>' +
      row({ t: 'OCR 文字识别', d: f.text ? '书有文字层，一般不需要' : '扫描版，已自动打开', right: swHtml(o.ocr, () => { o.ocr = !o.ocr; refresh(); }, 'OCR 文字识别') }) +
      row({ t: '从第几页开始解析', d: '先解析你要读的部分，就绪的章节马上能学', right: '<input class="box n" style="width:68px" inputmode="numeric" aria-label="起始页" value="' + o.from + '" oninput="' + on(e => { o.from = +e.target.value || 1; }) + '">' }) +
      row({ t: '分片', d: parts.length > 1 ? '单个文件最多 ' + MINERU_MAX_PAGES + ' 页，拆成 ' + parts.length + ' 片，合并后保持原书页码：' + parts.map(x => 'p.' + x[0] + '–' + x[1]).join('、') : MINERU_MAX_PAGES + ' 页以内，一次上传' }) +
      row({ t: '今日额度', d: over ? '超出最高优先级额度的部分会排队变慢，不会被拦截' : '每天 ' + MINERU_DAILY_PRIORITY_PAGES + ' 页最高优先级', val: '<span class="n" style="' + (over ? 'color:var(--orange-ink)' : '') + '">' + S.mineru.used + ' → ' + after + ' / ' + MINERU_DAILY_PRIORITY_PAGES + '</span>' }),
      '整本书会上传到 MinerU 服务器解析；解析结果（Markdown、内容块、图片）下载后保存在本机，之后阅读和讲解都不用再联网解析。');
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
  const b = { id: 'imp' + i, src: i, title: f.title, author: f.author, fmt: f.fmt, pages: f.pages, size: f.size, color: f.color, chapters: f.chapters, model: o.model };
  S.books.push(b);
  if (f.fmt === 'EPUB') { b.status = 'ready'; showToast('已导入，地图已建好', 'ok'); R.stack = [{ name: 'shelf', p: {} }]; return go('map', { book: b.id }); }
  b.parts = parts.map(([from, to], k) => ({ from, to, stage: 0, pct: 0, speed: k ? 0.5 : 1 }));
  startParse(b);
  R.stack = [{ name: 'shelf', p: {} }];
  go('parse', { book: b.id });
}

SCREENS.parse = {
  title: '解析进度', short: '解析进度',
  render(p) {
    const b = bookOf(p.book);
    let h = '<div class="fhead">' + cover(b, true) + '<div><b>' + esc(b.title) + '</b><small>' + b.pages + ' 页 · MinerU · ' + b.model + '</small></div></div><section class="grp"><div class="list">';
    b.parts.forEach((x, k) => {
      const done = x.stage >= STAGES.length;
      h += '<div class="part"><div class="l1"><span>第 ' + (k + 1) + ' 片 · <span class="n">p.' + x.from + '–' + x.to + '</span></span><span class="n" style="font-size:13px;font-weight:600;color:' + (x.err ? 'var(--red-ink)' : done ? 'var(--green-ink)' : 'var(--label2)') + '">' + (x.err ? '已暂停' : done ? '完成' : STAGES[x.stage] + ' ' + Math.round(x.pct || 0) + '%') + '</span></div>' +
        '<div class="bar"><i style="width:' + (done ? 100 : x.stage * 20 + (x.pct || 0) / 5) + '%;' + (x.err ? 'background:var(--red)' : done ? 'background:var(--green)' : '') + '"></i></div>' +
        '<div class="stg">' + STAGES.map((s, j) => '<span class="' + (j < x.stage ? 'done' : j === x.stage ? (x.err ? 'err' : 'cur') : '') + '">' + s + '</span>').join('') + '</div>' +
        (x.err ? '<div class="note bad" style="margin-top:10px">' + esc(x.err) + '</div><div class="btns" style="margin-top:10px"><button class="btn sm pri" onclick="go(\'meMineru\')">去更新 Token</button><button class="btn sm" onclick="' + on(() => { if (S.sim.tokenExpired) return showToast('Token 仍然无效，请先更新', 'bad'); x.err = null; startParse(b); refresh(); }) + '">重试这一片</button></div>' : '') + '</div>';
    });
    h += '</div></section>';
    if (b.readyTo || b.status === 'ready') h += '<div class="pad"><div class="note acc">' + (b.status === 'ready' ? '全书已解析完成，书的地图已和书签核对。' : 'p.1–' + b.readyTo + ' 已就绪，这部分的章节现在就能学。') + '</div><button class="btn pri block" style="margin-top:14px" onclick="' + on(() => replace('map', { book: b.id })) + '">查看书的地图</button></div>';
    else h += '<div class="pad"><div class="note">解析在后台进行，可以离开这个页面。每片完成后，那部分的章节就能开始学。</div></div>';
    return h;
  }
};
