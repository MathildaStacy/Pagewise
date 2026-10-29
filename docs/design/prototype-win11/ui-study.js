/* Pagewise Win11 风原型 · 听讲 / 读书页面：SelectorBar（读书 | 听讲 + AI 看到的内容）、步骤卡片、岔路条、Copilot 式 thread、快捷动作 + 彩虹输入框、原文预览、路线图、AI 看到的内容 */
'use strict';
const KIND = { intuition: '直觉', definition: '定义', derivation: '推导', example: '例子', proof: '证明' };
SCREENS.study = {
  title: () => secName(ST().sec), sub: () => '人工智能：现代方法 · ' + pagesOf(ST().sec), short: () => ST().mode === 'read' ? '读书' : '听讲',
  right: () => '<button class="ib" aria-label="更多" onclick="studyMenu()">' + I('more') + '</button>',
  top() {
    const st = ST();
    const ctx = '<button class="ctx" onclick="openCtx()" title="本轮请求里 AI 能看到的原文和记录"><i></i>AI 看到的内容' + I('chev') + '</button>';
    let h = modeBar(st.mode, () => setMode(st.mode === 'read' ? 'listen' : 'read'), st.mode === 'listen' ? ctx : '');
    if (st.mode === 'read') return h + readTool(st.sec);
    if (!S.flags.noAI) h += stepper(st);
    if (st.detour) h += '<div class="banner">' + '<span class="bi">' + I('branch') + '</span><span class="grow"><small>' + (st.detour.reviewing ? '复习卡点 · 岔路' : '岔路') + '</small>' + esc(secName(st.detour.sec)) + '</span><button class="btn sm dt" onclick="' + on(() => st.detour.reviewing ? reviewOk() : backMain()) + '">回到主线 ' + st.sec + '</button></div>';
    return h;
  },
  render() {
    const st = ST();
    if (st.mode === 'read') return readerBody(st.sec);
    const list = st.msgs.filter(m => !m.old || st.histOpen);
    if (S.flags.noAI) return '<div class="thread">' + '<div class="card noai enter">' + T3('cpu') + '<div class="grow"><b>还没有配置 AI 服务</b><span>听讲需要一个 AI 服务来讲解。读书模式照常可用。</span><div class="btns"><button class="btn sm pri" onclick="go(\'meAI\')">去配置</button><button class="btn sm" onclick="setMode(\'read\')">先读原文</button></div></div></div></div>';
    return '<div class="thread">' + whoMark(list).map(item).join('') + '</div>';
  },
  dock() {
    const st = ST();
    if (st.mode !== 'listen') return '';
    const chips = S.flags.noAI ? [] : quickActions(st), qb = st.quote ? BLK[st.quote] : null;
    return (chips.length ? '<div class="chips">' + chips.map(([l, f, c, ic]) => '<button class="chip ' + (c || '') + '" onclick="' + on(f) + '">' + (ic ? I(ic) : '') + l + '</button>').join('') + '</div>' : '') +
      (qb ? '<div class="qbar"><b>' + I('book') + '引用 p.' + qb.p + '</b><span class="grow">' + esc(plain(qb.x)) + '</span><button aria-label="取消引用" onclick="' + on(() => { st.quote = null; refresh(); }) + '">' + I('close') + '</button></div>' : '') +
      '<form class="composer' + (S.flags.noAI ? ' off' : '') + '" onsubmit="' + on(e => { e.preventDefault(); sendText(); }) + '"><div class="glow"></div><div class="box">' +
      '<button type="button" class="ib" aria-label="添加" onclick="addMenu()">' + I('add') + '</button>' +
      '<input id="cin" autocomplete="off" aria-label="提问"' + (S.flags.noAI ? ' disabled placeholder="先配置 AI 服务"' : ' placeholder="' + (st.detour ? '在岔路里继续问，或说「回到主线」' : '问点什么，或说「讲慢一点」') + '"') + '>' +
      '<button type="button" class="ib" aria-label="语音提问" onclick="' + on(() => showToast('语音提问：按住说话（M5）')) + '">' + I('mic') + '</button>' +
      (st.busy ? '<button type="button" class="send stop" aria-label="停止" onclick="stopAnswer()">' + I('stop') + '</button>' : '<button class="send" aria-label="发送">' + I('send') + '</button>') + '</div></form>';
  },
  after(p, reset) {
    const st = ST();
    if (st.mode === 'listen' && reset) { const v = $('#view'); v.scrollTop = v.scrollHeight; }
    if (st.focus) { const f = st.focus; st.focus = null; if (st.mode === 'read') flashBlock(f); else setTimeout(() => setMode('listen', f), 0); }
    if (st.mode === 'listen' && st.quote && reset) { const t = $('#cin'); if (t) t.focus(); }
    if (reset && !S.flags.noAI && st.phase === 'teach' && !st.busy && !st.msgs.some(m => m.k === 'head' && !m.old)) startSection();
  }
};
// 步骤卡片（StepProgress）：上行「第 k 步 + 步名 + 页码 + 路线图按钮」，中间分段条（已讲强调色、当前彩虹、跳过虚线），下行步名（可点）
function stepper(st) {
  const show = i => st.ss[i] === 'now' && st.phase === 'resume' ? 'todo' : st.ss[i];
  const k = st.phase === 'ready' ? st.n - 1 : st.cur, s = st.steps[k] || {};
  return '<div class="card stepper"><button class="row1" onclick="openRoadmap()" aria-label="本节路线图"><span class="no">' + (st.phase === 'ready' ? '讲完了' : '第 ' + (k + 1) + '/' + st.n + ' 步') + '</span><b>' + esc(st.phase === 'ready' ? '本节 ' + st.n + ' 步都讲完了' : s.t) + '</b><span class="pg n">' + (s.p || '') + '</span>' + I('list') + '</button>' +
    '<div class="segs">' + st.steps.map((x, i) => '<i class="' + ({ done: 'd', now: 'n', skipped: 'k' }[show(i)] || '') + '"></i>').join('') + '</div>' +
    '<div class="names">' + st.steps.map((x, i) => { const v = show(i); return '<button class="' + ({ done: 'd', now: 'n', skipped: 'k' }[v] || '') + '" onclick="' + on(() => tapStep(i)) + '" aria-label="第 ' + (i + 1) + ' 步 ' + esc(x.t) + ' ' + { done: '已讲', now: '当前', skipped: '跳过', todo: '未讲' }[v] + '">' + esc(x.t.replace(/^A\* 的/, '')) + (v === 'done' ? ' ✓' : '') + '</button>'; }).join('') + '</div></div>';
}
// 本节路线图（03 §5.5 roadmap）：点某步 → 已讲过的滚到那里，没讲过的确认后从那一步讲
function openRoadmap() {
  const st = ST();
  sheet({ title: '本节路线图', sub: secName(st.sec) + ' · ' + st.n + ' 步', body: '<div class="card list road">' + st.steps.map((s, i) => {
    const v = st.ss[i] === 'now' && st.phase === 'resume' ? 'todo' : st.ss[i];
    return '<button class="row tap" onclick="' + on(() => { closeOverlay(true); tapStep(i); }) + '"><span class="rs ' + v + '">' + (v === 'done' ? I('check') : v === 'skipped' ? I('skip') : i + 1) + '</span><span class="grow"><b>' + esc(s.t) + '</b><small>' + (KIND[s.kind] || '') + ' · ' + s.p + ' · ' + { done: '已讲', now: '正在讲', skipped: '跳过了', todo: '还没讲' }[v] + '</small></span>' + chev() + '</button>';
  }).join('') + '</div><div class="grp-f">路线图是开始这一节时 AI 读完原文后定的，每一步对应一段连续的原文。</div>' });
}

