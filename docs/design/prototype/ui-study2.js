/* Pagewise 原型 · 伴读（二）：界面、上下文面板、本节小结 */
'use strict';
function openCite(id) { go('reader', { block: id }); }

SCREENS.study = {
  title: () => { const st = ST(); return esc(secName(st.sec)) + '<span class="sub">人工智能：现代方法 · ' + pagesOf(st.sec) + '</span>'; },
  navRight: () => '<button class="tb" onclick="' + on(() => go('reader', { sec: ST().detour || ST().sec })) + '">原文</button><button class="ib" aria-label="更多" onclick="studyMenu()">⋯</button>',
  top() {
    const st = ST();
    const doneN = st.phase === 'resume' ? 1 : st.part + (st.phase === 'ready' ? 1 : 0);
    let h = '<div class="stbar"><div class="l1"><span>第 ' + (st.part + 1) + '/' + st.n + ' 段</span><div class="pts">' + PARTS[st.sec].map((_, i) => '<i class="' + (i < doneN ? 'done' : i === st.part && st.phase !== 'resume' ? 'cur' : '') + '"></i>').join('') + '</div><button class="ctxb" onclick="openCtx()">AI 看到的内容 ›</button></div></div>';
    if (st.detour) h += '<div class="dtbar"><span class="dot"></span><div class="grow"><b>岔路</b> · ' + esc(secName(st.detour)) + '</div><button onclick="' + on(() => backMain()) + '">回到主线 ' + st.sec + '</button></div>';
    return h;
  },
  render() {
    const st = ST(), sc = SCRIPT[st.sec];
    let h = '<div class="chat">';
    st.msgs.forEach((m, i) => {
      if (m.old && !st.histOpen) return;
      if (m.r === 'hist') { h += '<button class="hist" onclick="' + on(() => { st.histOpen = !st.histOpen; refresh(); }) + '">' + m.label + (st.histOpen ? ' ▴' : ' ▾') + '</button>'; return; }
      if (m.r === 'a') { h += '<div class="m-a' + (m.dt ? ' dt' : '') + '" id="m' + i + '">' + (m.shown != null ? md(m._at.slice(0, m.shown).join(''), m.allowed) + '<span class="caret"></span>' : md(m.text, m.allowed)) + '</div>'; return; }
      if (m.r === 'u') { h += '<div class="m-u' + (m.dt ? ' dt' : '') + '">' + (m.quote ? '<span class="q">p.' + BLK[m.quote].p + ' · ' + esc(BLK[m.quote].x.replace(/\$/g, '').slice(0, 40)) + '…</span>' : '') + esc(m.text) + '</div>'; return; }
      if (m.r === 'steps') { h += '<div class="steps' + (m.dt ? ' dt' : '') + '">' + m.items.slice(0, m.n).map((x, k) => '<span class="' + (k === m.n - 1 && st.busy && i === st.msgs.length - 1 ? 'run' : '') + '">' + esc(x) + '</span>').join('') + '</div>'; return; }
      if (m.r === 'divd') { h += '<div class="divd' + (m.dt ? ' dt' : '') + '">' + esc(m.text) + '</div>'; return; }
      if (m.r === 'resume') {
        const sk = S.stuck.find(x => x.id === 's1');
        h += '<div class="resume"><div class="h">续学 · 距上次 ' + S.daysAway + ' 天</div><p>上次讲完了 A* 的第 1 段：<b>f(n) = g(n) + h(n)</b> 的直觉。</p>' + (sk && !sk.ok ? '<p>你在 3.4.2 有一个卡点还没解决：「' + esc(sk.x) + '」。A* 也会用到它。</p>' : '') + '<p>要先花两分钟复习这个卡点吗？</p>' +
          (st.phase === 'resume' && !m.done ? '<div class="bt"><button class="btn sm pri" onclick="resumeGo()">直接继续第 2 段</button>' + (sk && !sk.ok ? '<button class="btn sm ghost" onclick="resumeReview()">先复习卡点</button>' : '') + '</div>' : '') + '</div>';
        return;
      }
      if (m.r === 'quiz') {
        const qz = sc.quiz[m.qi];
        h += '<div class="quiz"><div class="h">' + (m.final ? '本节小测' : '检查一下 · 第 ' + (m.qi + 1) + ' 段') + '</div><div class="q">' + esc(qz.q) + '</div>' +
          qz.ops.map((o, k) => '<button class="op ' + (m.pick == null ? '' : k === qz.ans ? 'right' : k === m.pick ? 'wrong' : '') + '" onclick="' + on(() => answerQuiz(m, k)) + '">' + 'ABC'[k] + '. ' + esc(o) + '</button>').join('') + '</div>';
        return;
      }
      if (m.r === 'prop') {
        h += '<div class="prop"><div class="h">AI 建议 · 记为卡点</div>「' + esc(m.x) + '」<div style="display:flex;gap:8px;margin-top:8px">' + (m.done ? '<span class="muted" style="font-size:12px">' + (m.done === 'yes' ? '已记下，会出现在复习的卡点清单里' : '已忽略') + '</span>' :
          '<button class="btn sm pri" onclick="' + on(() => { m.done = 'yes'; S.stuck.unshift({ id: 's' + Date.now(), sec: m.sec, x: m.x, ok: false }); refresh(); }) + '">记下</button><button class="btn sm ghost" onclick="' + on(() => { m.done = 'no'; ST().stuckCand = ST().stuckCand.filter(x => x !== m.x); refresh(); }) + '">不用</button>') + '</div></div>';
      }
    });
    return h + '</div>';
  },
  bottom() {
    const st = ST(), sc = SCRIPT[st.sec];
    let chips = [];
    if (st.reviewing) chips = [['清楚了，继续 A*', 'reviewOk()', 'dt'], ['还是不太懂', 'reviewAgain()']];
    else if (st.detour) chips = [['回到主线 ' + st.sec, 'backMain()', 'dt'], ['看 ' + st.detour + ' 原文', 'goReaderDetour()']];
    else if (st.phase === 'teach') {
      chips = [['懂了，继续', 'actNext()', 'pri'], ['换个说法', 'actAlt()'], ['举个例子', 'actExample()']];
      if (sc && sc.derive[st.part]) chips.push(['展开推导', 'actDerive()']);
      chips.push(['考考我', 'actQuiz()'], ['看原文', 'goReaderPart()']);
    } else if (st.phase === 'quiz') chips = [['换个说法', 'actAlt()'], ['举个例子', 'actExample()'], ['看原文', 'goReaderPart()']];
    else if (st.phase === 'ready') chips = [['懂了，下一节', 'finishSection()', 'pri'], ['再讲一遍这一节', 'showToast(\'原型里不演示重讲\')'], ['看原文', 'goReaderPart()']];
    const qb = st.quote ? BLK[st.quote] : null;
    return (chips.length ? '<div class="qa">' + chips.map(([l, f, c]) => '<button class="' + (c || '') + '" onclick="' + f + '">' + l + '</button>').join('') + '</div>' : '') +
      (qb ? '<div class="quote"><span>引用</span><div class="grow">p.' + qb.p + ' · ' + esc(qb.x.replace(/\$/g, '')) + '</div><button class="ib" style="width:24px;height:24px;font-size:14px" onclick="' + on(() => { st.quote = null; refresh(); }) + '">✕</button></div>' : '') +
      '<div class="composer"' + (chips.length ? '' : ' style="border-top:1px solid var(--line)"') + '><textarea id="cin" class="in" rows="1" placeholder="' + (st.detour ? '在岔路里继续问，或说「回到主线」' : '不懂就问…') + '" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendText()}"></textarea><button class="snd" aria-label="发送" onclick="sendText()">↑</button></div>';
  },
  after(p, reset) {
    const v = $('#view'); if (reset) v.scrollTop = v.scrollHeight;
    if (ST().quote && reset) { const t = $('#cin'); if (t) t.focus(); }
  }
};
function goReaderPart() { const st = ST(); const b = partBlocks(st.sec, st.part)[0]; go('reader', b ? { block: b, part: true } : { sec: st.sec }); }
function goReaderDetour() { go('reader', { sec: ST().detour }); }
function studyMenu() {
  const st = ST();
  sheet('伴读', '<div class="row tap" onclick="' + on(() => go('map', { book: 'aima' })) + '"><div class="grow">书的地图<small>全书目录、进度和每节状态</small></div><span class="chev"></span></div>' +
    '<div class="row tap" onclick="' + on(() => go('noteDetail', { sec: st.sec })) + '"><div class="grow">本节笔记<small>摘要、问答、卡点、高亮</small></div><span class="chev"></span></div>' +
    '<div class="row tap" onclick="' + on(() => { closeOverlay(); openCtx(); }) + '"><div class="grow">AI 看到的内容<small>本轮上下文和 token</small></div><span class="chev"></span></div>' +
    '<div class="row tap" onclick="' + on(() => { closeOverlay(); if (!SCRIPT[st.sec]) return showToast('原型的讲解脚本只写到 3.5.2'); finishSection(); }) + '"><div class="grow">结束本节<small>生成摘要、卡点和闪卡草稿</small></div><span class="chev"></span></div>');
}

