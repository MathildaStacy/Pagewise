/* Pagewise Meta 风原型 · 听讲 / 读书页面：顶栏、快拍式路线图、thread、Messenger 式快捷动作与输入框、原文预览、AI 看到的内容 */
'use strict';
SCREENS.study = {
  title: () => secName(ST().sec), sub: () => '人工智能：现代方法 · ' + pagesOf(ST().sec), short: () => ST().mode === 'read' ? '读书' : '听讲',
  right: () => modeSwitch(ST().mode, () => setMode(ST().mode === 'read' ? 'listen' : 'read')) + '<button class="nb" aria-label="更多" onclick="studyMenu()">' + I('more') + '</button>',
  top() {
    const st = ST();
    if (st.mode === 'read') return readTool(st.sec);
    let h = '<div class="prog"><span>第 ' + (st.cur + 1) + '/' + st.n + ' 步' + (st.phase === 'ready' ? ' · 本节讲完了' : '') + '</span><button onclick="openCtx()">AI 看到的内容' + I('chev') + '</button></div>';
    h += '<div class="rail" role="tablist" aria-label="本节路线图">' + st.steps.map((s, i) => {
      const x = st.ss[i] === 'now' && st.phase !== 'resume' ? 'now' : st.ss[i] === 'now' ? 'todo' : st.ss[i];
      return '<button class="step ' + x + '" onclick="' + on(() => tapStep(i)) + '" aria-label="第 ' + (i + 1) + ' 步 ' + esc(s.t) + ' ' + { done: '已讲', now: '当前', skipped: '跳过', todo: '未讲' }[x] + '"><span class="ic">' + (x === 'done' ? I('check') : x === 'skipped' ? I('skip') : (i + 1)) + '</span><span class="t">' + esc(s.t) + '</span></button>';
    }).join('') + '</div>';
    if (st.detour) h += '<div class="banner">' + I('branch') + '<span class="grow"><small>' + (st.detour.reviewing ? '复习卡点 · 岔路' : '岔路') + '</small>' + esc(secName(st.detour.sec)) + '</span><button onclick="' + on(() => st.detour.reviewing ? reviewOk() : backMain()) + '">回到主线 ' + st.sec + '</button></div>';
    return h;
  },
  render() {
    const st = ST();
    if (st.mode === 'read') return readerBody(st.sec);
    return '<div class="thread">' + st.msgs.filter(m => !m.old || st.histOpen).map(item).join('') + '</div>';
  },
  dock() {
    const st = ST();
    if (st.mode !== 'listen') return '';
    const chips = quickActions(st), qb = st.quote ? BLK[st.quote] : null;
    return (chips.length ? '<div class="chips">' + chips.map(([l, f, c]) => '<button class="chip ' + (c || '') + '" onclick="' + on(f) + '">' + (c === 'pri' ? I('next') : '') + l + '</button>').join('') + '</div>' : '') +
      (qb ? '<div class="qbar"><b>引用 p.' + qb.p + '</b><span class="grow">' + esc(plain(qb.x)) + '</span><button aria-label="取消引用" onclick="' + on(() => { st.quote = null; refresh(); }) + '">' + I('close') + '</button></div>' : '') +
      '<form class="composer" onsubmit="' + on(e => { e.preventDefault(); sendText(); }) + '"><input id="cin" autocomplete="off" aria-label="提问" placeholder="' + (st.detour ? '在岔路里继续问，或说「回到主线」' : '不懂就问…') + '">' +
      '<button type="button" class="mic" aria-label="语音提问" onclick="' + on(() => showToast('语音提问：按住说话（M5）')) + '">' + I('mic') + '</button>' +
      (st.busy ? '<button type="button" class="send stop" aria-label="停止" onclick="stopAnswer()">' + I('stop') + '</button>' : '<button class="send" aria-label="发送">' + I('send') + '</button>') + '</form>';
  },
  after(p, reset) {
    const st = ST();
    const cr = $('.rail .step.now'); if (cr) cr.parentNode.scrollLeft = Math.max(0, cr.offsetLeft - 60);
    if (st.mode === 'listen' && reset) { const v = $('#view'); v.scrollTop = v.scrollHeight; }
    if (st.focus) { const f = st.focus; st.focus = null; if (st.mode === 'read') flashBlock(f); else setTimeout(() => setMode('listen', f), 0); }
    if (st.mode === 'listen' && st.quote && reset) { const t = $('#cin'); if (t) t.focus(); }
    if (reset && st.phase === 'teach' && !st.busy && !st.msgs.some(m => m.k === 'head' && !m.old)) startSection();
  }
};

