/* Pagewise 原型 · 书的地图、小节详情、全书搜索 */
'use strict';
const mapOpen = { ch3: true, '3.5': true, '3.4': false };

SCREENS.map = {
  title: p => { const b = bookOf(p.book); return esc(b.title.replace(/（.*$/, '')) + '<span class="sub">书的地图</span>'; },
  navRight: p => '<button class="ib" aria-label="全书搜索" onclick="' + on(() => openSearch(p.book)) + '">⌕</button>',
  render(p) {
    const b = bookOf(p.book);
    if (p.book !== 'aima') return genericMap(b);
    const flags = S.secOrder.filter(id => S.sec[id].flag);
    let h = '<div class="mapchk"><span class="sst done">✓</span><div class="grow" style="flex:1">已和 PDF 书签核对：28 章 + 2 个附录一致' + (flags.length ? '<div style="color:var(--stuck);font-size:12px">' + flags.length + ' 处需要你确认 · ' + flags.map(id => id).join('、') + '</div>' : '<div class="muted" style="font-size:12px">没有需要确认的地方</div>') + '</div></div>';
    S.secOrder.filter(id => S.sec[id].level === 1).forEach(cid => {
      const c = S.sec[cid], open = !!mapOpen[cid];
      const isCur = cid === chapterOf(S.study.sec).id;
      const kids = c.kids;
      h += '<div class="chap' + (c.status === 'done' ? ' done' : '') + (isCur ? ' cur' : '') + (open ? ' open' : '') + '"><div class="h" onclick="' + on(() => { if (!kids.length) return showToast('原型只展开了第 1–3 章'); mapOpen[cid] = !open; refresh(); }) + '"><span class="no">' + c.no + '</span><div class="grow"><b>' + esc(c.title) + '</b><small>p.' + c.p0 + '–' + c.p1 + (kids.length ? ' · ' + kids.length + ' 节' : '') + (c.status === 'done' ? ' · 已学完' : isCur ? ' · 在学 ' + S.study.sec : '') + '</small></div><span class="arr">›</span></div>';
      if (open) kids.forEach(sid => {
        const s = S.sec[sid];
        if (!s.kids) { h += secRow(s); return; }
        const so = mapOpen[sid] !== false;
        h += '<div class="sct" onclick="' + on(() => { mapOpen[sid] = !so; refresh(); }) + '">' + sstIcon(s.status) + '<div class="grow">' + sid + ' ' + esc(s.title) + '</div><span class="pg">' + s.kids.filter(k => S.sec[k].status === 'done').length + '/' + s.kids.length + ' ' + (so ? '▾' : '▸') + '</span></div>';
        if (so) s.kids.forEach(k => { h += secRow(S.sec[k]); });
      });
      h += '</div>';
    });
    return h + '<div style="height:16px"></div>';
  },
  after(p, reset) { const el = $('#view .sct.cur'), v = $('#view'); if (el && reset) v.scrollTop += el.getBoundingClientRect().top - v.getBoundingClientRect().top - v.clientHeight / 2; }
};
function secRow(s) {
  const isCur = s.id === S.study.sec;
  return '<div class="sct' + (s.level === 3 ? ' l3' : '') + (isCur ? ' cur' : '') + (s.flag ? ' flag' : '') + '" onclick="' + on(() => openSec(s.id)) + '">' + sstIcon(s.status) + '<div class="grow">' + s.id + ' ' + esc(s.title) + (s.flag ? ' <span class="tag stuck">需确认</span>' : '') + (S.stuck.some(x => x.sec === s.id && !x.ok) ? ' <span class="tag stuck">卡点</span>' : '') + '</div><span class="pg">p.' + s.p0 + '</span></div>';
}
function genericMap(b) {
  let h = '<div class="mapchk"><span class="sst done">✓</span><div class="grow" style="flex:1">' + (b.fmt === 'EPUB' ? '从 EPUB 目录建立：' + b.chapters.length + ' 章' : (b.status === 'ready' ? '已和 PDF 书签核对：' + b.chapters.length + ' 章一致' : '解析中，已就绪的章节可以先学')) + '</div></div><div class="sec">';
  b.chapters.forEach((t, i) => {
    h += '<div class="chap"><div class="h" onclick="' + on(() => sheet('第 ' + (i + 1) + ' 章 ' + esc(t), '<div class="sb"><div class="note">原型只为《人工智能：现代方法》准备了讲解脚本。实际 App 里，从这里开始讲，AI 会拿着这一章第一个小节的原文开始。</div></div><div class="sf"><button class="btn pri" onclick="' + on(() => { closeOverlay(); showToast('原型只为 AIMA 第 3 章准备了讲解'); }) + '">从这里开始讲</button></div>')) + '"><span class="no">' + (i + 1) + '</span><div class="grow"><b>' + esc(t) + '</b><small>未开始</small></div><span class="arr">›</span></div></div>';
  });
  return h + '</div>';
}
function openSec(id) {
  const s = S.sec[id];
  if (s.flag) return modal({ title: '确认 ' + id + ' 的标题', body: '这个标题在书里跨了两行，解析时被识别成「' + id + ' 满意搜索：不可容许的启发式函数与」和「加权A*搜索」两个标题。<br><br>已按 PDF 书签合并为一个小节：<b>' + esc(s.title) + '</b>（p.' + s.p0 + '–' + s.p1 + '）。', ok: '保持合并', cancel: '拆成两个', onOk: () => { s.flag = false; showToast('已确认', 'ok'); refresh(); }, onCancel: () => showToast('原型里不演示拆分') });
  const qa = (S.qa[id] || []).length, stk = S.stuck.filter(x => x.sec === id && !x.ok);
  const hasBlocks = blocksOfSec(id).length > 0;
  const isCur = id === S.study.sec;
  sheet(id + ' ' + esc(s.title), '<div class="kv"><span>页码</span><span class="n">p.' + s.p0 + '–' + s.p1 + '</span><span>状态</span><span>' + (s.status === 'done' ? '已学' : s.status === 'learning' ? '在学 · 第 ' + (S.study.part + 1) + '/' + S.study.n + ' 段' : '未学') + '</span>' + (qa ? '<span>问答</span><span>' + qa + ' 条</span>' : '') + '</div>' +
    (s.summary ? '<div class="sb"><div class="note acc"><b>摘要</b>　' + esc(s.summary) + '</div></div>' : '') +
    (stk.length ? '<div class="sb">' + stk.map(x => '<div class="note warn" style="margin-bottom:6px">卡点：' + esc(x.x) + '</div>').join('') + '</div>' : '') +
    '<div class="sf">' + (hasBlocks ? '<button class="btn ghost" onclick="' + on(() => go('reader', { sec: id })) + '">看原文</button>' : '') +
    ((S.qa[id] || s.summary) ? '<button class="btn ghost" onclick="' + on(() => go('noteDetail', { sec: id })) + '">看笔记</button>' : '') +
    '<button class="btn pri" onclick="' + on(() => startAt(id)) + '">' + (isCur ? '继续讲' : s.status === 'done' ? '再讲一遍' : '从这里开始讲') + '</button></div>', s.parent ? secName(s.parent) : '');
}
function startAt(id) {
  if (id === S.study.sec) return openStudy();
  closeOverlay();
  showToast('原型只为 ' + S.study.sec + ' 准备了讲解脚本');
}