// ---------- AI 看到的内容 ----------
function openCtx() {
  const L = ctxLayers(), tot = L.reduce((a, x) => a + x.t, 0), cached = L.filter(x => x.c).reduce((a, x) => a + x.t, 0);
  const svc = S.ai.services.find(s => s.id === S.ai.teach.split(':')[0]);
  sheet('AI 看到的内容', '<div class="stack">' + L.map(x => '<i style="flex:' + x.t + ';background:' + x.col + '"></i>').join('') + '</div>' +
    '<div class="ctxl">' + L.map(x => '<div class="it"><span class="sq" style="background:' + x.col + '"></span><div class="grow">' + x.k + (x.c ? ' <span class="tag acc">缓存</span>' : '') + '<small>' + esc(x.d) + '</small></div><span class="tk">' + (x.t / 1000).toFixed(1) + 'k</span></div>').join('') +
    '<div class="it" style="border:0;font-weight:600"><span class="sq"></span><div class="grow">合计<small>其中 ' + (cached / 1000).toFixed(1) + 'k 命中缓存 · ' + esc(svc.name) + ' · ' + S.ai.teach.split(':')[1] + '</small></div><span class="tk">' + (tot / 1000).toFixed(1) + 'k</span></div></div>' +
    '<div class="sb"><div class="note">AI 只能引用这里列出的原文。你问到别的小节时，它会先读取那一节，再回答。</div></div>', '本轮请求 · 预计输入 token');
}