// 快捷动作规则（03 §5.3）：第一个是主操作
function quickActions(st) {
  if (st.detour && st.detour.reviewing) return [['清楚了，继续 ' + st.sec, reviewOk, 'dt'], ['还是不太懂', reviewAgain]];
  if (st.detour) return [['回到主线 ' + st.sec, () => backMain(), 'dt'], ['看 ' + st.detour.sec + ' 原文', () => go('reader', { sec: st.detour.sec })]];
  if (st.phase === 'resume') return [];
  const alt = [['换个说法', () => actAlt('re')], ['举个例子', () => actAlt('ex')]];
  if (st.msgs.some(m => m.k === 'quiz' && m.pick == null)) return alt.concat([['看原文', actSource]]);
  if (st.phase === 'ready') return [['懂了，下一节', finishSection, 'pri'], ['再讲一遍这一节', () => showToast('原型里不演示重讲')], ['看原文', actSource]];
  const last = nextIndex(st) < 0, step = st.steps[st.cur] || {};
  const hasEq = step.blocks && step.blocks.some(id => BLK[id].t === 'eq' || /\$/.test(BLK[id].x));
  const c = [[last ? '懂了' : '懂了，下一步', actNext, 'pri']].concat(alt);
  if (step.kind === 'derivation' || step.kind === 'definition' || hasEq) c.push(['展开推导', () => actAlt('dv')]);
  if (!last) c.push(['这步熟，跳过', actSkip]);
  return c.concat([['考考我', actQuiz], ['看原文', actSource]]);
}

