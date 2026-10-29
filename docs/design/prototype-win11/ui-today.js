/* Pagewise Win11 风原型 · 今天（Tab 1，Win11 稿新增）、问书架、学习记录 */
'use strict';
const WEEKDAY = '周四 · 10 月 29 日';
const greet = () => '晚上好';

SCREENS.today = {
  title: greet, kicker: WEEKDAY, short: '今天', root: true,
  right: () => '<button class="avatar" aria-label="我的" onclick="tab(\'me\')">' + I('person') + '</button>',
  render() {
    const F = S.flags;
    // AI 搜索框：像 2026 Settings 顶部的 agent 搜索，彩虹描边
    let h = '<button class="ask" onclick="go(\'ask\')">' + I('spark').replace('class="i f"', 'class="i f sp"') + '<span>问问你书架上的书…</span><i class="mic" onclick="' + on(e => { e.stopPropagation(); showToast('语音提问：按住说话（M5）'); }) + '">' + I('mic') + '</i></button>';
    if (F.emptyShelf) {
      return h + '<section class="card welcome-card">' + empty('book', '书架还是空的', '导入一本 PDF 或 EPUB，Pagewise 会先建好「书的地图」，再一节一节讲给你听。', '<button class="btn pri" onclick="openImport()">' + I('add') + '导入第一本书</button>') + '</section>' +
        '<h2 class="sh">还没开始</h2><div class="card list" style="margin:0 16px 20px">' + row({ t: '配置 AI 服务', d: '讲解需要一个 AI 服务（Claude、OpenAI 兼容…）', i3: 'cpu', fn: () => go('meAI') }) + row({ t: '配置 MinerU Token', d: 'PDF 要先交给 MinerU 解析；EPUB 不需要', i3: 'key', fn: () => go('meMineru') }) + row({ t: '看看新手引导', d: '三步配置好就能开始', i3: 'rocket', fn: () => go('welcome', { step: 0 }) }) + '</div>';
    }
    h += heroCard();
    const due = dueCards().length;
    h += '<div class="row2">' +
      '<button class="card wid" onclick="' + on(() => due ? go('rv', {}) : tab('review')) + '">' + T3('cards') + '<div class="num">' + due + '<small>张</small></div><div class="lab">今天要复习的闪卡</div><div class="foot">' + (due ? '开始复习' : '去复习页') + I('chev') + '</div></button>' +
      '<button class="card wid" onclick="go(\'stats\')">' + T3('fire') + '<div class="num">' + STATS.streak + '<small>天</small></div><div class="lab">连续学习</div><div class="days">' + STATS.week.slice(0, 5).map(([d, m], i) => '<i class="' + (i === 3 ? 'today' : m ? 'on' : '') + '">' + d + '</i>').join('') + '</div></button></div>';
    h += '<h2 class="sh">书架<a onclick="tab(\'shelf\')">全部 ' + S.books.length + ' 本</a></h2><div class="shelf">' +
      S.books.map(b => '<button class="bk" onclick="' + on(() => openBook(b.id)) + '">' + cover(b) + '<p>' + esc(shelfLine(b)) + '</p><div class="ring"><i style="width:' + bookPct(b) + '%"></i></div></button>').join('') +
      '<button class="bk add" onclick="openImport()"><div class="cover">' + I('add') + '</div><p>导入 PDF / EPUB</p></button></div>';
    const open = S.stuck.filter(s => !s.ok).slice(0, 2), solved = S.stuck.find(s => s.ok);
    h += '<h2 class="sh">最近的卡点<a onclick="tab(\'review\')">全部</a></h2><div class="card list" style="margin:0 16px 20px">' +
      open.map(s => row({ t: esc(s.x), d: esc(secName(s.sec)) + (s.id === 's1' ? ' · 3 天前' : ''), i3: 'pin', fn: () => s.id === 's1' ? reteach(s) : go('noteDetail', { sec: s.sec }) })).join('') +
      (solved ? row({ t: esc(solved.x), d: esc(secName(solved.sec)) + ' · 已解决', i3: 'bulb', fn: () => go('noteDetail', { sec: solved.sec }) }) : '') + '</div>';
    return h;
  }
};
// 继续学习：hero 卡，壁纸色从卡片背后透出来（03 §1 的 continueCard，Win11 版放在「今天」）
function heroCard() {
  const st = S.study, inSec = st.sec === '3.5.2', k = stepsDone(st);
  const stuck = S.stuck.find(s => !s.ok && s.sec === '3.4.2');
  const curStep = st.steps[Math.min(k, st.n - 1)] || { t: '' };
  const segs = st.ss.map(x => '<i class="' + (x === 'done' || x === 'skipped' ? 'd' : x === 'now' ? 'n' : '') + '"></i>').join('');
  return '<section class="hero"><div class="bg"></div><div class="in"><div class="top">' + cover(bookOf('aima')) +
    '<div class="meta"><span class="eyebrow"><i></i>' + (st.phase === 'ready' ? '本节讲完了' : '继续听讲') + '</span><h3>' + esc(secName(st.sec)) + '</h3><div class="sub">第 3 章 · 通过搜索进行问题求解</div>' +
    '<div class="segs">' + segs + '</div><div class="stepn"><span><b>' + (k || !inSec ? '第 ' + Math.min(k + 1, st.n) + ' / ' + st.n + ' 步' : '新的一节') + '</b>' + (curStep.t ? ' · ' + esc(curStep.t) : '') + '</span><span class="n">' + (curStep.p || pagesOf(st.sec)) + '</span></div></div></div>' +
    (S.daysAway && stuck && inSec && st.phase === 'resume' && S.prefs.recap ? '<div class="recap">' + I('spark') + '<span>' + S.daysAway + ' 天前讲完了第 1 步。你在 3.4.2 问过 <b>「' + esc(stuck.x.slice(0, 14)) + '…」</b>，这一节会再用到。</span></div>' : '<div style="height:14px"></div>') +
    '<div class="acts"><button class="btn pri" onclick="openStudy(\'listen\')">' + I('play') + '继续听讲</button><button class="btn" onclick="openStudy(\'read\')">' + I('book') + '读原文</button></div></div></section>';
}
const bookPct = b => b.id === 'aima' ? Math.round(doneCount() / leafSecs().length * 100) : b.status === 'parsing' ? 0 : 0;
function shelfLine(b) {
  if (b.id === 'aima') return S.study.sec + ' ' + S.sec[S.study.sec].title;
  if (b.status === 'parsing') return b.parts && b.parts.some(x => x.err) ? '解析暂停' : '解析中…';
  return '还没开始';
}

