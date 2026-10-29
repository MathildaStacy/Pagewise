/* Pagewise Win11 风原型 · 复习（闪卡 3D 翻面、卡点清单）与笔记（按节、导出） */
'use strict';
SCREENS.review = {
  title: '复习', short: '复习', root: true,
  kicker: () => '今天 ' + dueCards().length + ' 张 · ' + S.stuck.filter(s => !s.ok).length + ' 个卡点',
  render() {
    const due = dueCards(), open = S.stuck.filter(s => !s.ok);
    const boxes = [1, 2, 3, 4, 5].map(k => S.cards.filter(c => c.box === k).length), mx = Math.max(...boxes, 1);
    let h = '<section class="hero rvhero"><div class="bg"></div><div class="in"><div class="top">' + T3('cards', 'lg') + '<div class="meta"><span class="eyebrow"><i></i>今日待复习</span><div class="big n">' + due.length + '<small>张</small></div><div class="sub">约 ' + Math.max(1, Math.round(due.length * 0.4)) + ' 分钟 · 来自 ' + new Set(due.map(c => c.sec.split('.')[0])).size + ' 章</div></div></div>' +
      '<div class="acts"><button class="btn pri"' + (due.length ? '' : ' disabled') + ' onclick="' + on(() => go('rv', {})) + '">' + (due.length ? I('play') + '开始复习 ' + due.length + ' 张' : '今天没有要复习的卡片') + '</button></div></div></section>' +
      '<div class="tiles t3"><div class="card">' + T3('pin', 'sm') + '<b class="n">' + open.length + '</b><span>卡点</span></div><div class="card">' + T3('cards', 'sm') + '<b class="n">' + S.cards.length + '</b><span>闪卡总数</span></div><div class="card">' + T3('check', 'sm') + '<b class="n">' + S.cards.filter(c => c.box >= 4).length + '</b><span>已熟记</span></div></div>' +
      grp('Leitner 盒子 <span>答对往后放，答错回盒 1</span>', '<div class="boxes" aria-label="Leitner 盒子">' + boxes.map((n, i) => '<div><i><em style="height:' + Math.round(n / mx * 100) + '%"></em></i><b class="n">' + n + '</b>盒 ' + (i + 1) + '<small>' + BOX_DAYS[i + 1] + ' 天</small></div>').join('') + '</div>');
    h += '<section class="grp"><div class="grp-h big">卡点清单 <small>没完全掌握的地方</small></div><div class="card list">';
    if (!S.stuck.length) h += empty('check', '没有卡点', '学的时候答错、换说法多次的地方会记在这里。');
    S.stuck.forEach(s => {
      h += '<div class="stk' + (s.ok ? ' ok' : '') + '">' + T3(s.ok ? 'check' : 'pin', 'sm') + '<div class="grow"><b>' + esc(s.x) + '</b><small>' + esc(secName(s.sec)) + (s.fromCard ? ' · 复习时答错' : '') + (s.ok ? ' · 已掌握' : '') + '</small>' +
        (s.ok ? '' : '<div class="btns"><button class="btn sm" onclick="' + on(() => reteach(s)) + '">' + I('spark') + '让 AI 重讲</button><button class="btn sm text" onclick="' + on(() => { s.ok = true; refresh(); showToast('已标为掌握', 'ok'); }) + '">已掌握</button></div>') + '</div></div>';
    });
    return h + '</div></section>';
  }
};
function reteach(s) {
  if (s.id !== 's1') return showToast('原型只为「' + S.stuck[0].x.slice(0, 8) + '…」这类 3.4.2 的卡点准备了重讲');
  const st = S.study;
  if (st.sec !== '3.5.2' || st.detour) return showToast('先回到听讲的主线再试');
  tab('today'); st.mode = 'listen'; openStudy();
  if (st.phase === 'resume') return resumeReview();
  setTimeout(async () => { user('重讲这个卡点：' + s.x); openDetour('3.4.2', REVIEW_342.title, true); await say([{ k: 'tool', lines: REVIEW_342.steps }, { k: 'ai', t: REVIEW_342.answer }]); }, 50);
}

