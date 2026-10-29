/* Pagewise 风格探索 · 共用交互：听讲 ⇄ 读书、路线图、引用预览、岔路折叠、问答便签、从这里开始讲 */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const I = n => ICONS[n] || '';
const H = []; const on = fn => 'H[' + (H.push(fn) - 1) + '](event)';

let S;
function reset() {
  S = { mode: 'listen', cur: 1, st: ['done', 'now', 'todo', 'todo'], msgs: [], detour: null, busy: false, guide: false, hl: new Set(['b7']), pins: Object.assign({}, PINS), finished: false };
  S.msgs.push({ k: 'sys', t: '3 天前 · 第 1 步' });
  S.msgs.push({ k: 'head', i: 0 }, ...LESSON[0]);
  S.msgs.push({ k: 'fold', open: false, title: 'A* 和一致代价搜索的关系', items: [
    { k: 'user', t: '这跟前面的一致代价搜索有什么关系？' },
    { k: 'tool', t: '读取 3.4.2 一致代价搜索（p.90–93）' },
    { k: 'ai', t: '$h(n)$ 恒为 0 时，$f(n) = g(n)$，A* 就是一致代价搜索 [[d1]]。A* 多了 h 这个"方向感"，所以通常扩展的结点更少 [[b4]]。' }
  ] });
  S.msgs.push({ k: 'resume', t: '上次讲完了第 1 步。你在 3.4.2 问过"为什么扩展时才判断目标"，第 4 步还会用到。' });
  S.msgs.push({ k: 'head', i: 1 }, ...LESSON[1]);
}