// ---------- 问书架（V1.1 设想：跨书全文检索 + 一次 AI 回答，不进入听讲 thread） ----------
SCREENS.ask = {
  title: '问书架', sub: '在你所有书的原文里找答案', short: '问书架',
  top: () => '<form class="askbox" onsubmit="' + on(e => { e.preventDefault(); runAsk($('#askq').value); }) + '"><div class="glow"></div><div class="box">' + I('spark').replace('class="i f"', 'class="i f sp"') +
    '<input id="askq" autocomplete="off" aria-label="问书架" placeholder="比如：A* 和 Dijkstra 是什么关系？" value="' + esc(S.ask.q) + '">' +
    (S.ask.state === 'busy' ? '<button type="button" class="send" aria-label="停止" onclick="' + on(() => { S.ask.state = 'idle'; refresh(); }) + '">' + I('stop') + '</button>' : '<button class="send" aria-label="提问">' + I('send') + '</button>') + '</div></form>' +
    '<div class="chips scope">' + [['all', '全部 ' + S.books.length + ' 本'], ['aima', '人工智能：现代方法'], ['slm', '统计学习方法'], ['ddia', 'DDIA']].map(([k, l]) => '<button class="chip' + ((S.ask.scope || 'all') === k ? ' on' : '') + '" onclick="' + on(() => { S.ask.scope = k; refresh(); }) + '">' + l + '</button>').join('') + '</div>',
  render() {
    const A = S.ask;
    if (A.state === 'idle') {
      return '<div class="pad"><div class="sub" style="margin-top:6px">试试这样问</div><div class="card list">' +
        ASK_SUGGEST.map(([q, ic]) => row({ t: q, i3: ic, fn: () => runAsk(q) })).join('') + '</div>' +
        '<div class="sub" style="margin-top:20px">最近问过</div><div class="card list">' + row({ t: '贪心搜索为什么不是最优的？', d: '10 月 26 日 · 人工智能：现代方法', ic: 'history', fn: () => runAsk('贪心搜索为什么不是最优的？') }) + '</div>' +
        '<div style="margin-top:16px">' + noteHtml('ai', '跨书问答只读你书架上<b>已解析</b>的内容，回答里每个说法都带书名和页码。解析中的书只搜已就绪的部分。', 'info') + '</div></div>';
    }
    let h = '<div class="thread">' + '<div class="user">' + esc(A.asked) + '</div>';
    h += '<div class="tool">' + A.tools.slice(0, A.n).map((x, k) => '<span class="' + (A.state === 'busy' && k === A.n - 1 ? 'run' : '') + '">' + I('search') + esc(x) + '</span>').join('') + '</div>';
    if (A.state === 'busy' && !A.shown) h += '<div class="typing"><i></i><i></i><i></i></div>';
    if (A.shown) h += '<div class="ai"><div class="who"><span class="orb">' + I('spark') + '</span>Pagewise · 跨书回答</div><div id="askans">' + md(A.shown, null) + (A.state === 'busy' ? '<span class="caret"></span>' : '') + '</div></div>';
    if (A.state === 'done' && A.hits.length) {
      h += '<div class="sh2">原文命中 · ' + A.hits.length + ' 处</div><div class="card list hitlist"><div class="hb">' + cover(bookOf('aima'), 'xs') + '<b>人工智能：现代方法（第4版）</b><span class="tag acc">' + A.hits.length + '</span></div>' +
        A.hits.map(id => { const b = BLK[id]; return '<button class="row tap" onclick="' + on(() => openBlock(id)) + '"><span class="grow"><b>' + esc(secName(b.sec)) + '</b><small class="serif">' + esc(plain(b.x).slice(0, 56)) + '…</small></span><span class="val n">p.' + b.p + '</span></button>'; }).join('') + '</div>' +
        '<div class="card list" style="margin-top:10px"><div class="hb muted">' + cover(bookOf('slm'), 'xs') + '<b>统计学习方法（第2版）</b><span class="tag">0</span></div><div class="row"><span class="grow"><small>没有相关内容 · p.201–470 还在解析，暂时搜不到</small></span></div></div>' +
        '<div class="btns" style="margin-top:14px"><button class="btn pri" onclick="' + on(() => { S.study.mode = 'listen'; tab('today'); openStudy(); setTimeout(() => { const t = $('#cin'); if (t) { t.value = A.asked; t.focus(); } }, 120); }) + '">' + I('listen') + '带到听讲里继续问</button><button class="btn" onclick="' + on(() => showToast('已保存到 3.4.2 的笔记', 'ok')) + '">' + I('note') + '存到笔记</button></div>';
    }
    return h + '</div>';
  },
  after(p, reset) { if (reset && S.ask.state === 'idle') setTimeout(() => { const q = $('#askq'); if (q) q.focus(); }, 300); }
};
async function runAsk(q) {
  q = (q || '').trim(); if (!q) return;
  if (S.flags.offline) return showToast('网络不可用，问题已保留在输入框', 'bad');
  const A = S.ask, hit = ASK_SCRIPT.match.test(q);
  Object.assign(A, { q: '', asked: q, state: 'busy', tools: hit ? ASK_SCRIPT.tools : ['在 3 本书已解析的正文里检索：' + q.slice(0, 12)], n: 0, shown: '', hits: hit ? ASK_SCRIPT.hits : [] });
  refresh();
  for (let i = 1; i <= A.tools.length; i++) { await sleep(480); if (A.state !== 'busy') return; A.n = i; refresh(); }
  await sleep(300);
  const at = atoms(hit ? ASK_SCRIPT.answer : ASK_SCRIPT.other);
  for (let i = 0; i <= at.length; i += 5) {
    if (A.state !== 'busy') return;
    A.shown = at.slice(0, i).join('');
    const el = $('#askans'); if (el) el.innerHTML = md(A.shown, null) + '<span class="caret"></span>'; else refresh();
    await sleep(16);
  }
  A.shown = at.join(''); A.state = 'done'; refresh();
}