SCREENS.rv = {
  title: p => '复习 ' + Math.min((p.i || 0) + 1, (p.list || dueCards()).length) + '/' + (p.list || dueCards()).length, short: '复习',
  render(p) {
    if (!p.list) { p.list = dueCards().map(c => c.id); p.i = 0; p.res = { again: 0, hard: 0, good: 0 }; }
    if (p.i >= p.list.length) {
      return '<div class="rvdone">' + T3('trophy', 'lg') + '<b>今天复习完了</b><div class="rvres"><div class="g"><b class="n">' + p.res.good + '</b>记得</div><div class="h"><b class="n">' + p.res.hard + '</b>模糊</div><div class="a"><b class="n">' + p.res.again + '</b>忘了</div></div><p>' + (p.res.again ? '忘了的已加入卡点清单，明天再出现。' : '全部记得，盒子往后挪了一格。') + '</p><button class="btn pri block" onclick="tab(\'review\')">完成</button><button class="btn text" style="margin-top:8px" onclick="go(\'stats\')">看学习记录</button></div>';
    }
    const c = S.cards.find(x => x.id === p.list[p.i]);
    const hasSrc = blocksOfSec(c.sec).length > 0;
    const flip = e => { const w = e.currentTarget.closest('.rvwrap'); if (w.classList.contains('flipped')) return; w.classList.add('flipped'); p.flip = true; };
    let h = '<div class="rvprog"><div class="segs">' + p.list.map((x, i) => '<i class="' + (i < p.i ? 'd' : i === p.i ? 'n' : '') + '"></i>').join('') + '</div></div><div class="rvwrap' + (p.flip ? ' flipped' : '') + '"><div class="fcard" role="button" aria-label="翻面看答案" onclick="' + on(flip) + '">' +
      '<div class="face"><div class="src"><span class="tag">' + esc(secName(c.sec)) + '</span><span class="tag acc">盒 ' + c.box + '</span></div><div class="front">' + esc(c.f) + '</div><div class="tip">' + I('retry') + '先在心里回答，再点卡片看答案</div></div>' +
      '<div class="face bk"><div class="src"><span class="tag">' + esc(secName(c.sec)) + '</span><span class="tag acc">盒 ' + c.box + '</span></div><div class="fq">' + esc(c.f) + '</div><div class="ans">' + esc(c.b) + '</div><div class="btns">' +
      (hasSrc ? '<button class="btn sm" onclick="' + on(e => { e.stopPropagation(); go('reader', { sec: c.sec }); }) + '">' + I('book') + '回到原文</button>' : '') + '<button class="btn sm" onclick="' + on(e => { e.stopPropagation(); askCard(c); }) + '">' + I('spark') + '问 AI</button></div></div></div></div>';
    h += '<div class="rate">' + [['again', '忘了', 'a'], ['hard', '模糊', 'h'], ['good', '记得', 'g']].map(([r, l, k]) => '<button class="card ' + k + '" onclick="' + on(() => { rateCard(c, r); p.res[r]++; p.i++; p.flip = false; render(true); }) + '">' + l + '<small>' + BOX_DAYS[nextBox(c, r)] + ' 天后</small></button>').join('') + '</div>';
    return h;
  }
};