// 快捷动作规则（03 §5.3）：第一个是主操作。[文案, 动作, 样式, 图标]
function quickActions(st) {
  if (st.detour && st.detour.reviewing) return [['清楚了，继续 ' + st.sec, reviewOk, 'dt', 'check'], ['还是不太懂', reviewAgain, '', 'question']];
  if (st.detour) return [['回到主线 ' + st.sec, () => backMain(), 'dt', 'branch'], ['看 ' + st.detour.sec + ' 原文', () => go('reader', { sec: st.detour.sec }), '', 'book']];
  if (st.phase === 'resume') return [];
  const alt = [['换个说法', () => actAlt('re'), '', 'alt'], ['举个例子', () => actAlt('ex'), '', 'bulb']];
  if (st.msgs.some(m => m.k === 'quiz' && m.pick == null)) return alt.concat([['看原文', actSource, '', 'book']]);
  if (st.phase === 'ready') return [['懂了，下一节', finishSection, 'pri', 'check'], ['再讲一遍这一节', () => showToast('原型里不演示重讲'), '', 'retry'], ['看原文', actSource, '', 'book']];
  const last = nextIndex(st) < 0, step = st.steps[st.cur] || {};
  const hasEq = step.blocks && step.blocks.some(id => BLK[id].t === 'eq' || /\$/.test(BLK[id].x));
  const c = [[last ? '懂了' : '懂了，下一步', actNext, 'pri', 'check']].concat(alt);
  if (step.kind === 'derivation' || step.kind === 'definition' || hasEq) c.push(['展开推导', () => actAlt('dv'), '', 'derive']);
  if (!last) c.push(['这步熟，跳过', actSkip, '', 'skip']);
  return c.concat([['考考我', actQuiz, '', 'question'], ['看原文', actSource, '', 'book']]);
}
function addMenu() {
  sheet({ title: '添加到问题', body: '<div class="card list">' +
    row({ t: '引用一段原文', d: '切到读书，点一段，选「问 AI」', i3: 'book', fn: () => { closeOverlay(true); setMode('read'); showToast('点一段原文，选「问 AI」'); } }) +
    row({ t: '从卡点里选', d: '让 AI 结合这个卡点回答', i3: 'pin', fn: () => { closeOverlay(true); const t = $('#cin'); if (t) { t.value = '结合我的卡点「' + S.stuck[0].x.slice(0, 12) + '…」讲讲'; t.focus(); } } }) +
    row({ t: '拍一张图', d: '手写推导、书页照片（M5）', i3: 'camera', fn: () => showToast('拍照提问：M5') }) + '</div>' });
}

