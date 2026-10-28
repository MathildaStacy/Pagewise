/* Pagewise 原型 · 复习（闪卡、卡点）与笔记（按节、导出） */
'use strict';
SCREENS.review = {
  title: '复习', root: true,
  render() {
    const due = dueCards(), open = S.stuck.filter(s => !s.ok);
    const boxes = [1, 2, 3, 4, 5].map(k => S.cards.filter(c => c.box === k).length), mx = Math.max(...boxes, 1);
    let h = '<div class="rvhero"><div><b>' + due.length + '</b><span>今日待复习</span></div><div><b>' + open.length + '</b><span>卡点</span></div><div><b>' + S.cards.length + '</b><span>闪卡总数</span></div></div>' +
      '<div class="boxes">' + boxes.map((n, i) => '<div><i><em style="height:' + Math.round(n / mx * 100) + '%"></em><b>' + n + '</b></i>盒 ' + (i + 1) + ' · ' + BOX_DAYS[i + 1] + ' 天</div>').join('') + '</div>' +
      '<div style="background:#fff;padding:0 14px 14px;margin-bottom:8px"><button class="btn pri block"' + (due.length ? '' : ' disabled') + ' onclick="' + on(() => go('rv', {})) + '">' + (due.length ? '开始复习 ' + due.length + ' 张' : '今天没有要复习的卡片') + '</button></div>';
    h += '<div class="sec"><div class="sec-h">卡点清单 <small>没完全掌握的地方</small></div>';
    S.stuck.forEach(s => {
      h += '<div class="stk' + (s.ok ? ' ok' : '') + '"><span class="ic">' + (s.ok ? '✓' : '!') + '</span><div class="grow"><b>' + esc(s.x) + '</b><small>' + esc(secName(s.sec)) + (s.fromCard ? ' · 复习时答错' : '') + '</small>' +
        (s.ok ? '' : '<div class="acts"><button class="btn sm ghost" onclick="' + on(() => reteach(s)) + '">让 AI 重讲</button><button class="btn sm ghost" onclick="' + on(() => { s.ok = true; refresh(); showToast('已标为掌握', 'ok'); }) + '">已掌握</button></div>') + '</div></div>';
    });
    return h + '</div>';
  }
};
function reteach(s) {
  if (s.id !== 's1') return showToast('原型只为「' + S.stuck[0].x.slice(0, 8) + '…」这类 3.4.2 的卡点准备了重讲');
  if (S.study.sec !== '3.5.2' || S.study.detour) return showToast('先回到伴读的主线再试');
  tab('shelf'); go('study');
  if (S.study.phase === 'resume') return resumeReview();
  setTimeout(async () => { const st = ST(); user('重讲这个卡点：' + s.x); st.detour = '3.4.2'; st.reviewing = true; st.msgs.push({ r: 'divd', text: '岔路 · ' + secName('3.4.2'), dt: true }); await steps(REVIEW_342.steps); await say(REVIEW_342.answer); }, 50);
}