// ---------- 富文本 ----------
function md(t) {
  return esc(t)
    .replace(/\$([^$]+)\$/g, '<span class="math">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\s?\[\[(\w+)\]\]/g, (_, id) => cite(id));
}
function cite(id) {
  const b = BLK[id];
  return '<button class="cite' + (b.sec ? ' dt' : '') + '" onclick="' + on(e => { e.stopPropagation(); peek(id); }) + '">p.' + b.p + '</button>';
}
const blockText = b => b.t === 'eq' ? '<span class="math">' + esc(b.x) + '</span>' : esc(b.x);

// ---------- 听讲 ----------
function item(m, idx) {
  switch (m.k) {
    case 'sys': return '<div class="sys">' + esc(m.t) + '</div>';
    case 'head': return '<div class="head" id="step-' + m.i + '"><span class="sn">第 ' + (m.i + 1) + ' 步</span><b>' + esc(STEPS[m.i].t) + '</b><span class="pg">p.' + STEPS[m.i].p + '</span></div>';
    case 'ai': return '<div class="ai">' + md(m.t) + '</div>';
    case 'user': return '<div class="user">' + esc(m.t) + '</div>';
    case 'tool': return '<div class="tool">' + I('book') + esc(m.t) + '</div>';
    case 'src': { const b = BLK[m.b]; return '<button class="src" onclick="' + on(() => peek(m.b)) + '"><span class="lbl">原文 · p.' + b.p + '</span><span class="q">' + blockText(b) + '</span></button>'; }
    case 'derive': return '<div class="aux derive"><span class="lbl">' + I('derive') + '补充推导</span><div>' + md(m.t) + '</div></div>';
    case 'ex': return '<div class="aux ex"><span class="lbl">' + I('spark') + 'AI 举例</span><div>' + md(m.t) + '</div></div>';
    case 'check': return '<div class="check"><span class="lbl">检查一下</span>' + esc(m.t) + '</div>';
    case 'resume': return '<div class="resume"><span class="lbl">' + I('clock') + '接着上次</span>' + esc(m.t) + '</div>';
    case 'fold': return '<div class="fold' + (m.open ? ' open' : '') + '"><button class="fold-h" onclick="' + on(() => { m.open = !m.open; renderView(false); }) + '">' + I('check') + '<span class="grow">已解决：' + esc(m.title) + '</span><span class="n">' + m.items.length + ' 条</span>' + I('chev') + '</button>' + (m.open ? '<div class="fold-b">' + m.items.map(item).join('') + '</div>' : '') + '</div>';
    case 'detour': return '<div class="detour-run">' + m.items.map(item).join('') + '</div>';
    case 'done': return '<div class="donecard"><span class="lbl">' + I('check') + '本节讲完了</span><p>4 步里讲了 ' + S.st.filter(s => s === 'done').length + ' 步' + (S.st.includes('skipped') ? '，跳过 ' + S.st.filter(s => s === 'skipped').length + ' 步' : '') + '。点「懂了，下一节」生成摘要和闪卡草稿。</p></div>';
    case 'typing': return '<div class="typing"><i></i><i></i><i></i></div>';
  }
  return '';
}
function renderRail() {
  return '<div class="rail" role="tablist" aria-label="本节路线图">' + STEPS.map((s, i) => {
    const st = S.st[i];
    return '<button class="step ' + st + '" onclick="' + on(() => tapStep(i)) + '" aria-label="第 ' + (i + 1) + ' 步 ' + esc(s.t) + '"><span class="ic">' + (st === 'done' ? I('check') : st === 'skipped' ? I('skip') : (i + 1)) + '</span><span class="t">' + esc(s.t) + '</span></button>';
  }).join('') + '</div>';
}
function listenTop() {
  if (S.detour) return '<div class="banner">' + I('branch') + '<span class="grow"><small>岔路</small>' + esc(S.detour.sec) + '</span><button onclick="' + on(backToMain) + '">回到主线</button></div>';
  return renderRail() + (THEME === 'google' ? wave() : THEME === 'microsoft' || THEME === 'play' || THEME === 'windows11' ? bar() : '');
}
function wave() {
  const done = S.st.filter(s => s === 'done' || s === 'skipped').length, f = Math.max(.06, (done + .5) / 4);
  const end = Math.round(356 * f); let d = 'M2 6'; for (let x = 2; x <= end; x += 2) d += ' L' + x + ' ' + (6 + 3 * Math.sin(x / 7)).toFixed(2);
  return '<svg class="wave" viewBox="0 0 358 12" aria-hidden="true"><path class="tr" d="M' + Math.min(352, end + 12) + ' 6 L356 6"/><path class="pr" d="' + d + '"/></svg>';
}
function bar() {
  const done = S.st.filter(s => s === 'done' || s === 'skipped').length, f = Math.max(.04, (done + .5) / 4);
  return '<div class="pbar" role="progressbar" aria-valuenow="' + done + '" aria-valuemax="4"><i style="width:' + Math.round(f * 100) + '%"></i></div>';
}
function listenDock() {
  if (S.finished) return '';
  const last = S.cur === 3 && S.st[3] === 'done';
  const chips = S.detour ? [['再问问', () => ask('那 A* 一定比一致代价搜索快吗？')], ['回到主线', backToMain]] :
    last ? [] : [['换个说法', () => alt('re', '换个说法')], ['举个例子', () => alt('ex', '举个例子')], ['展开推导', () => alt('dv', '展开推导')], ['这步熟，跳过', skip]];
  const pri = S.detour ? null : last ? ['懂了，下一节', finish] : ['懂了，下一步', next];
  return '<div class="chips">' + (pri ? '<button class="chip pri" onclick="' + on(pri[1]) + '">' + I('next') + pri[0] + '</button>' : '') + chips.map(c => '<button class="chip" onclick="' + on(c[1]) + '">' + c[0] + '</button>').join('') + '</div>' +
    '<form class="composer" onsubmit="' + on(e => { e.preventDefault(); const v = $('#q').value.trim(); if (v) { $('#q').value = ''; ask(v); } }) + '"><input id="q" autocomplete="off" placeholder="' + (S.detour ? '在岔路里继续问…' : '问点什么…') + '"><button type="button" class="mic" aria-label="语音提问" onclick="' + on(() => toast('语音提问：按住说话（M5）')) + '">' + I('mic') + '</button><button class="send" aria-label="发送">' + I('send') + '</button></form>';
}

// ---------- 读书 ----------
function readerView() {
  const doneTo = S.st.lastIndexOf('done');
  let h = '<button class="guide' + (S.guide ? ' open' : '') + '" onclick="' + on(() => { S.guide = !S.guide; renderView(false); }) + '"><span class="lbl">' + I('spark') + '本节导读</span>' + (S.guide ? '<span class="gt">' + esc(GUIDE) + '</span>' : '<span class="gt one">A* 怎么挑结点，h 满足什么条件才最优</span>') + I('chev') + '</button>';
  h += '<article class="page">';
  let lastP = 0;
  BLOCKS.filter(b => !b.sec).forEach(b => {
    if (b.p !== lastP) { if (lastP) h += '<div class="pno">p.' + lastP + '</div>'; lastP = b.p; }
    const cls = ['blk', 'b-' + b.t, b.s <= doneTo ? 'heard' : '', b.s === S.cur && !S.finished ? 'now' : '', S.hl.has(b.id) ? 'hl' : ''].join(' ');
    h += '<div class="' + cls + '" id="' + b.id + '" onclick="' + on(() => blockMenu(b.id)) + '">' + (b.t === 'fig' ? FIG + '<div class="cap">' + esc(b.x) + '</div>' : blockText(b)) + '</div>';
    const pin = S.pins[b.id];
    if (pin) h += '<button class="pin" onclick="' + on(() => openPin(b.id)) + '">' + I('pin') + '<span>已解决：' + esc(pin.q) + '</span></button>';
  });
  h += '<div class="pno">p.' + lastP + '</div></article>';
  h += '<div class="readend"><button class="btn pri" onclick="' + on(finish) + '">读完这一节</button><small>和听讲一样生成摘要和闪卡草稿</small></div>';
  return h;
}

// ---------- 渲染 ----------
function render() {
  $('#appbar').innerHTML = '<button class="ib back" aria-label="返回书的地图" onclick="' + on(typeof goBack === 'function' ? goBack : () => toast('返回书的地图')) + '">' + I('back') + (THEME === 'apple' ? '<span>地图</span>' : '') + '</button><div class="ttl"><b>3.5.2 A* 搜索</b><small>人工智能：现代方法 · p.102–106</small></div><button class="ib" aria-label="更多" onclick="' + on(() => toast('更多：AI 看到的内容、讲解偏好')) + '">' + I('more') + '</button>';
  $('#modebar').innerHTML = '<div class="seg" role="tablist"><span class="thumb ' + S.mode + '"></span>' + [['read', '读书', 'bookopen'], ['listen', '听讲', 'teach']].map(([k, l, ic]) => '<button role="tab" aria-selected="' + (S.mode === k) + '" class="' + (S.mode === k ? 'on' : '') + '" onclick="' + on(() => setMode(k)) + '">' + (THEME === 'google' && S.mode === k ? I('check') : '') + l + '</button>').join('') + '</div>';
  $('#phone').dataset.mode = S.mode;
  renderView(true);
}
function renderView(toEnd) {
  const v = $('#view'), top = v.scrollTop;
  $('#top').innerHTML = S.mode === 'listen' ? listenTop() : '';
  $('#dock').innerHTML = S.mode === 'listen' ? listenDock() : '';
  v.innerHTML = S.mode === 'listen' ? '<div class="thread">' + S.msgs.map(item).join('') + '</div>' : readerView();
  if (S.mode === 'listen' && toEnd) v.scrollTop = v.scrollHeight; else v.scrollTop = top;
  const cur = $('.rail .step.now'); if (cur) cur.parentNode.scrollLeft = Math.max(0, cur.offsetLeft - 60);
}
function scrollEnd() { const v = $('#view'); v.scrollTo({ top: v.scrollHeight, behavior: REDUCED ? 'auto' : 'smooth' }); }

// ---------- 讲解推进 ----------
async function say(items, opts) {
  S.busy = true;
  const tgt = S.detour ? S.detour.items : S.msgs;
  tgt.push({ k: 'typing' }); renderView(true);
  await sleep(650); tgt.pop();
  for (const it of items) { tgt.push(it); renderView(false); const el = $('#view .thread').lastElementChild; if (el) el.classList.add('enter'); scrollEnd(); await sleep(260); }
  S.busy = false; renderView(false); scrollEnd();
}
async function next() {
  if (S.busy) return;
  S.st[S.cur] = 'done';
  if (S.cur === 3) { S.msgs.push({ k: 'done' }); renderView(true); return; }
  S.cur++; S.st[S.cur] = 'now';
  S.msgs.push({ k: 'head', i: S.cur });
  await say(LESSON[S.cur]);
}
async function skip() {
  if (S.busy || S.cur === 3) return toast(S.cur === 3 ? '最后一步不能跳过' : '');
  S.st[S.cur] = 'skipped';
  S.msgs.push({ k: 'sys', t: SKIP_NOTE[S.cur] || '跳过了第 ' + (S.cur + 1) + ' 步' });
  S.cur++; S.st[S.cur] = 'now';
  S.msgs.push({ k: 'head', i: S.cur });
  await say(LESSON[S.cur]);
}
async function alt(kind, label) {
  if (S.busy) return;
  S.msgs.push({ k: 'user', t: label });
  await say([{ k: kind === 'ex' ? 'ex' : kind === 'dv' ? 'derive' : 'ai', t: ALT[S.cur][kind] }]);
}
async function ask(text) {
  if (S.busy) return;
  if (!S.detour && /3\.4|一致代价|前面|Dijkstra/i.test(text)) {
    S.detour = { sec: '3.4.2 一致代价搜索', items: [{ k: 'user', t: text }] };
    S.msgs.push({ k: 'detour', items: S.detour.items });
    render();
    await say([{ k: 'tool', t: '读取 3.4.2 一致代价搜索（p.90–93）' }, { k: 'ai', t: '一致代价搜索按 $g(n)$ 扩展 [[d1]]；A* 按 $g(n) + h(n)$ 扩展。h 恒为 0 时两者完全一样。所以 A* 可以看成"带方向感的一致代价搜索" [[b2]]。' }]);
    return;
  }
  (S.detour ? S.detour.items : S.msgs).push({ k: 'user', t: text });
  if (S.detour) return say([{ k: 'ai', t: '不一定更快，但 h 越准，A* 扩展的结点越少；h 可容许时两者找到的都是最优解 [[b11]]。' }]);
  await say([{ k: 'ai', t: '按书里的说法：' + ALT[S.cur].re.replace(/^换个说法：/, '') }]);
}
function backToMain() {
  const d = S.detour; if (!d) return;
  const i = S.msgs.findIndex(m => m.k === 'detour');
  S.msgs[i] = { k: 'fold', open: false, title: 'A* 和一致代价搜索的关系', items: d.items };
  S.detour = null;
  S.msgs.push({ k: 'sys', t: '回到主线 · 第 ' + (S.cur + 1) + ' 步 ' + STEPS[S.cur].t });
  render(); toast('岔路已折叠，问答记进了 3.4.2 的笔记');
}
function tapStep(i) {
  if (S.busy) return;
  const el = $('#step-' + i);
  if (el) return el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  sheet('从第 ' + (i + 1) + ' 步开始讲？', '<p class="sp">「' + esc(STEPS[i].t) + '」· p.' + STEPS[i].p + '。中间没讲的步骤会留着，随时可以回来讲。</p>', [['开始讲', () => jumpTo(i), 'pri'], ['取消', closeSheet]]);
}
async function jumpTo(i) {
  closeSheet();
  if (S.st[S.cur] === 'now') S.st[S.cur] = 'todo';
  S.cur = i; S.st[i] = 'now';
  S.msgs.push({ k: 'head', i });
  if (S.mode !== 'listen') { S.mode = 'listen'; render(); }
  await say(LESSON[i]);
}

// ---------- 模式切换（位置不丢） ----------
function setMode(m, focus) {
  if (m === S.mode && !focus) return;
  if (m === 'listen') {
    let b = focus;
    if (!b && S.mode === 'read') { const v = $('#view'), y = v.getBoundingClientRect().top + 90; b = ($$('.blk', v).find(el => el.getBoundingClientRect().bottom > y) || {}).id; }
    S.mode = 'listen'; render();
    if (b) { const s = BLK[b].s; if ($('#step-' + s)) { $('#step-' + s).scrollIntoView({ block: 'start' }); toast('听讲 · 第 ' + (s + 1) + ' 步'); } else jumpTo(s); }
    return;
  }
  S.mode = 'read'; render();
  const id = focus || BLOCKS.find(b => b.s === S.cur).id;
  const el = $('#' + id); if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2000);
}