// ---------- 全书搜索（本地 FTS 兜底） ----------
function openSearch(book) {
  if (book !== 'aima') return showToast('原型只有 AIMA 的示意内容可搜');
  sheet('全书搜索', '<div style="padding:4px 16px 8px"><input id="sq" placeholder="例如：一致代价、可容许、三角不等式" style="width:100%;height:40px;border:1px solid #DFDDD8;border-radius:20px;padding:0 14px;outline:0" oninput="' + on(e => searchRun(e.target.value)) + '"></div><div id="sres"><div class="empty" style="padding:20px">在已解析的正文、标题和图注里搜索</div></div>');
  setTimeout(() => $('#sq') && $('#sq').focus(), 50);
}
function searchRun(qs) {
  const k = qs.trim();
  const box = $('#sres'); if (!box) return;
  if (!k) { box.innerHTML = '<div class="empty" style="padding:20px">在已解析的正文、标题和图注里搜索</div>'; return; }
  const hits = BLOCKS.filter(b => b.x.toLowerCase().includes(k.toLowerCase())).slice(0, 8);
  box.innerHTML = hits.length ? hits.map(b => {
    const i = b.x.toLowerCase().indexOf(k.toLowerCase());
    const snip = esc(b.x.slice(Math.max(0, i - 18), i)) + '<b style="background:var(--hl)">' + esc(b.x.substr(i, k.length)) + '</b>' + esc(b.x.slice(i + k.length, i + k.length + 30));
    return '<div class="row tap" onclick="' + on(() => go('reader', { block: b.id })) + '"><div class="grow"><b style="font-size:13px">' + esc(secName(b.sec)) + '</b><small style="font-family:var(--serif);font-size:13px;color:var(--ink2)">…' + snip.replace(/\$/g, '') + '…</small></div><span class="n muted" style="font-size:12px">p.' + b.p + '</span></div>';
  }).join('') : '<div class="empty" style="padding:20px">没有找到「' + esc(k) + '」</div>';
}