SCREENS.rv = {
  title: p => '复习 <span class="n" style="font-weight:400;color:var(--ink3)">' + Math.min((p.i || 0) + 1, (p.list || dueCards()).length) + '/' + (p.list || dueCards()).length + '</span>',
  render(p) {
    if (!p.list) { p.list = dueCards().map(c => c.id); p.i = 0; p.res = { again: 0, hard: 0, good: 0 }; }
    if (p.i >= p.list.length) {
      return '<div class="empty" style="padding-top:80px"><div style="font-size:40px">✓</div><div style="font-size:17px;color:var(--ink);font-weight:600;margin:8px 0">今天复习完了</div>记得 ' + p.res.good + ' · 模糊 ' + p.res.hard + ' · 忘了 ' + p.res.again + (p.res.again ? '<br>忘了的已加入卡点清单' : '') + '</div><div style="padding:0 30px"><button class="btn pri block" onclick="tab(&quot;review&quot;)">完成</button></div>';
    }
    const c = S.cards.find(x => x.id === p.list[p.i]);
    const hasSrc = blocksOfSec(c.sec).length > 0;
    let h = '<div class="fcard" onclick="' + on(() => { p.flip = true; refresh(); }) + '"><div class="src"><span>' + esc(secName(c.sec)) + '</span><span>盒 ' + c.box + '</span></div><div class="front">' + esc(c.f) + '</div>' +
      (p.flip ? '<div class="back">' + esc(c.b) + '</div><div style="display:flex;gap:8px;margin-top:14px">' + (hasSrc ? '<button class="btn sm ghost" onclick="' + on(e => { e.stopPropagation(); go('reader', { sec: c.sec }); }) + '">回到原文</button>' : '') + '<button class="btn sm ghost" onclick="' + on(e => { e.stopPropagation(); showToast('会带着这张卡和 ' + c.sec + ' 的原文去问 AI（原型未实现）'); }) + '">问 AI</button></div>' : '<div class="tip">先在心里回答，再点卡片看答案</div>') + '</div>';
    if (p.flip) h += '<div class="rate">' + [['again', '忘了', 'a'], ['hard', '模糊', 'h'], ['good', '记得', 'g']].map(([r, l, k]) => { const nb = nextBox(c, r); return '<button class="' + k + '" onclick="' + on(() => { rateCard(c, r); p.res[r]++; p.i++; p.flip = false; refresh(); }) + '">' + l + '<small>' + BOX_DAYS[nb] + ' 天后</small></button>'; }).join('') + '</div>';
    return h;
  }
};