// ---------- thread 项 ----------
function item(m) {
  const st = ST(), en = m.enter ? ' enter' : ''; m.enter = false;
  const body = () => m.shown != null ? md(m._at.slice(0, m.shown).join(''), m.allowed) + '<span class="caret"></span>' : md(m.t, m.allowed || allowedMain());
  switch (m.k) {
    case 'hist': return '<button class="hist' + (st.histOpen ? ' o' : '') + '" aria-expanded="' + st.histOpen + '" onclick="' + on(() => { st.histOpen = !st.histOpen; refresh(); }) + '">' + esc(m.label) + I('chevDown') + '</button>';
    case 'sys': return '<div class="sys' + en + '">' + esc(m.t) + '</div>';
    case 'head': { const s = st.steps[m.i]; return '<div class="head' + en + '" id="step-' + m.i + '"><span class="sn">第 ' + (m.i + 1) + ' 步</span><b>' + esc(s.t) + '</b><span class="pg">' + s.p + '</span></div>'; }
    case 'ai': return '<div class="ai' + (m.dt ? ' dt' : '') + en + '" id="b-' + m.id + '">' + body() + '</div>';
    case 'user': return '<div class="user' + (m.dt ? ' dt' : '') + en + '">' + (m.quote ? '<span class="q">p.' + BLK[m.quote].p + ' · ' + esc(plain(BLK[m.quote].x).slice(0, 36)) + '…</span>' : '') + esc(m.t) + '</div>';
    case 'tool': return '<div class="tool' + (m.dt ? ' dt' : '') + en + '">' + m.lines.slice(0, m.n == null ? 99 : m.n).map((x, k) => '<span class="' + (m.n != null && k === m.n - 1 && m.n <= m.lines.length ? 'run' : '') + '">' + I('book') + esc(x) + '</span>').join('') + '</div>';
    case 'src': { const b = BLK[m.b]; return '<button class="src' + en + '" onclick="' + on(() => peek(m.b)) + '"><span class="lbl">' + I('book') + '原文 · p.' + b.p + '</span><span class="q">' + blockText(b) + '</span></button>'; }
    case 'derive': return '<div class="aux derive' + en + '"><span class="lbl">' + I('derive') + '补充推导</span><div class="bd" id="b-' + m.id + '">' + body() + '</div></div>';
    case 'ex': return '<div class="aux ex' + en + '"><span class="lbl">' + I('spark') + 'AI 举例</span><div class="bd" id="b-' + m.id + '">' + body() + '</div></div>';
    case 'check': return '<div class="card check' + en + '"><span class="lbl">' + I('question') + '检查一下</span>' + esc(m.t) + '</div>';
    case 'resume': {
      const sk = S.stuck.find(x => x.id === 's1');
      return '<div class="card resume' + en + '"><span class="lbl">' + I('clock') + '接着上次 · 距上次 ' + S.daysAway + ' 天</span><p>上次讲完了第 1 步「' + esc(st.steps[0].t) + '」：<b>f(n) = g(n) + h(n)</b>。</p>' +
        (sk && !sk.ok ? '<p>你在 3.4.2 有一个卡点还没解决：「' + esc(sk.x) + '」。A* 也会用到它。</p><p>要先花两分钟复习这个卡点吗？</p>' : '') +
        (st.phase === 'resume' && !m.done ? '<div class="btns"><button class="btn sm pri" onclick="resumeGo()">直接讲第 2 步</button>' + (sk && !sk.ok ? '<button class="btn sm" onclick="resumeReview()">先复习卡点</button>' : '') + '</div>' : '') + '</div>';
    }
    case 'quiz': {
      const qz = QUIZ[st.sec][m.qi];
      return '<div class="card quiz' + en + '"><span class="lbl acc">' + I('question') + (m.final ? '本节小测' : '考考你 · 第 ' + (m.qi + 1) + ' 步') + '</span><div class="q">' + esc(qz.q) + '</div>' +
        qz.ops.map((o, k) => { const s = m.pick == null ? '' : k === qz.ans ? 'right' : k === m.pick ? 'wrong' : 'muted'; return '<button class="op ' + s + '" ' + (m.pick == null ? '' : 'aria-disabled="true" ') + 'onclick="' + on(() => answerQuiz(m, k)) + '"><span class="k">' + (s === 'right' ? I('check') : s === 'wrong' ? I('close') : 'ABC'[k]) + '</span>' + esc(o) + '</button>'; }).join('') + '</div>';
    }
    case 'prop':
      return '<div class="card prop' + en + '"><span class="lbl">' + I('flag') + 'AI 建议 · 记为卡点</span>「' + esc(m.x) + '」<div class="btns">' + (m.done ? '<span class="muted" style="font-size:13px">' + (m.done === 'yes' ? '已记下，会出现在复习的卡点清单里' : '已忽略') + '</span>' :
        '<button class="btn sm pri" onclick="' + on(() => { m.done = 'yes'; S.stuck.unshift({ id: 's' + Date.now(), sec: m.sec, x: m.x, ok: false }); refresh(); }) + '">记下</button><button class="btn sm" onclick="' + on(() => { m.done = 'no'; st.stuckCand = st.stuckCand.filter(x => x !== m.x); refresh(); }) + '">不用</button>') + '</div></div>';
    case 'fold': return '<div class="fold' + (m.open ? ' open' : '') + en + '"><button class="fold-h" aria-expanded="' + !!m.open + '" onclick="' + on(() => { m.open = !m.open; refresh(); }) + '">' + I('check') + '<span class="grow">已解决：' + esc(m.title) + '</span><span class="cnt">' + m.items.length + ' 条</span>' + I('chev') + '</button>' + (m.open ? '<div class="fold-b">' + m.items.map(item).join('') + '</div>' : '') + '</div>';
    case 'detour': return '<div class="detour-run">' + m.d.items.map(item).join('') + '</div>';
    case 'done': { const d = st.ss.filter(x => x === 'done').length, sk = st.ss.filter(x => x === 'skipped').length;
      return '<div class="card donecard' + en + '"><span class="lbl">' + I('check') + '本节讲完了</span>' + st.n + ' 步里讲了 ' + d + ' 步' + (sk ? '，跳过 ' + sk + ' 步' : '') + '。点「懂了，下一节」生成摘要和闪卡草稿。</div>'; }
    case 'typing': return '<div class="typing" aria-label="正在回答"><i></i><i></i><i></i></div>';
  }
  return '';
}
const allowedMain = () => blocksOfSec(ST().sec).map(b => b.id);
const blockText = b => b.t === 'eq' ? '<span class="math">' + esc(plain(b.x)) + '</span>' : inline(b.x);