// ---------- thread 项 ----------
// AI 一轮回答的第一项上方显示「彩虹星芒 + Pagewise」，同一轮后面的项不再重复（Copilot 的样子：AI 回答不加气泡）
const AI_KINDS = ['ai', 'tool', 'src', 'derive', 'ex', 'check', 'prop', 'err'];
function whoMark(list) {
  let prev = null;
  list.forEach(m => { m._who = AI_KINDS.includes(m.k) && !(prev && AI_KINDS.includes(prev.k)) && m.k !== 'prop'; prev = m; });
  return list;
}
const who = (m, label) => m._who ? '<div class="who"><span class="orb">' + I('spark') + '</span>' + (label || 'Pagewise') + (m.dt ? ' <span class="tag dt">岔路</span>' : '') + '</div>' : '';
function item(m) {
  const st = ST(), en = m.enter ? ' enter' : ''; m.enter = false;
  const body = () => m.shown != null ? md(m._at.slice(0, m.shown).join(''), m.allowed) + '<span class="caret"></span>' : md(m.t, m.allowed || allowedMain());
  switch (m.k) {
    case 'hist': return '<button class="sys hist' + (st.histOpen ? ' o' : '') + '" aria-expanded="' + st.histOpen + '" onclick="' + on(() => { st.histOpen = !st.histOpen; refresh(); }) + '">' + esc(m.label) + I('chevDown') + '</button>';
    case 'sys': return '<div class="sys' + en + '">' + esc(m.t) + '</div>';
    case 'head': { const s = st.steps[m.i]; return '<div class="head' + en + (m.old ? ' old' : '') + '" id="step-' + m.i + '"><span class="no">第 ' + (m.i + 1) + ' 步 · ' + (KIND[s.kind] || '') + '</span><b>' + esc(s.t) + '</b><span class="pg n">' + s.p + '</span></div>'; }
    case 'ai': return '<div class="ai' + (m.dt ? ' dt' : '') + (m.old ? ' old' : '') + en + '">' + who(m) + '<div class="md" id="b-' + m.id + '">' + body() + '</div></div>';
    case 'user': return '<div class="user' + (m.dt ? ' dt' : '') + (m.old ? ' old' : '') + en + '">' + (m.quote ? '<span class="q">p.' + BLK[m.quote].p + ' · ' + esc(plain(BLK[m.quote].x).slice(0, 36)) + '…</span>' : '') + esc(m.t) + '</div>';
    case 'tool': return '<div class="ai' + en + '">' + who(m) + '<div class="tool' + (m.dt ? ' dt' : '') + '">' + m.lines.slice(0, m.n == null ? 99 : m.n).map((x, k) => '<span class="' + (m.n != null && k === m.n - 1 && m.n <= m.lines.length ? 'run' : '') + '">' + (m.n != null && k === m.n - 1 && m.n <= m.lines.length ? '<i class="spin"></i>' : I('check')) + esc(x) + '</span>').join('') + '</div></div>';
    case 'src': { const b = BLK[m.b]; return '<div class="ai' + en + '">' + who(m) + '<button class="card src" onclick="' + on(() => peek(m.b)) + '"><span class="lbl"><b>原文 · p.' + b.p + '</b><span>在书中打开' + I('chev') + '</span></span><span class="q">' + blockText(b) + '</span></button></div>'; }
    case 'derive': return '<div class="ai' + en + '">' + who(m) + '<div class="card aux derive"><div class="hd">' + T3('derive', 'xs') + '补充推导</div><div class="bd" id="b-' + m.id + '">' + body() + '</div></div></div>';
    case 'ex': return '<div class="ai' + en + '">' + who(m) + '<div class="card aux ex"><div class="hd">' + T3('bulb', 'xs') + 'AI 举例</div><div class="bd" id="b-' + m.id + '">' + body() + '</div></div></div>';
    case 'check': return '<div class="ai' + (m.old ? ' old' : '') + en + '">' + who(m) + '<div class="check"><div class="q">' + T3('question', 'xs') + '<span><small>检查一下</small>' + esc(m.t) + '</span></div></div></div>';
    case 'resume': {
      const sk = S.stuck.find(x => x.id === 's1');
      return '<div class="card resume' + en + '"><div class="hd">' + T3('clock', 'xs') + '<span>接着上次 · 距上次 ' + S.daysAway + ' 天</span></div><p>上次讲完了第 1 步「' + esc(st.steps[0].t) + '」：<b>f(n) = g(n) + h(n)</b>。</p>' +
        (sk && !sk.ok ? '<p>你在 3.4.2 有一个卡点还没解决：「' + esc(sk.x) + '」。A* 也会用到它。</p><p>要先花两分钟复习这个卡点吗？</p>' : '') +
        (st.phase === 'resume' && !m.done ? '<div class="btns"><button class="btn sm pri" onclick="resumeGo()">' + I('play') + '直接讲第 2 步</button>' + (sk && !sk.ok ? '<button class="btn sm" onclick="resumeReview()">' + I('pin') + '先复习卡点</button>' : '') + '</div>' : '') + '</div>';
    }
    case 'quiz': {
      const qz = QUIZ[st.sec][m.qi];
      return '<div class="check quiz' + en + '"><div class="q">' + T3('question', 'xs') + '<span><small>' + (m.final ? '本节小测' : '考考你 · 第 ' + (m.qi + 1) + ' 步') + '</small>' + esc(qz.q) + '</span></div><div class="opts' + (qz.ops.length > 2 ? ' col' : '') + '">' +
        qz.ops.map((o, k) => { const s = m.pick == null ? '' : k === qz.ans ? 'right' : k === m.pick ? 'wrong' : 'muted'; return '<button class="opt ' + s + '" ' + (m.pick == null ? '' : 'aria-disabled="true" ') + 'onclick="' + on(() => answerQuiz(m, k)) + '"><span class="k">' + (s === 'right' ? I('check') : s === 'wrong' ? I('close') : 'ABC'[k]) + '</span><span class="grow">' + esc(o) + '</span></button>'; }).join('') + '</div></div>';
    }
    case 'prop':
      return '<div class="card prop' + en + '"><div class="hd">' + T3('pin', 'xs') + '<span>AI 建议 · 记为卡点</span></div>「' + esc(m.x) + '」<div class="btns">' + (m.done ? '<span class="muted" style="font-size:13px">' + (m.done === 'yes' ? '已记下，会出现在复习的卡点清单里' : '已忽略') + '</span>' :
        '<button class="btn sm pri" onclick="' + on(() => { m.done = 'yes'; S.stuck.unshift({ id: 's' + Date.now(), sec: m.sec, x: m.x, ok: false }); refresh(); }) + '">记下</button><button class="btn sm" onclick="' + on(() => { m.done = 'no'; st.stuckCand = st.stuckCand.filter(x => x !== m.x); refresh(); }) + '">不用</button>') + '</div></div>';
    case 'fold': return '<div class="fold' + (m.open ? ' open' : '') + en + '"><button class="fold-h" aria-expanded="' + !!m.open + '" onclick="' + on(() => { m.open = !m.open; refresh(); }) + '"><span class="bi">' + I('branch') + '</span><span class="t"><b>岔路已解决 · ' + esc(m.title) + '</b><small>回到过 ' + esc(m.sec || '3.4.2') + ' · ' + m.items.length + ' 条</small></span>' + I('chevDown') + '</button>' + (m.open ? '<div class="fold-b">' + whoMark(m.items).map(item).join('') + '</div>' : '') + '</div>';
    case 'detour': return '<div class="detour-run">' + whoMark(m.d.items).map(item).join('') + '</div>';
    case 'done': { const d = st.ss.filter(x => x === 'done').length, sk = st.ss.filter(x => x === 'skipped').length;
      return '<div class="card donecard' + en + '"><div class="hd">' + T3('check', 'xs') + '<span>本节讲完了</span></div>' + st.n + ' 步里讲了 ' + d + ' 步' + (sk ? '，跳过 ' + sk + ' 步' : '') + '。点「懂了，下一节」生成摘要和闪卡草稿。</div>'; }
    case 'err': return '<div class="card errcard' + en + '"><div class="hd">' + T3('error', 'xs') + '<span>回答中断了</span></div>' + esc(m.t) + '<div class="btns"><button class="btn sm pri" onclick="' + on(() => retryAnswer(m)) + '">' + I('retry') + '重试</button><button class="btn sm" onclick="go(\'meAI\')">检查 AI 服务</button></div></div>';
    case 'typing': return '<div class="ai"><div class="who"><span class="orb busy">' + I('spark') + '</span>Pagewise 正在想…</div><div class="typing" aria-label="正在回答"><i></i><i></i><i></i></div></div>';
  }
  return '';
}
const allowedMain = () => blocksOfSec(ST().sec).map(b => b.id);
const blockText = b => b.t === 'eq' ? '<span class="math">' + esc(plain(b.x)) + '</span>' : inline(b.x);