// ---------- 笔记 ----------
const noteSecs = () => S.secOrder.filter(id => { const s = S.sec[id]; return (s.summary && s.status === 'done') || S.qa[id] || S.userNote[id]; });
SCREENS.notes = {
  title: '笔记', root: true,
  render() {
    let h = '<div class="sec">';
    S.books.forEach(b => {
      const n = b.id === 'aima' ? noteSecs().length : 0;
      h += '<div class="book" onclick="' + on(() => { if (!n) return showToast('这本书还没有笔记'); go('notesBook', { book: b.id }); }) + '">' + cover(b) + '<div class="grow"><div class="tt">' + esc(b.title) + '</div><div class="meta">' + (n ? n + ' 节有笔记 · ' + Object.values(S.qa).reduce((a, x) => a + x.length, 0) + ' 条问答 · ' + Object.values(S.hl).filter(Boolean).length + ' 处高亮' : '还没有笔记') + '</div></div></div>';
    });
    return h + '</div>';
  }
};
SCREENS.notesBook = {
  title: '人工智能：现代方法<span class="sub">笔记</span>',
  navRight: () => '<button class="tb" onclick="openExport()">导出</button>',
  render() {
    let h = '', lastCh = '';
    noteSecs().forEach(id => {
      const s = S.sec[id], ch = chapterOf(id);
      if (ch.id !== lastCh) { h += (lastCh ? '</div>' : '') + '<div class="sec"><div class="sec-h">' + esc(secName(ch.id)) + '</div>'; lastCh = ch.id; }
      const qa = (S.qa[id] || []).length, sk = S.stuck.filter(x => x.sec === id && !x.ok).length, hl = blocksOfSec(id).filter(b => S.hl[b.id]).length;
      h += '<div class="nsec" onclick="' + on(() => go('noteDetail', { sec: id })) + '"><div class="l1"><b>' + id + ' ' + esc(s.title) + '</b>' + statusTag(s.status) + '</div>' + (s.summary ? '<div class="sm">' + esc(s.summary) + '</div>' : '') +
        '<div class="tg">' + (qa ? '<span class="tag">问答 ' + qa + '</span>' : '') + (sk ? '<span class="tag stuck">卡点 ' + sk + '</span>' : '') + (hl ? '<span class="tag">高亮 ' + hl + '</span>' : '') + ((S.qa[id] || []).some(x => x.from) ? '<span class="tag dt">岔路</span>' : '') + '</div></div>';
    });
    return h + '</div>';
  }
};
SCREENS.noteDetail = {
  title: p => esc(secName(p.sec)) + '<span class="sub">笔记 · ' + pagesOf(p.sec) + '</span>',
  navRight: p => blocksOfSec(p.sec).length ? '<button class="tb" onclick="' + on(() => go('reader', { sec: p.sec })) + '">原文</button>' : '<span style="width:40px"></span>',
  render(p) {
    const id = p.sec, s = S.sec[id];
    const qa = S.qa[id] || [], sk = S.stuck.filter(x => x.sec === id), hls = blocksOfSec(id).filter(b => S.hl[b.id]);
    let h = '<div class="nd"><h3>摘要</h3><p>' + (s.summary ? esc(s.summary) : '<span class="muted">学完这一节后生成</span>') + '</p>';
    const main = qa.filter(x => !x.from), det = qa.filter(x => x.from);
    if (main.length) h += '<h3>问答</h3>' + main.map(x => '<div class="qi"><b>' + esc(x.q) + '</b><span>' + esc(x.a) + '</span></div>').join('');
    if (det.length) h += '<h3>岔路记录</h3>' + det.map(x => '<div class="qi"><span class="fr">学 ' + esc(x.from) + ' 时回来问的</span><b>' + esc(x.q) + '</b><span>' + esc(x.a) + '</span></div>').join('');
    if (sk.length) h += '<h3>卡点</h3>' + sk.map(x => '<div class="qi"><b style="font-weight:500' + (x.ok ? ';text-decoration:line-through;color:var(--ink3)' : '') + '">' + esc(x.x) + '</b></div>').join('');
    if (hls.length) h += '<h3>高亮</h3>' + hls.map(b => '<div class="qi" style="cursor:pointer" onclick="' + on(() => go('reader', { block: b.id })) + '"><span class="hlq">' + esc(b.x.replace(/\$/g, '')) + '</span><span class="muted" style="font-size:11px">p.' + b.p + '</span></div>').join('');
    h += '<h3>我的笔记</h3><textarea class="edt" placeholder="写点自己的理解…" oninput="' + on(e => { S.userNote[id] = e.target.value; }) + '">' + esc(S.userNote[id] || '') + '</textarea></div>';
    return h;
  }
};
function openExport() {
  const n = noteSecs().length;
  const tree = S.exportFmt === 'md'
    ? 'Pagewise导出/人工智能：现代方法/\n  README.md          目录 + 进度\n  第01章/\n    1.1-什么是人工智能.md\n    …\n  第03章/\n    3.4.2-Dijkstra算法或一致代价搜索.md\n    3.5.2-A*搜索.md\n    …'
    : 'Pagewise导出/人工智能：现代方法-闪卡.csv\n  正面,背面,标签\n  "A* 的评价函数是什么？…","f(n) = g(n) + h(n)…","AIMA::3.5.2"';
  sheet('导出笔记', '<div style="padding:4px 16px 10px"><div class="seg">' + [['md', 'Markdown'], ['anki', 'Anki CSV']].map(([k, l]) => '<button class="' + (S.exportFmt === k ? 'on' : '') + '" onclick="' + on(() => { S.exportFmt = k; openExport(); }) + '">' + l + '</button>').join('') + '</div></div>' +
    '<div class="tree">' + esc(tree) + '</div>' +
    (S.exportFmt === 'md' ? '<div class="sb" style="font-size:13px;color:var(--ink2);padding-bottom:0">每节一个文件，目录结构和 aima4e-markdown 的「课程讲义」一致：摘要、问答、岔路记录、卡点、高亮、我的笔记。</div>' : '<div class="sb" style="font-size:13px;color:var(--ink2);padding-bottom:0">' + S.cards.length + ' 张闪卡，标签按「书::小节」组织。</div>') +
    '<div class="row"><div class="grow">去掉大段原文引用<small>高亮只保留前 30 字，方便分享</small></div><span class="sw' + (S.exportStrip ? ' on' : '') + '" onclick="' + on(() => { S.exportStrip = !S.exportStrip; openExport(); }) + '"></span></div>' +
    '<div class="sf"><button class="btn pri" onclick="' + on(() => { closeOverlay(); showToast('已导出 ' + (S.exportFmt === 'md' ? n + ' 个文件' : S.cards.length + ' 张闪卡') + ' 到 下载/Pagewise导出（原型不会真的写文件）', 'ok'); }) + '">导出到「下载」</button></div>', '人工智能：现代方法 · ' + n + ' 节');
}