// ---------- 笔记 ----------
const noteSecs = () => S.secOrder.filter(id => { const s = S.sec[id]; return (s.summary && s.status === 'done') || S.qa[id] || S.userNote[id]; });
SCREENS.notes = {
  title: '笔记', short: '笔记', root: true,
  kicker: () => noteSecs().length + ' 节有笔记',
  right: () => '<button class="ib" aria-label="搜索笔记" onclick="' + on(() => go('ask')) + '">' + I('search') + '</button>',
  render() {
    const qaN = Object.values(S.qa).reduce((a, x) => a + x.length, 0), hlN = Object.values(S.hl).filter(Boolean).length;
    let h = '<div class="tiles t3"><div class="card">' + T3('note', 'sm') + '<b class="n">' + noteSecs().length + '</b><span>节笔记</span></div><div class="card">' + T3('question', 'sm') + '<b class="n">' + qaN + '</b><span>条问答</span></div><div class="card">' + T3('bulb', 'sm') + '<b class="n">' + hlN + '</b><span>处高亮</span></div></div>';
    h += '<section class="grp"><div class="grp-h">按书</div><div class="card list blist">' + S.books.map(b => {
      const n = b.id === 'aima' ? noteSecs().length : 0;
      return '<button class="book" onclick="' + on(() => { if (!n) return showToast('这本书还没有笔记'); go('notesBook', { book: b.id }); }) + '">' + cover(b, 'sm') + '<span class="grow"><b class="tt">' + esc(b.title) + '</b><span class="meta">' + (n ? n + ' 节有笔记 · ' + qaN + ' 条问答 · ' + hlN + ' 处高亮' : '还没有笔记') + '</span></span>' + (n ? chev() : '') + '</button>';
    }).join('') + '</div></section>';
    const qa = S.qa['3.4.2'] || [];
    h += '<section class="grp"><div class="grp-h">最近记下的</div><div class="card list">' +
      qa.slice(-2).reverse().map(x => row({ t: esc(x.q), d: (x.from ? '学 ' + x.from + ' 时问的 · ' : '') + '3.4.2 一致代价搜索', i3: x.from ? 'branch' : 'question', fn: () => go('noteDetail', { sec: '3.4.2' }) })).join('') +
      Object.keys(S.hl).filter(k => S.hl[k]).slice(0, 2).map(k => row({ t: '<span class="hlq">' + esc(plain(BLK[k].x).slice(0, 26)) + '…</span>', d: '高亮 · ' + esc(secName(BLK[k].sec)) + ' · p.' + BLK[k].p, i3: 'bulb', fn: () => openBlock(k) })).join('') + '</div></section>';
    return h;
  }
};
SCREENS.notesBook = {
  title: '人工智能：现代方法', sub: '笔记', short: '笔记',
  right: () => '<button class="ib" aria-label="导出" onclick="openExport()">' + I('export') + '</button>',
  render() {
    let h = '', lastCh = '';
    noteSecs().forEach(id => {
      const s = S.sec[id], ch = chapterOf(id);
      if (ch.id !== lastCh) { h += (lastCh ? '</div></section>' : '') + '<section class="grp"><div class="grp-h">' + esc(secName(ch.id)) + '</div><div class="card list">'; lastCh = ch.id; }
      const qa = (S.qa[id] || []).length, sk = S.stuck.filter(x => x.sec === id && !x.ok).length, hl = blocksOfSec(id).filter(b => S.hl[b.id]).length;
      h += '<button class="nsec" onclick="' + on(() => go('noteDetail', { sec: id })) + '"><div class="l1"><span>' + id + ' ' + esc(s.title) + '</span>' + statusTag(s.status) + '</div>' + (s.summary ? '<div class="sm">' + esc(s.summary) + '</div>' : '') +
        '<div class="tg">' + (qa ? '<span class="tag">问答 ' + qa + '</span>' : '') + (sk ? '<span class="tag stuck">卡点 ' + sk + '</span>' : '') + (hl ? '<span class="tag">高亮 ' + hl + '</span>' : '') + ((S.qa[id] || []).some(x => x.from) ? '<span class="tag dt">岔路</span>' : '') + '</div></button>';
    });
    return h + (lastCh ? '</div></section>' : '');
  }
};
SCREENS.noteDetail = {
  title: p => secName(p.sec), sub: p => '笔记 · ' + pagesOf(p.sec), short: '笔记',
  right: p => blocksOfSec(p.sec).length ? '<button class="ib" aria-label="看原文" onclick="' + on(() => openSecReader(p.sec)) + '">' + I('book') + '</button>' : '<span style="width:40px"></span>',
  render(p) {
    const id = p.sec, s = S.sec[id];
    const qa = S.qa[id] || [], sk = S.stuck.filter(x => x.sec === id), hls = blocksOfSec(id).filter(b => S.hl[b.id]);
    const pins = blocksOfSec(id).filter(b => S.pins[b.id]);
    let h = '<div class="ndhead">' + statusTag(s.status) + (S.stuck.some(x => x.sec === id && !x.ok) ? '<span class="tag stuck">有卡点</span>' : '') + '<span class="muted">' + esc(secName(chapterOf(id).id)) + '</span></div>' + grp('摘要 ' + (s.summary ? '<span class="tag ai">' + I('spark') + 'AI 起草</span>' : ''), '<div class="nd">' + (s.summary ? esc(s.summary) : '<span class="muted">学完这一节后生成</span>') + '</div>');
    const main = qa.filter(x => !x.from), det = qa.filter(x => x.from);
    if (main.length) h += grp('问答', main.map(x => '<div class="qi"><b>' + esc(x.q) + '</b><span>' + esc(x.a) + '</span></div>').join(''));
    if (det.length) h += grp('岔路记录', det.map(x => '<div class="qi"><div class="fr">学 ' + esc(x.from) + ' 时回来问的</div><b>' + esc(x.q) + '</b><span>' + esc(x.a) + '</span></div>').join(''));
    if (pins.length) h += grp('问答便签', pins.map(b => '<button class="qi" style="width:100%;text-align:left" onclick="' + on(() => openBlock(b.id)) + '"><b>' + esc(S.pins[b.id].q) + '</b><span>p.' + b.p + '</span></button>').join(''));
    if (sk.length) h += grp('卡点', sk.map(x => '<div class="qi"><b style="font-weight:400' + (x.ok ? ';text-decoration:line-through;color:var(--ink2)' : '') + '">' + esc(x.x) + '</b></div>').join(''));
    if (hls.length) h += grp('高亮', hls.map(b => '<button class="qi" style="width:100%;text-align:left" onclick="' + on(() => openBlock(b.id)) + '"><span class="hlq">' + esc(plain(b.x)) + '</span><span style="font-size:12px">p.' + b.p + '</span></button>').join(''));
    h += '<section class="grp"><div class="grp-h">我的笔记 <span>自动保存</span></div><textarea class="edt" placeholder="写点自己的理解…" oninput="' + on(e => { S.userNote[id] = e.target.value; }) + '">' + esc(S.userNote[id] || '') + '</textarea></section>';
    return h;
  }
};
// 复习时「问 AI」（03 §9 askAi）：进入听讲，输入框预填「关于这张卡：…」，卡片所在小节作为岔路加载
function askCard(c) {
  const st = S.study;
  tab('today'); st.mode = 'listen'; openStudy();
  setTimeout(() => { const t = $('#cin'); if (t) { t.value = '关于这张卡：' + c.f; t.focus(); } showToast('发送后会把 ' + c.sec + ' 作为岔路读进来', 'dt'); }, 150);
}
function openSecReader(sec) { if (sec === S.study.sec) { S.study.mode = 'read'; return openStudy(); } go('reader', { sec }); }
function openExport() {
  const n = noteSecs().length;
  const tree = S.exportFmt === 'md'
    ? 'Pagewise导出/人工智能：现代方法/\n  README.md          目录 + 进度\n  第01章/\n    1.1-什么是人工智能.md\n    …\n  第03章/\n    3.4.2-Dijkstra算法或一致代价搜索.md\n    3.5.2-A*搜索.md\n    …'
    : 'Pagewise导出/人工智能：现代方法-闪卡.csv\n  正面,背面,标签\n  "A* 的评价函数是什么？…","f(n) = g(n) + h(n)…","AIMA::3.5.2"';
  sheet({ title: '导出笔记', sub: '人工智能：现代方法 · ' + n + ' 节', body: segHtml([['md', 'Markdown'], ['anki', 'Anki CSV']], S.exportFmt, k => { S.exportFmt = k; openExport(); }, 'margin:2px 0 12px') +
    '<div class="tree">' + esc(tree) + '</div><div class="grp-f" style="padding:0 4px 12px">' + (S.exportFmt === 'md' ? '每节一个文件，目录结构和 aima4e-markdown 的「课程讲义」一致：摘要、问答、岔路记录、卡点、高亮、我的笔记。' : S.cards.length + ' 张闪卡，标签按「书::小节」组织。') + '</div>' +
    '<div class="card list">' + row({ t: '去掉大段原文引用', d: '高亮只保留前 30 字，方便分享', right: swHtml(S.exportStrip, () => { S.exportStrip = !S.exportStrip; }, '去掉大段原文引用') }) + '</div>',
    acts: [['导出到「下载」', () => { closeOverlay(); showToast('已导出 ' + (S.exportFmt === 'md' ? n + ' 个文件' : S.cards.length + ' 张闪卡') + ' 到 下载/Pagewise导出（原型不会真的写文件）', 'ok'); }, 'pri']] });
}