// ---------- 学习记录（点「连续学习」进入） ----------
SCREENS.stats = {
  title: '学习记录', sub: '最近 30 天', short: '记录',
  render() {
    const T = STATS, goalPct = Math.min(1, T.today / S.goal);
    const mx = Math.max(...T.week.map(w => w[1]), 1);
    let h = '<section class="card streak"><div class="l">' + T3('fire', 'lg') + '</div><div class="r"><div class="big n">' + T.streak + '<small>天</small></div><div class="muted">连续学习 · 最长 ' + T.best + ' 天</div></div>' +
      '<div class="ring" style="--p:' + goalPct + '"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26"/><circle class="v" cx="32" cy="32" r="26" pathLength="100" style="stroke-dasharray:' + Math.round(goalPct * 100) + ' 100"/></svg><span><b class="n">' + T.today + '</b>/' + S.goal + ' 分</span></div></section>';
    h += grp('本周 <span>' + T.week.reduce((a, w) => a + w[1], 0) + ' 分钟</span>', '<div class="week">' + T.week.map(([d, m], i) => '<div class="' + (i === 3 ? 'today' : i > 3 ? 'fut' : '') + '"><i style="height:' + Math.max(4, Math.round(m / mx * 96)) + 'px"><em class="n">' + (m || '') + '</em></i>' + d + '</div>').join('') + '</div>');
    h += grp('10 月', '<div class="heat"><div class="wd">' + '一二三四五六日'.split('').map(x => '<span>' + x + '</span>').join('') + '</div><div class="cells">' +
      '<i class="pad3"></i><i class="pad3"></i><i class="pad3"></i>' +   // 2026-10-01 是周四
      T.month.map((m, i) => '<i class="' + (i + 1 > 29 ? 'fut' : m >= 30 ? 'l3' : m >= 18 ? 'l2' : m > 0 ? 'l1' : '') + (i + 1 === 29 ? ' today' : '') + '" title="10 月 ' + (i + 1) + ' 日 · ' + m + ' 分钟">' + (i + 1) + '</i>').join('') +
      '</div><div class="lg"><span>少</span><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><span>多</span></div></div>');
    h += '<div class="tiles">' + [['check', T.totals.secs, '学完的小节'], ['cards', S.cards.length, '闪卡'], ['question', T.totals.asks, '次提问'], ['branch', T.totals.detours, '次岔路']].map(([ic, n, l]) => '<div class="card">' + T3(ic, 'sm') + '<b class="n">' + n + '</b><span>' + l + '</span></div>').join('') + '</div>';
    h += grp('每本书', S.books.map(b => '<div class="row">' + cover(b, 'xs') + '<span class="grow"><b>' + esc(b.title) + '</b><div class="bar" style="margin-top:8px"><i style="width:' + bookPct(b) + '%"></i></div></span><span class="val n">' + (b.id === 'aima' ? doneCount() + '/' + leafSecs().length : '—') + '</span></div>').join(''));
    h += grp('每日目标', row({ t: '每天学习', d: '达成后「连续学习」加一天', right: segHtml([['10', '10'], ['20', '20'], ['30', '30']], String(S.goal), k => { S.goal = +k; refresh(); }, 'width:132px;flex:none') }) +
      row({ t: '每天提醒', d: '21:00 · 本机通知，不联网', right: swHtml(S.remind !== false, () => { S.remind = S.remind === false; refresh(); showToast(S.remind === false ? '已关闭提醒' : '每天 21:00 提醒你', 'ok'); }, '每天提醒') }),
      '时长只统计听讲和读书页在前台的时间。');
    return h;
  }
};
