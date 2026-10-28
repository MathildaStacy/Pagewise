/* Pagewise 原型 · 书架、导入、解析 */
'use strict';
const statusTag = s => s === 'done' ? '<span class="tag ok">已学</span>' : s === 'learning' ? '<span class="tag acc">在学</span>' : '';
const sstIcon = s => '<span class="sst ' + s + '">' + (s === 'done' ? '✓' : '') + '</span>';
function cover(b) { return '<div class="cover" style="background:' + b.color + '">' + esc(b.title.replace(/[（(].*$/, '').slice(0, 12)) + '</div>'; }

SCREENS.shelf = {
  title: 'Pagewise', root: true,
  navRight: () => '<button class="ib" aria-label="搜索书架" onclick="' + on(() => showToast('按书名、作者搜索（原型未实现）')) + '">⌕</button>',
  render() {
    const st = S.study, part = PARTS['3.5.2'];
    const stuck = S.stuck.find(s => !s.ok && s.sec === '3.4.2');
    const inSec = st.sec === '3.5.2';
    const doneParts = !inSec ? 0 : st.phase === 'resume' ? 1 : st.part + (st.quizRight ? 1 : 0);
    let h = '<div class="cont" onclick="openStudy()">' +
      '<div class="k">继续学习 · 人工智能：现代方法（第4版）</div>' +
      '<div class="t">' + esc(secName(st.sec)) + '</div>' +
      '<div class="b">第 3 章 通过搜索进行问题求解 · ' + pagesOf(st.sec) + '</div>' +
      (S.daysAway && stuck && inSec ? '<div class="s">上次 ' + S.daysAway + ' 天前，讲完了第 1 段。卡点：' + esc(stuck.x) + '</div>' : '') +
      '<div class="go"><div class="pts">' + (inSec ? part.map((_, i) => '<i class="' + (i < doneParts ? 'on' : '') + '"></i>').join('') + '<span style="font-size:12px;margin-left:6px;opacity:.85">第 ' + Math.min(doneParts + 1, part.length) + '/' + part.length + ' 段</span>' : '<span style="font-size:12px;opacity:.85">新的一节</span>') + '</div><span class="btn">继续 ›</span></div></div>';
    h += '<div class="sec"><div class="sec-h">我的书 <small>' + S.books.length + ' 本</small></div>';
    S.books.forEach(b => {
      let stt;
      if (b.id === 'aima') stt = '<span class="dot" style="color:var(--acc)"></span><span>在学 ' + esc(st.sec) + ' · 已学 ' + doneCount() + '/' + leafSecs().length + ' 个小节</span>';
      else if (b.status === 'parsing') {
        const err = b.parts.find(x => x.err);
        const p = b.parts.find(x => x.stage < STAGES.length) || b.parts[b.parts.length - 1];
        const pct = Math.round((b.parts.reduce((a, x) => a + Math.min(x.stage, STAGES.length) * 20 + (x.stage < STAGES.length ? (x.pct || 0) / 5 : 0), 0)) / b.parts.length);
        stt = err ? '<span class="dot" style="color:var(--bad)"></span><span style="color:var(--bad)">解析暂停：Token 已过期</span>'
          : '<span class="dot" style="color:var(--stuck)"></span><span>解析中 · ' + STAGES[Math.min(p.stage, 4)] + ' · <span class="n">' + pct + '%</span>' + (b.readyTo ? ' · p.1–' + b.readyTo + ' 可学' : '') + '</span>';
      } else stt = '<span class="dot" style="color:var(--ink3)"></span><span>' + (b.fmt === 'EPUB' ? 'EPUB · 本地解析 · ' : '') + '已就绪 · 未开始</span>';
      h += '<div class="book" onclick="' + on(() => openBook(b.id)) + '">' + cover(b) + '<div class="grow"><div class="tt">' + esc(b.title) + '</div><div class="meta">' + esc(b.author) + ' · ' + b.fmt + (b.pages ? ' · ' + b.pages + ' 页' : ' · ' + b.chapters.length + ' 章') + '</div><div class="st">' + stt + '</div></div></div>';
    });
    h += '</div><div style="height:70px"></div>';
    return h;
  },
  after() { $('#app').insertAdjacentHTML('beforeend', '<button class="fabi" onclick="openImport()">＋ 导入</button>'); }
};
function openBook(id) {
  const b = bookOf(id);
  if (id === 'aima') return go('map', { book: id });
  if (b.status === 'parsing') return go('parse', { book: id });
  go('map', { book: id });
}

// ---------- 导入 ----------
function openImport() {
  sheet('导入一本书', '<div class="sec-h" style="padding-top:2px"><small>最近 · 下载</small></div>' +
    IMPORTABLE.map((f, i) => '<div class="row tap" onclick="' + on(() => go('importSet', { i })) + '"><div class="finfo" style="padding:0;background:none"><div class="ic' + (f.fmt === 'EPUB' ? ' epub' : '') + '">' + f.fmt + '</div></div><div class="grow"><b>' + esc(f.name) + '</b><small>' + f.size + (f.pages ? ' · ' + f.pages + ' 页' : '') + '</small></div></div>').join('') +
    '<div class="row tap" onclick="' + on(() => showToast('打开系统文件选择器（原型未实现）')) + '"><div class="grow" style="text-align:center;color:var(--acc)">从其他位置选择…</div></div>' +
    '<div class="sb"><div class="note">支持 PDF 和 EPUB。也可以在其他 App 里把文件"分享到 Pagewise"。同一本书按文件内容识别，不会重复解析。</div></div>');
}

SCREENS.importSet = {
  title: '解析设置',
  render(p) {
    const f = IMPORTABLE[p.i];
    if (!p.o) p.o = { model: 'vlm', ocr: !f.text, from: 1 };
    const o = p.o;
    let h = '<div class="sec"><div class="finfo"><div class="ic' + (f.fmt === 'EPUB' ? ' epub' : '') + '">' + f.fmt + '</div><div class="grow"><b style="font-weight:600">' + esc(f.title) + '</b><div class="muted" style="font-size:12px">' + esc(f.author) + ' · ' + esc(f.name) + '</div></div></div>' +
      '<div class="chips2"><div>' + (f.pages ? '页数<b class="n">' + f.pages + '</b>' : '章节<b class="n">' + f.chapters.length + '</b>') + '</div><div>大小<b class="n">' + f.size + '</b></div>' +
      (f.fmt === 'PDF' ? '<div>文字层<b class="' + (f.text ? 'ok' : 'no') + '">' + (f.text ? '有' : '没有 · 扫描版') + '</b></div><div>书签目录<b class="' + (f.outline ? 'ok' : 'no') + '">' + (f.outline ? '有 · 用来核对地图' : '没有') + '</b></div>' : '<div>目录<b class="ok">有</b></div><div>解析位置<b>本机</b></div>') + '</div></div>';
    if (f.fmt === 'EPUB') {
      return h + '<div class="sec"><div style="padding:14px"><div class="note acc">EPUB 本身是结构化的，直接在本机解析目录和章节，不上传、不占 MinerU 额度。</div></div></div>' +
        '<div style="padding:4px 14px 20px"><button class="btn pri block" onclick="' + on(() => doImport(p.i, o)) + '">导入</button></div>';
    }
    const parts = [];
    for (let a = 1; a <= f.pages; a += 600) parts.push([a, Math.min(f.pages, a + 599)]);
    const after = S.mineru.used + f.pages;
    h += '<div class="sec"><div class="sec-h">解析方式 <small>MinerU 精准解析 API</small></div>' +
      '<div style="padding:4px 14px 6px"><div class="seg">' + [['vlm', 'vlm（推荐）'], ['pipeline', 'pipeline']].map(([k, l]) => '<button class="' + (o.model === k ? 'on' : '') + '" onclick="' + on(() => { o.model = k; refresh(); }) + '">' + l + '</button>').join('') + '</div>' +
      '<div class="muted" style="font-size:12px;margin-top:6px;line-height:1.6">' + (o.model === 'vlm' ? '公式、表格、复杂排版效果更好，速度稍慢。' : '速度更快；公式密集的书效果会差一些。') + '</div></div>' +
      '<div class="row"><div class="grow">OCR 文字识别<small>' + (f.text ? '书有文字层，一般不需要' : '扫描版，已自动打开') + '</small></div><span class="sw' + (o.ocr ? ' on' : '') + '" role="switch" onclick="' + on(() => { o.ocr = !o.ocr; refresh(); }) + '"></span></div>' +
      '<div class="row"><div class="grow">从第几页开始解析<small>先解析你要读的部分，就绪的章节马上能学</small></div><input class="n" style="width:64px;border:1px solid #DFDDD8;border-radius:6px;height:32px;text-align:center" value="' + o.from + '" oninput="' + on(e => { o.from = +e.target.value || 1; }) + '"></div>' +
      '<div class="row"><div class="grow">分片<small>' + (parts.length > 1 ? '单个文件最多 600 页，拆成 ' + parts.length + ' 片，合并后保持原书页码' : '600 页以内，一次上传') + '</small></div><span class="n ink2" style="font-size:13px">' + parts.map(x => 'p.' + x[0] + '–' + x[1]).join('、') + '</span></div>' +
      '<div class="row"><div class="grow">今日额度<small>' + (after > 2000 ? '超出高优先级额度的部分会排队变慢，不会被拦截' : '每天 2000 页高优先级') + '</small></div><span class="n" style="font-size:13px;color:' + (after > 2000 ? 'var(--stuck)' : 'var(--ink2)') + '">' + S.mineru.used + ' → ' + after + ' / 2000</span></div></div>' +
      '<div style="padding:4px 14px 6px"><div class="note">整本书会上传到 MinerU 服务器解析；解析结果（Markdown、内容块、图片）下载后保存在本机，之后阅读和讲解都不用再联网解析。</div></div>' +
      '<div style="padding:10px 14px 20px"><button class="btn pri block" onclick="' + on(() => confirmUpload(p.i, o, parts)) + '">开始解析</button></div>';
    return h;
  }
};
function confirmUpload(i, o, parts) {
  const f = IMPORTABLE[i];
  if (!S.mineru.confirm) return doImport(i, o, parts);
  modal({ title: '上传到 MinerU？', body: '《' + esc(f.title) + '》（' + f.size + '，' + f.pages + ' 页）会上传到 MinerU 官方服务器解析，使用你在「我的 → 解析服务」里配置的 Token。', ok: '上传并解析', onOk: () => { setTimeout(() => doImport(i, o, parts), 0); } });
}
function doImport(i, o, parts) {
  const f = IMPORTABLE[i];
  if (S.books.some(b => b.src === i)) { showToast('这本书已经在书架上了'); return tab('shelf'); }
  const b = { id: 'imp' + i, src: i, title: f.title, author: f.author, fmt: f.fmt, pages: f.pages, size: f.size, color: f.color, chapters: f.chapters, model: o.model };
  S.books.push(b);
  if (f.fmt === 'EPUB') { b.status = 'ready'; showToast('已导入，地图已建好', 'ok'); R.stack = [{ name: 'shelf', p: {} }]; return go('map', { book: b.id }); }
  b.parts = parts.map(([from, to]) => ({ from, to, stage: 0, pct: 0 }));
  startParse(b);
  R.stack = [{ name: 'shelf', p: {} }];
  go('parse', { book: b.id });
}

SCREENS.parse = {
  title: '解析进度',
  render(p) {
    const b = bookOf(p.book);
    let h = '<div class="sec"><div class="book" style="cursor:default">' + cover(b) + '<div class="grow"><div class="tt">' + esc(b.title) + '</div><div class="meta">' + b.pages + ' 页 · MinerU · ' + b.model + '</div></div></div></div><div class="sec">';
    b.parts.forEach((x, k) => {
      const done = x.stage >= STAGES.length;
      h += '<div class="part"><div class="l1"><b style="font-weight:500">第 ' + (k + 1) + ' 片 · p.' + x.from + '–' + x.to + '</b><span class="n" style="font-size:12px;color:' + (x.err ? 'var(--bad)' : done ? 'var(--ok)' : 'var(--ink2)') + '">' + (x.err ? '已暂停' : done ? '完成' : STAGES[x.stage] + ' ' + Math.round(x.pct || 0) + '%') + '</span></div>' +
        '<div class="bar"><i style="width:' + (done ? 100 : x.stage * 20 + (x.pct || 0) / 5) + '%;' + (x.err ? 'background:var(--bad)' : done ? 'background:var(--ok)' : '') + '"></i></div>' +
        '<div class="stg">' + STAGES.map((s, j) => '<span class="' + (j < x.stage ? 'done' : j === x.stage ? (x.err ? 'err' : 'cur') : '') + '">' + s + '</span>').join('') + '</div>' +
        (x.err ? '<div class="note bad" style="margin-top:8px">' + esc(x.err) + '</div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm pri" onclick="go(&quot;meMineru&quot;)">去更新 Token</button><button class="btn sm ghost" onclick="' + on(() => { if (S.sim.tokenExpired) return showToast('Token 仍然无效，请先更新'); x.err = null; startParse(b); refresh(); }) + '">重试这一片</button></div>' : '') + '</div>';
    });
    h += '</div>';
    if (b.readyTo || b.status === 'ready') h += '<div style="padding:4px 14px"><div class="note acc">' + (b.status === 'ready' ? '全书已解析完成，书的地图已和书签核对。' : 'p.1–' + b.readyTo + ' 已就绪，这部分的章节现在就能学。') + '</div><button class="btn pri block" style="margin-top:10px" onclick="' + on(() => replace('map', { book: b.id })) + '">查看书的地图</button></div>';
    else h += '<div style="padding:4px 14px"><div class="note">解析在后台进行，可以离开这个页面。每片完成后，那部分的章节就能开始学。</div></div>';
    return h;
  }
};