// ---------- 原文预览（点引用胶囊） ----------
function peek(id) {
  const b = BLK[id], st = ST(), main = b.sec === st.sec;
  const same = BLOCKS.filter(x => x.p === b.p && x.sec === b.sec);
  const body = '<div class="peek">' + (same[0].t !== 'title' ? '<div class="pblk b-title">' + esc(secName(b.sec)) + '</div>' : '') +
    same.map(x => '<div class="pblk' + (x.t === 'title' ? ' b-title' : x.t === 'eq' ? ' b-eq' : '') + (x.id === id ? ' tgt' : '') + '">' + (x.t === 'image' ? figHtml(x.fig) : x.t === 'eq' ? '<span class="math blk">' + esc(plain(x.x)) + '</span>' : inline(x.x)) + '</div>').join('') + '<div class="pno">— ' + b.p + ' —</div></div>';
  sheet({ title: '原书 p.' + b.p, sub: main ? esc(secName(b.sec)) + ' · 高亮的是被引用的段落' : esc(secName(b.sec)) + ' · 岔路里读过的原文', body,
    acts: main ? [['在读书模式打开', () => { closeOverlay(true); openBlock(id); }, 'pri'], ['关闭', closeOverlay]] : [['好的', closeOverlay, 'pri']] });
  const t = $('.peek .tgt'); if (t) t.scrollIntoView({ block: 'center' });
}

