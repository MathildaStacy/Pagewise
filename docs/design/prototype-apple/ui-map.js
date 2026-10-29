/* Pagewise 苹果风原型 · 书的地图、小节详情、全书搜索 */
'use strict';
const mapOpen = { ch3: true, '3.5': true, '3.4': false };
let mapDrop = null;   // 刚展开的章 / 节：播一次弹性展开动画

SCREENS.map = {
  title: p => bookOf(p.book).title.replace(/（.*$/, ''), sub: '书的地图', short: '地图',
  right: p => '<button class="nb" aria-label="全书搜索" onclick="' + on(() => openSearch(p.book)) + '">' + I('search') + '</button>',
  render(p) {
    const b = bookOf(p.book);
    if (p.book !== 'aima') return genericMap(b);
    const flags = S.secOrder.filter(id => S.sec[id].flag);
    let h = '<div class="mapchk"><span class="sst done">' + I('check') + '</span><div class="grow">已和 PDF 书签核对：28 章 + 2 个附录一致' + (flags.length ? '<small class="warn">' + flags.length + ' 处需要你确认 · ' + flags.join('、') + '</small>' : '<small>没有需要确认的地方</small>') + '</div></div>';
    S.secOrder.filter(id => S.sec[id].level === 1).forEach(cid => {
      const c = S.sec[cid], open = !!mapOpen[cid], kids = c.kids;
      const isCur = cid === chapterOf(S.study.sec).id;
      h += '<div class="chap' + (c.status === 'done' ? ' done' : '') + (isCur ? ' cur' : '') + (open ? ' open' : '') + '"><button class="h" aria-expanded="' + open + '" onclick="' + on(() => { if (!kids.length) return showToast('原型只展开了第 1–3 章'); mapOpen[cid] = !open; mapDrop = open ? null : cid; refresh(); }) + '"><span class="no">' + c.no + '</span><span class="grow"><b>' + esc(c.title) + '</b><small>p.' + c.p0 + '–' + c.p1 + (kids.length ? ' · ' + kids.length + ' 节' : '') + (c.status === 'done' ? ' · 已学完' : isCur ? ' · 在学 ' + S.study.sec : '') + '</small></span>' + I('chev').replace('class="i"', 'class="i arr"') + '</button>';
      if (open) {
        h += '<div class="kids' + (mapDrop === cid ? ' drop' : '') + '">';
        kids.forEach(sid => {
          const s = S.sec[sid];
          if (!s.kids) { h += secRow(s); return; }
          const so = mapOpen[sid] !== false;
          h += '<button class="sct" aria-expanded="' + so + '" onclick="' + on(() => { mapOpen[sid] = !so; mapDrop = so ? null : sid; refresh(); }) + '">' + sstIcon(s.status) + '<span class="grow">' + sid + ' ' + esc(s.title) + '</span><span class="pg n">' + s.kids.filter(k => S.sec[k].status === 'done').length + '/' + s.kids.length + I('chev').replace('class="i"', 'class="i' + (so ? ' o' : '') + '"') + '</span></button>';
          if (so) h += '<div class="' + (mapDrop === sid ? 'kids drop' : '') + '" style="border:0;padding:0">' + s.kids.map(k => secRow(S.sec[k])).join('') + '</div>';
        });
        h += '</div>';
      }
      h += '</div>';
    });
    mapDrop = null;
    return h;
  },
  after(p, reset) { const el = $('#view .sct.cur'), v = $('#view'); if (el && reset) v.scrollTop += el.getBoundingClientRect().top - v.getBoundingClientRect().top - v.clientHeight / 2; }
};
function secRow(s) {
  const isCur = s.id === S.study.sec;
  return '<button class="sct' + (s.level === 3 ? ' l3' : '') + (isCur ? ' cur' : '') + (s.flag ? ' flag' : '') + '" onclick="' + on(() => openSec(s.id)) + '">' + sstIcon(s.status) + '<span class="grow">' + s.id + ' ' + esc(s.title) + (s.flag ? ' <span class="tag stuck">需确认</span>' : '') + (S.stuck.some(x => x.sec === s.id && !x.ok) ? ' <span class="tag stuck">卡点</span>' : '') + '</span><span class="pg n">p.' + s.p0 + '</span></button>';
}
function genericMap(b) {
  let h = '<div class="mapchk"><span class="sst done">' + I('check') + '</span><div class="grow">' + (b.fmt === 'EPUB' ? '从 EPUB 目录建立：' + b.chapters.length + ' 章' : (b.status === 'ready' ? '已和 PDF 书签核对：' + b.chapters.length + ' 章一致' : '解析中，已就绪的章节可以先学')) + '</div></div>';
  b.chapters.forEach((t, i) => {
    h += '<div class="chap"><button class="h" onclick="' + on(() => sheet({ title: '第 ' + (i + 1) + ' 章 ' + esc(t), body: '<div class="note">原型只为《人工智能：现代方法》准备了讲解脚本。实际 App 里，从这里开始讲，AI 会拿着这一章第一个小节的原文，先生成本节路线图再开始讲。</div>', acts: [['从这里开始讲', () => { closeOverlay(); showToast('原型只为 AIMA 第 3 章准备了讲解'); }, 'pri']] })) + '"><span class="no">' + (i + 1) + '</span><span class="grow"><b>' + esc(t) + '</b><small>未开始</small></span>' + I('chev').replace('class="i"', 'class="i arr"') + '</button></div>';
  });
  return h;
}
function openSec(id) {
  const s = S.sec[id];
  if (s.flag) return modal({ title: '确认 ' + id + ' 的标题', body: '这个标题在书里跨了两行，解析时被识别成「' + id + ' 满意搜索：不可容许的启发式函数与」和「加权A*搜索」两个标题。<br><br>已按 PDF 书签合并为一个小节：<b>' + esc(s.title) + '</b>（p.' + s.p0 + '–' + s.p1 + '）。', ok: '保持合并', cancel: '拆成两个', onOk: () => { s.flag = false; showToast('已确认', 'ok'); refresh(); }, onCancel: () => showToast('原型里不演示拆分') });
  const qa = (S.qa[id] || []).length, stk = S.stuck.filter(x => x.sec === id && !x.ok);
  const hasBlocks = blocksOfSec(id).length > 0, isCur = id === S.study.sec, st = S.study;
  const acts = [[isCur ? '继续讲' : s.status === 'done' ? '再讲一遍' : '从这里开始讲', () => startAt(id), 'pri']];
  if (hasBlocks) acts.push(['看原文', () => { if (isCur) { closeOverlay(true); S.study.mode = 'read'; go('study'); } else go('reader', { sec: id }); }]);
  if (S.qa[id] || s.summary) acts.push(['看笔记', () => go('noteDetail', { sec: id })]);
  sheet({ title: id + ' ' + esc(s.title), sub: s.parent ? esc(secName(s.parent)) : '', acts,
    body: '<div class="kv"><span>页码</span><span class="n">p.' + s.p0 + '–' + s.p1 + '</span><span>状态</span><span>' + (s.status === 'done' ? '已学' : s.status === 'learning' ? '在学 · 第 ' + Math.min(stepsDone(st) + 1, st.n) + '/' + st.n + ' 步' : '未学') + '</span>' + (qa ? '<span>问答</span><span>' + qa + ' 条</span>' : '') + '</div>' +
      (s.summary ? '<div class="note acc" style="margin-bottom:8px"><b>摘要</b>　' + esc(s.summary) + '</div>' : '') +
      stk.map(x => '<div class="note warn" style="margin-bottom:8px">卡点：' + esc(x.x) + '</div>').join('') });
}
function startAt(id) {
  if (id === S.study.sec) { closeOverlay(true); S.study.mode = 'listen'; return go('study'); }
  const s = S.sec[id];
  if (s.status === 'done') { closeOverlay(); return showToast('原型只为 ' + S.study.sec + ' 准备了讲解脚本'); }
  modal({ title: '从 ' + id + ' 开始学？', body: '当前进度 ' + S.study.sec + ' 会保留为在学。', ok: '开始学', onOk: () => { setTimeout(() => showToast('原型只为 ' + S.study.sec + ' 准备了讲解脚本'), 300); } });
}