// ---------- 浮层 ----------
function sheet(title, body, acts, sub) {
  $('#overlay').innerHTML = '<div class="scrim" onclick="' + on(closeSheet) + '"></div><div class="sheet" role="dialog" aria-label="' + esc(title) + '"><div class="grab"></div><div class="sh"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><div class="sb">' + body + '</div>' + (acts ? '<div class="sf">' + acts.map(a => '<button class="btn ' + (a[2] || '') + '" onclick="' + on(a[1]) + '">' + a[0] + '</button>').join('') + '</div>' : '') + '</div>';
  requestAnimationFrame(() => $('#overlay').classList.add('show'));
}
function closeSheet() { $('#overlay').classList.remove('show'); setTimeout(() => { if (!$('#overlay').classList.contains('show')) $('#overlay').innerHTML = ''; }, REDUCED ? 0 : 260); }
function peek(id) {
  const b = BLK[id], same = BLOCKS.filter(x => x.p === b.p && (x.sec || '') === (b.sec || ''));
  const body = '<div class="peek">' + (b.sec ? '<div class="pblk">3.4.2　Dijkstra 算法或一致代价搜索</div>' : '') + same.map(x => '<div class="pblk b-' + x.t + (x.id === id ? ' tgt' : '') + '">' + (x.t === 'fig' ? FIG : blockText(x)) + '</div>').join('') + '<div class="pno">— ' + b.p + ' —</div></div>';
  sheet('原书 p.' + b.p, body, b.sec ? [['好的', closeSheet, 'pri']] : [['在读书模式打开', () => { closeSheet(); setMode('read', id); }, 'pri'], ['关闭', closeSheet]], b.sec ? '3.4.2 一致代价搜索 · 岔路里读过的原文' : '3.5.2 A* 搜索 · 高亮的是被引用的段落');
  const t = $('.peek .tgt'); if (t) t.scrollIntoView({ block: 'center' });
}
function blockMenu(id) {
  const b = BLK[id]; if (b.t === 'h') return;
  $$('.blk.sel').forEach(e => e.classList.remove('sel')); $('#' + id).classList.add('sel');
  const acts = [
    ['解释这段', () => explain(id)],
    ['从这里开始讲', () => { closeSheet(); setMode('listen', id); }, 'pri'],
    [S.hl.has(id) ? '取消高亮' : '高亮', () => { S.hl.has(id) ? S.hl.delete(id) : S.hl.add(id); closeSheet(); renderView(false); }],
    ['问 AI', () => { closeSheet(); setMode('listen', id); setTimeout(() => { const q = $('#q'); if (q) { q.value = '「' + b.x.slice(0, 14) + '…」'; q.focus(); } }, 120); }]
  ];
  sheet('第 ' + (b.s + 1) + ' 步 · p.' + b.p, '<p class="sp quote">' + blockText(b) + '</p>', acts);
}
function explain(id) {
  const t = EXPLAIN[id] || '这一段在说：' + BLK[id].x.slice(0, 40) + '…… 换句话说，它是第 ' + (BLK[id].s + 1) + ' 步「' + STEPS[BLK[id].s].t + '」的依据 [[' + id + ']]。';
  sheet('解释', '<div class="ai">' + md(t) + '</div>', [['带到听讲里继续问', () => { closeSheet(); setMode('listen', id); }, 'pri'], ['好的', () => { closeSheet(); S.pins[id] = S.pins[id] || { q: '这段在说什么', a: t }; renderView(false); toast('已贴成问答便签'); }]]);
}
function openPin(id) {
  const p = S.pins[id];
  sheet(esc(p.q), '<div class="ai">' + md(p.a) + '</div>', [['在听讲里继续问', () => { closeSheet(); setMode('listen', id); }, 'pri'], ['好的', closeSheet]], '问答便签 · p.' + BLK[id].p);
}
function finish() {
  const cards = [['A* 的评价函数是什么？', 'f(n) = g(n) + h(n)'], ['什么是可容许的启发式？', '从不高估到达目标的真实代价'], ['一致性和可容许性是什么关系？', '一致 ⇒ 可容许，反之不一定']];
  S.cardSel = S.cardSel || cards.map(() => true);
  const row = (c, i) => '<button class="ck' + (S.cardSel[i] ? ' on' : '') + '" onclick="' + on(() => { S.cardSel[i] = !S.cardSel[i]; finish(); }) + '"><span class="bx">' + I('check') + '</span><span class="grow"><b>' + esc(c[0]) + '</b><small>' + esc(c[1]) + '</small></span></button>';
  sheet('3.5.2 学完了', '<p class="sp">A* 按 f = g + h 扩展；h 可容许时树搜索最优，一致时图搜索也最优。</p><div class="sub">卡点</div><p class="sp stuck">' + I('flag') + '为什么图搜索需要一致性而不只是可容许</p><div class="sub">闪卡草稿 · 默认全选</div>' + cards.map(row).join(''), [['保存，进入 3.5.3', () => { closeSheet(); S.finished = true; renderView(false); toast('已保存 ' + S.cardSel.filter(Boolean).length + ' 张闪卡，进度移到 3.5.3'); }, 'pri']], '摘要 · 卡点 · 闪卡');
}
let toastT;
function toast(t) { if (!t) return; const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200); }

// ---------- 外部控制 ----------
function setTheme(t) { document.documentElement.dataset.theme = t; $$('.side .tg button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); }
function start() {
  reset();
  setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  render();
  const m = location.hash.slice(1); if (m === 'read') setMode('read');
}
document.addEventListener('DOMContentLoaded', start);