// ---------- 更多 ----------
function studyMenu() {
  const st = ST();
  sheet({ title: secName(st.sec), sub: '人工智能：现代方法', body: '<div class="card list">' +
    row({ t: '书的地图', d: '全书目录、进度和每节状态', i3: 'map', fn: () => { closeOverlay(true); const p = R.stack[R.stack.length - 2]; if (p && p.name === 'map') back(); else go('map', { book: 'aima' }); } }) +
    row({ t: '本节路线图', d: st.n + ' 步 · 点某一步从那里讲', i3: 'layers', fn: () => { closeOverlay(true); openRoadmap(); } }) +
    row({ t: '本节笔记', d: '摘要、问答、卡点、高亮', i3: 'note', fn: () => go('noteDetail', { sec: st.sec }) }) +
    row({ t: 'AI 看到的内容', d: '本轮上下文和 token', i3: 'ai', fn: () => { closeOverlay(true); openCtx(); } }) +
    row({ t: '结束本节', d: '生成摘要、卡点和闪卡草稿', i3: 'check', fn: () => { closeOverlay(true); finishSection(); } }) + '</div>' });
}
function openCtx() {
  const L = ctxLayers(), tot = L.reduce((a, x) => a + x.t, 0), cached = L.filter(x => x.c).reduce((a, x) => a + x.t, 0);
  const svc = S.ai.services.find(s => s.id === S.ai.teach.split(':')[0]);
  sheet({ title: 'AI 看到的内容', sub: '本轮请求 · 预计输入 token', body: '<div class="ctxtot"><b class="n">' + (tot / 1000).toFixed(1) + 'k</b><span>其中 ' + (cached / 1000).toFixed(1) + 'k 命中缓存<br>' + esc(svc.name) + ' · ' + S.ai.teach.split(':')[1] + '</span></div><div class="stack">' + L.map(x => '<i style="flex:' + x.t + ';background:' + x.col + '"></i>').join('') + '</div><div class="card list">' +
    L.map(x => '<div class="row"><span class="sq" style="background:' + x.col + '"></span><span class="grow"><b>' + x.k + (x.c ? ' <span class="tag acc">缓存</span>' : '') + '</b><small>' + esc(x.d) + '</small></span><span class="tk n">' + (x.t / 1000).toFixed(1) + 'k</span></div>').join('') + '</div>' +
    '<div class="grp-f">上一轮实际：输入 3.1k · 缓存读 4.2k · 输出 0.6k</div><div style="margin-top:10px">' + noteHtml('ai', 'AI 只能引用这里列出的原文。你问到别的小节时，它会先读取那一节，再回答。', 'info') + '</div>' });
}