// ---------- 全书搜索（本地 FTS 兜底） ----------
function openSearch(book) {
  if (book !== 'aima') return showToast('原型只有 AIMA 的示意内容可搜');
  sheet({ title: '全书搜索', sub: '在已解析的正文、标题和图注里搜索', body: '<label class="srch">' + I('search') + '<input id="sq" placeholder="一致代价、可容许、三角不等式" oninput="' + on(e => searchRun(e.target.value)) + '"></label><div id="sres"></div>' });
  setTimeout(() => $('#sq') && $('#sq').focus(), 300);
}
function searchRun(qs) {
  const k = qs.trim(), box = $('#sres'); if (!box) return;
  if (!k) { box.innerHTML = ''; return; }
  const hits = BLOCKS.filter(b => plain(b.x).toLowerCase().includes(k.toLowerCase())).slice(0, 8);
  box.innerHTML = hits.length ? '<div class="list">' + hits.map(b => {
    const x = plain(b.x), i = x.toLowerCase().indexOf(k.toLowerCase());
    const snip = esc(x.slice(Math.max(0, i - 16), i)) + '<span class="hit">' + esc(x.substr(i, k.length)) + '</span>' + esc(x.slice(i + k.length, i + k.length + 28));
    return '<button class="row tap" onclick="' + on(() => openBlock(b.id)) + '"><span class="grow"><b style="font-size:15px;font-weight:600">' + esc(secName(b.sec)) + '</b><small style="font-family:var(--serif)">…' + snip + '…</small></span><span class="val n" style="font-size:13px">p.' + b.p + '</span></button>';
  }).join('') + '</div>' : '<div class="empty">没有找到「' + esc(k) + '」</div>';
}
// 打开某个内容块：主线小节在听讲 / 读书页的读书模式里打开，其他小节单独打开 Reader
function openBlock(id) {
  const b = BLK[id];
  closeOverlay(true);
  if (b.sec === S.study.sec) { if (cur().name === 'study') return setMode('read', id); S.study.mode = 'read'; S.study.focus = id; return openStudy(); }
  go('reader', { block: id });
}