// ---------- 原文预览（点引用胶囊） ----------
function peek(id) {
  const b = BLK[id], st = ST(), main = b.sec === st.sec;
  const same = BLOCKS.filter(x => x.p === b.p && x.sec === b.sec);
  const body = '<div class="peek">' + (same[0].t !== 'title' ? '<div class="pblk b-title" style="font-family:var(--sf);font-weight:700">' + esc(secName(b.sec)) + '</div>' : '') +
    same.map(x => '<div class="pblk' + (x.t === 'title' ? ' b-title' : x.t === 'eq' ? ' b-eq' : '') + (x.id === id ? ' tgt' : '') + '">' + (x.t === 'image' ? figHtml(x.fig) : x.t === 'eq' ? '<span class="math blk">' + esc(plain(x.x)) + '</span>' : inline(x.x)) + '</div>').join('') + '<div class="pno">— ' + b.p + ' —</div></div>';
  sheet({ title: '原书 p.' + b.p, sub: main ? esc(secName(b.sec)) + ' · 高亮的是被引用的段落' : esc(secName(b.sec)) + ' · 岔路里读过的原文', body,
    acts: main ? [['在读书模式打开', () => { closeOverlay(true); openBlock(id); }, 'pri'], ['关闭', closeOverlay]] : [['好的', closeOverlay, 'pri']] });
  const t = $('.peek .tgt'); if (t) t.scrollIntoView({ block: 'center' });
}

// ---------- 更多 ----------
function studyMenu() {
  const st = ST();
  sheet({ title: secName(st.sec), sub: '人工智能：现代方法', body: '<div class="list ic">' +
    row({ t: '书的地图', d: '全书目录、进度和每节状态', ic: ['map', 'var(--tint)'], fn: () => { closeOverlay(true); const p = R.stack[R.stack.length - 2]; if (p && p.name === 'map') back(); else go('map', { book: 'aima' }); } }) +
    row({ t: '本节笔记', d: '摘要、问答、卡点、高亮', ic: ['note', 'var(--orange)'], fn: () => go('noteDetail', { sec: st.sec }) }) +
    row({ t: 'AI 看到的内容', d: '本轮上下文和 token', ic: ['layers', 'var(--indigo)'], fn: () => { closeOverlay(true); openCtx(); } }) +
    row({ t: '结束本节', d: '生成摘要、卡点和闪卡草稿', ic: ['check', 'var(--green)'], fn: () => { closeOverlay(true); finishSection(); } }) + '</div>' });
}
function openCtx() {
  const L = ctxLayers(), tot = L.reduce((a, x) => a + x.t, 0), cached = L.filter(x => x.c).reduce((a, x) => a + x.t, 0);
  const svc = S.ai.services.find(s => s.id === S.ai.teach.split(':')[0]);
  sheet({ title: 'AI 看到的内容', sub: '本轮请求 · 预计输入 token', body: '<div class="stack">' + L.map(x => '<i style="flex:' + x.t + ';background:' + x.col + '"></i>').join('') + '</div><div class="list">' +
    L.map(x => '<div class="row"><span class="sq" style="background:' + x.col + '"></span><span class="grow"><b style="font-size:15px">' + x.k + (x.c ? ' <span class="tag acc">缓存</span>' : '') + '</b><small>' + esc(x.d) + '</small></span><span class="tk">' + (x.t / 1000).toFixed(1) + 'k</span></div>').join('') +
    '<div class="row"><span class="sq"></span><span class="grow"><b style="font-size:15px;font-weight:600">合计</b><small>其中 ' + (cached / 1000).toFixed(1) + 'k 命中缓存 · ' + esc(svc.name) + ' · ' + S.ai.teach.split(':')[1] + '</small></span><span class="tk" style="color:var(--label);font-weight:600">' + (tot / 1000).toFixed(1) + 'k</span></div></div>' +
    '<div class="grp-f" style="padding:8px 4px 4px">上一轮实际：输入 3.1k · 缓存读 4.2k · 输出 0.6k</div><div class="note" style="margin-top:8px">AI 只能引用这里列出的原文。你问到别的小节时，它会先读取那一节，再回答。</div>' });
}