// ---------- 本节小结 ----------
function finishSection() { if (!guard()) return; go('done'); }
const DRAFT = {
  summary: 'A* 用 f(n) = g(n) + h(n) 选择扩展节点；h 可容许（从不高估）时 A* 代价最优。一致性是更强的条件（三角不等式），一致时状态第一次被扩展就是最优路径。在同样的信息下，A* 是最优高效的。',
  cards: [
    { f: 'A* 的评价函数是什么？各项含义？', b: 'f(n) = g(n) + h(n)：g 是从起点到 n 的已走代价，h 是从 n 到目标的估计代价。' },
    { f: '什么是可容许的启发式函数？', b: '从不高估到达目标的真实代价（乐观）。h 可容许时，A* 代价最优。' },
    { f: '一致性的定义？和可容许的关系？', b: 'h(n) ≤ c(n, a, n′) + h(n′)。一致 ⇒ 可容许，反之不一定。' },
    { f: 'h(n) ≡ 0 时 A* 变成什么？', b: '一致代价搜索（Dijkstra 算法）。', detour: true },
    { f: '最优高效（optimally efficient）指什么？', b: '在同一启发式、保证最优的算法中，A* 扩展的节点数几乎最少。' }
  ]
};
SCREENS.done = {
  title: '本节小结',
  render(p) {
    const st = ST();
    if (!p.d) {
      const dt = st.detourLog.length > 0;
      p.d = { summary: DRAFT.summary, cards: DRAFT.cards.map(c => Object.assign({ on: !c.detour || dt }, c)).filter(c => !c.detour || dt).slice(0, 5), stuck: st.stuckCand.filter(x => !S.stuck.some(y => y.x === x && !y.ok)).map(x => ({ x, on: true })) };
      if (!p.d.stuck.length) p.d.stuck.push({ x: '可容许和一致性的区别', on: false });
    }
    const d = p.d;
    let h = '<div class="done-hero"><div class="k">' + esc(secName(chapterOf(st.sec).id)) + '</div><div class="t">' + esc(secName(st.sec)) + ' · 讲完了</div><div style="font-size:12px;opacity:.85;margin-top:4px">' + st.n + ' 段 · ' + st.msgs.filter(m => m.r === 'u' && !m.old).length + ' 次提问 · 岔路 ' + st.detourLog.length + ' 次</div></div>';
    h += '<div class="sec"><div class="sec-h">摘要 <small>AI 起草，可以改</small></div><div style="padding:0 14px 12px"><textarea class="edt" oninput="' + on(e => { d.summary = e.target.value; }) + '">' + esc(d.summary) + '</textarea></div></div>';
    h += '<div class="sec"><div class="sec-h">卡点 <small>没完全掌握的地方</small></div>' + d.stuck.map(s => '<div class="ck' + (s.on ? ' on' : '') + '" onclick="' + on(() => { s.on = !s.on; refresh(); }) + '"><span class="bx">' + (s.on ? '✓' : '') + '</span><div class="grow">' + esc(s.x) + '</div></div>').join('') + '</div>';
    h += '<div class="sec"><div class="sec-h">闪卡 <small>勾选的会加入复习</small></div>' + d.cards.map(c => '<div class="ck' + (c.on ? ' on' : '') + '" onclick="' + on(() => { c.on = !c.on; refresh(); }) + '"><span class="bx">' + (c.on ? '✓' : '') + '</span><div class="grow">' + esc(c.f) + (c.detour ? ' <span class="tag dt">来自岔路</span>' : '') + '<small>' + esc(c.b) + '</small></div></div>').join('') + '</div>';
    if (st.detourLog.length) h += '<div class="sec"><div class="sec-h">岔路记录</div>' + st.detourLog.map(x => '<div class="row"><div class="grow"><b>' + esc(x.q) + '</b><small>已记入 ' + esc(secName(x.sec)) + ' 的笔记</small></div></div>').join('') + '</div>';
    const nx = '3.5.3';
    h += '<div style="padding:6px 14px 22px"><button class="btn pri block" onclick="' + on(() => saveSection(d, nx)) + '">保存，开始 ' + nx + ' ' + esc(S.sec[nx].title) + '</button><div class="muted" style="font-size:12px;text-align:center;margin-top:8px">保存后主线进度移到 ' + nx + '</div></div>';
    return h;
  }
};
function saveSection(d, nx) {
  const st = ST(), s = S.sec[st.sec];
  s.status = 'done'; s.summary = d.summary;
  const cards = d.cards.filter(c => c.on), stuck = d.stuck.filter(x => x.on);
  cards.forEach((c, i) => S.cards.push({ id: 'n' + Date.now() + i, sec: st.sec, f: c.f, b: c.b, box: 1, due: 1 }));
  stuck.forEach((x, i) => { if (!S.stuck.some(y => y.x === x.x && !y.ok)) S.stuck.unshift({ id: 'sn' + Date.now() + i, sec: st.sec, x: x.x, ok: false }); });
  S.sec[nx].status = 'learning';
  S.study = { sec: nx, part: 0, n: PARTS[nx].length, msgs: [{ r: 'divd', text: st.sec + ' 已学完 · 新增 ' + cards.length + ' 张闪卡' + (stuck.length ? '、' + stuck.length + ' 个卡点' : '') }], detour: null, phase: 'teach', busy: false, quizRight: false, stuckCand: [], detourLog: [], quote: null };
  S.daysAway = 0;
  showToast('已保存，进度移到 ' + nx, 'ok');
  replace('study');
  teachPart(0);
}
