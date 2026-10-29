/* Pagewise 苹果风原型 · UI 基础：路由、顶栏（大标题收起）、Tab 栏、浮层、富文本、流式输出 */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));
// 事件处理：把闭包登记到 H，返回可放进 onclick 的字符串
const H = [];
const on = fn => 'H[' + (H.push(fn) - 1) + '](event)';

// ---------- 路由 ----------
const R = { stack: [{ name: 'shelf', p: {} }] };
const SCREENS = {};
const TABS = [['shelf', '书架', 'shelf'], ['review', '复习', 'cards'], ['notes', '笔记', 'note'], ['me', '我的', 'person']];
function cur() { return R.stack[R.stack.length - 1]; }
function go(name, p) { closeOverlay(true); R.stack.push({ name, p: p || {} }); render(true); }
function back() { closeOverlay(true); if (R.stack.length > 1) { R.stack.pop(); render(true); } }
function tab(name) { closeOverlay(true); R.stack = [{ name, p: {} }]; render(true); }
function replace(name, p) { closeOverlay(true); R.stack[R.stack.length - 1] = { name, p: p || {} }; render(true); }
const val = (v, p) => typeof v === 'function' ? v(p) : v;

function render(resetScroll) {
  const c = cur(), sc = SCREENS[c.name];
  const view = $('#view'), st = view.scrollTop;
  const cin = $('#cin'), keep = cin ? { v: cin.value, f: document.activeElement === cin } : null;
  const root = !!sc.root, title = val(sc.title, c.p), sub = val(sc.sub, c.p);
  const prev = R.stack[R.stack.length - 2];
  const backLabel = prev ? val(SCREENS[prev.name].short, prev.p) || '返回' : '';
  const right = sc.right ? sc.right(c.p) : '';
  $('#nav').className = root ? 'root' : '';
  $('#nav').innerHTML = '<div class="l">' + (root ? '' : '<button class="back" aria-label="返回 ' + esc(backLabel) + '" onclick="back()">' + I('back') + '<span>' + esc(backLabel) + '</span></button>') + '</div>' +
    '<div class="ttl"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><div class="r">' + right + '</div>';
  $('#top').innerHTML = sc.top ? sc.top(c.p) : '';
  view.innerHTML = (root ? '<h1 class="lt">' + esc(title) + '</h1>' : '') + sc.render(c.p);
  $('#dock').innerHTML = sc.dock ? sc.dock(c.p) : '';
  $('#fab').innerHTML = sc.fab ? sc.fab(c.p) : '';
  const due = dueCards().length, rootName = R.stack[0].name;
  $('#tabbar').className = root ? 'gl' : '';
  $('#tabbar').innerHTML = root ? TABS.map(([k, l, ic]) => '<button class="' + (k === rootName ? 'on' : '') + '" aria-label="' + l + '" onclick="tab(\'' + k + '\')">' + I(ic) + l + (k === 'review' && due ? '<span class="badge">' + due + '</span>' : '') + '</button>').join('') : '';
  // 内容从玻璃顶栏下面滚过：上下留出顶栏 / 底部悬浮区的高度
  view.style.paddingTop = $('#head').offsetHeight + 'px';
  const dock = $('#dock');
  view.style.paddingBottom = (dock.childElementCount ? dock.offsetHeight + 8 : root ? 110 : 34) + 'px';
  if (keep) { const n = $('#cin'); if (n) { n.value = keep.v; if (keep.f) n.focus(); } }
  view.scrollTop = resetScroll ? 0 : st;
  onScroll();
  if (sc.after) sc.after(c.p, resetScroll);
  renderConsole();
}
function refresh() { render(false); }
function onScroll() {
  const y = $('#view').scrollTop, h = $('#head');
  h.classList.toggle('scrolled', y > 2);
  h.classList.toggle('past', y > 36);
}

// 读书 | 听讲（顶栏右侧，两种皮肤都在这里）；只在点它切过去的那一次播滑动动画
let modeSlide = false;
function modeSwitch(curMode, toOther) {
  const slide = modeSlide; modeSlide = false;
  return '<div class="mode' + (slide ? ' slide' : '') + '" role="tablist" aria-label="学法"><span class="thumb ' + curMode + '"></span>' +
    [['read', '读书'], ['listen', '听讲']].map(([k, l]) => '<button role="tab" aria-selected="' + (k === curMode) + '" class="' + (k === curMode ? 'on' : '') + '"' + (k === curMode ? '' : ' onclick="' + on(() => { modeSlide = true; toOther(); }) + '"') + '>' + l + '</button>').join('') + '</div>';
}
// 分段控件：先在原地滑动滑块，再改状态重画
function segHtml(opts, value, pick, style) {
  const i = Math.max(0, opts.findIndex(o => o[0] === value));
  return '<div class="seg" role="tablist" style="--n:' + opts.length + ';--i:' + i + (style ? ';' + style : '') + '"><span class="thumb"></span>' + opts.map(([k, l], j) =>
    '<button role="tab" aria-selected="' + (k === value) + '" class="' + (k === value ? 'on' : '') + '" onclick="' + on(e => { if (k === value) return; const sg = e.currentTarget.parentNode; sg.style.setProperty('--i', j); setTimeout(() => pick(k), REDUCED ? 0 : 200); }) + '">' + l + '</button>').join('') + '</div>';
}
// iOS 开关：先播动画，再改状态
function swHtml(v, fn, label) {
  return '<span class="sw' + (v ? ' on' : '') + '" role="switch" aria-checked="' + !!v + '" aria-label="' + esc(label || '') + '" tabindex="0" onclick="' + on(e => { e.stopPropagation(); e.currentTarget.classList.toggle('on'); setTimeout(fn, REDUCED ? 0 : 230); }) + '"></span>';
}
const chev = () => I('chev').replace('class="i"', 'class="i chev"');
function row(o) {
  // o: {t, d, ic:[icon,color], val, chev, fn, cls, right, warn}
  return '<' + (o.fn ? 'button' : 'div') + ' class="row' + (o.fn ? ' tap' : '') + (o.cls ? ' ' + o.cls : '') + '"' + (o.fn ? ' onclick="' + on(o.fn) + '"' : '') + '>' +
    (o.ic ? '<span class="ico" style="background:' + o.ic[1] + '">' + I(o.ic[0]) + '</span>' : '') +
    '<span class="grow"><b>' + o.t + '</b>' + (o.d ? '<small' + (o.warn ? ' style="color:var(--orange-ink)"' : '') + '>' + o.d + '</small>' : '') + '</span>' +
    (o.val != null ? '<span class="val">' + o.val + '</span>' : '') + (o.right || '') + (o.fn && o.chev !== false ? chev() : '') + '</' + (o.fn ? 'button' : 'div') + '>';
}
const grp = (head, body, foot, cls) => '<section class="grp">' + (head ? '<div class="grp-h">' + head + '</div>' : '') + '<div class="list' + (cls ? ' ' + cls : '') + '">' + body + '</div>' + (foot ? '<div class="grp-f">' + foot + '</div>' : '') + '</section>';

// ---------- 浮层 ----------
function closeOverlay(now) {
  const o = $('#overlay'); const m = $('#phone .emenu'); if (m) m.remove();
  $$('.blk.sel').forEach(x => x.classList.remove('sel'));
  if (!o.innerHTML) return;
  o.classList.remove('show');
  if (now === true || REDUCED) { o.innerHTML = ''; return; }
  setTimeout(() => { if (!o.classList.contains('show')) o.innerHTML = ''; }, 300);
}
function showOverlay(html) {
  const o = $('#overlay');
  o.innerHTML = html; o.classList.remove('show');
  void o.offsetHeight;
  requestAnimationFrame(() => o.classList.add('show'));
  const sh = $('.sheet', o); if (sh) dragToClose(sh);
}
// 悬浮 Sheet：按钮竖排全宽、主按钮在上；下滑关闭
function sheet(o) {
  // o: {title, sub, body, acts:[[label, fn, kind]], x}
  const open = $('#overlay.show .sheet');
  if (open && open.getAttribute('aria-label') === o.title) {   // 同一个浮层里换内容（如切换导出格式）：原地更新，不重播动画
    $('.sb', open).innerHTML = o.body || '';
    const sf = $('.sf', open); if (sf && o.acts) sf.innerHTML = o.acts.map(a => '<button class="btn block ' + (a[2] || '') + '" onclick="' + on(a[1]) + '">' + a[0] + '</button>').join('');
    return;
  }
  showOverlay('<div class="scrim" onclick="closeOverlay()"></div><div class="sheet" role="dialog" aria-label="' + esc(o.title) + '"><div class="grab"></div><div class="sh"><b>' + o.title + '</b>' + (o.sub ? '<small>' + o.sub + '</small>' : '') +
    (o.x !== false ? '<button class="x" aria-label="关闭" onclick="closeOverlay()">' + I('close') + '</button>' : '') + '</div><div class="sb">' + (o.body || '') + '</div>' +
    (o.acts && o.acts.length ? '<div class="sf">' + o.acts.map(a => '<button class="btn block ' + (a[2] || '') + '" onclick="' + on(a[1]) + '">' + a[0] + '</button>').join('') + '</div>' : '<div style="height:16px;flex:none"></div>') + '</div>');
}
function dragToClose(sh) {
  let y0 = null, dy = 0;
  const startOn = e => e.target.closest('.grab,.sh') && !e.target.closest('button');
  sh.addEventListener('pointerdown', e => { if (!startOn(e)) return; y0 = e.clientY; dy = 0; sh.classList.add('drag'); sh.setPointerCapture(e.pointerId); });
  sh.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = 'translateY(' + dy + 'px)'; });
  const end = () => { if (y0 == null) return; y0 = null; sh.classList.remove('drag'); sh.style.transform = ''; if (dy > 90) closeOverlay(); };
  sh.addEventListener('pointerup', end); sh.addEventListener('pointercancel', end);
}
// iOS alert：两个按钮横排，三个以上竖排
function modal(o) {
  // o: {title, body, ok, cancel, onOk, onCancel, danger, more:[[label, fn]]}
  const btns = [];
  if (o.cancel !== false) btns.push('<button onclick="' + on(() => { closeOverlay(); o.onCancel && o.onCancel(); }) + '">' + (o.cancel || '取消') + '</button>');
  (o.more || []).forEach(m => btns.push('<button onclick="' + on(() => { closeOverlay(); m[1](); }) + '">' + m[0] + '</button>'));
  btns.push('<button class="pri' + (o.danger ? ' danger' : '') + '" onclick="' + on(() => { const r = o.onOk && o.onOk(); if (r !== false) closeOverlay(); }) + '">' + (o.ok || '好') + '</button>');
  showOverlay('<div class="scrim"></div><div class="dlgw" onclick="if(event.target===this)closeOverlay()"><div class="dlg" role="alertdialog" aria-label="' + esc(o.title) + '"><div class="dh">' + o.title + '</div><div class="db">' + o.body + '</div><div class="df' + (btns.length > 2 ? ' v' : '') + '">' + btns.join('') + '</div></div></div>');
}
let toastT;
function showToast(msg, kind) {
  if (!msg) return;
  const el = $('#toast');
  el.className = kind || '';
  el.innerHTML = (kind === 'ok' ? I('check') : kind === 'dt' ? I('branch') : kind === 'bad' ? I('info') : '') + '<span>' + esc(msg) + '</span>';
  void el.offsetHeight; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400);
}
// iOS 编辑菜单（读书页点段落）：浅色胶囊、竖线分隔，浮在段落上方
function editMenu(el, items) {
  closeOverlay(true);
  const ph = $('#phone').getBoundingClientRect(), r = el.getBoundingClientRect();
  const m = document.createElement('div');
  m.className = 'emenu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map(([l, f]) => '<button role="menuitem" onclick="' + on(ev => { ev.stopPropagation(); m.remove(); $$('.blk.sel').forEach(x => x.classList.remove('sel')); f(); }) + '">' + l + '</button>').join('');
  $('#phone').appendChild(m);
  const headB = $('#head').getBoundingClientRect().bottom - ph.top;
  let top = r.top - ph.top - 48;
  if (top < headB + 4) top = Math.min(r.bottom - ph.top + 8, ph.height - 140);
  m.style.top = top + 'px';
  m.style.left = Math.max(8, Math.min(ph.width - m.offsetWidth - 8, r.left - ph.left + r.width / 2 - m.offsetWidth / 2)) + 'px';
  setTimeout(() => document.addEventListener('click', function off(e) { if (e.target.closest('.emenu')) return; const x = $('#phone .emenu'); if (x) x.remove(); $$('.blk.sel').forEach(y => y.classList.remove('sel')); document.removeEventListener('click', off); }), 0);
}

// ---------- 富文本 ----------
// 标记：**粗体** $公式$ $$独立公式$$ [[b:块ID]] {{fig:ID}} 「- 」列表 「1. 」有序列表
function figHtml(id, blockId) {
  const f = FIGS[id];
  const tap = blockId ? ' onclick="' + on(e => { e.stopPropagation(); peek(blockId); }) + '"' : '';
  return '<div class="fig"' + tap + '>' + f.svg + '<div class="cap">' + esc(f.cap) + '</div></div>';
}
function citeHtml(id, allowed) {
  const b = BLK[id];
  if (!b || (allowed && !allowed.includes(id))) return '<span class="unv" title="引用的原文本轮没有读取">未核实</span>';
  const dt = S.study && b.sec !== S.study.sec;
  return '<button class="cite' + (dt ? ' dt' : '') + '" aria-label="原书第 ' + b.p + ' 页" onclick="' + on(e => { e.stopPropagation(); peek(id); }) + '">p.' + b.p + '</button>';
}
const tex = m => m.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>').replace(/\^(\S)/g, '<sup>$1</sup>').replace(/_\{([^}]+)\}/g, '<sub>$1</sub>').replace(/_(\w)/g, '<sub>$1</sub>');
function inline(s, allowed) {
  return esc(s)
    .replace(/\$\$([^$]+)\$\$/g, (_, m) => '<span class="math blk">' + tex(m) + '</span>')
    .replace(/\$([^$]+)\$/g, (_, m) => '<span class="math">' + tex(m) + '</span>')
    .replace(/\*\*([^\n]+?)\*\*/g, '<b>$1</b>')
    .replace(/\s?\[\[b:(\w+)\]\]/g, (_, id) => citeHtml(id, allowed))
    .replace(/\{\{fig:(\w+)\}\}/g, (_, id) => figHtml(id, Object.keys(BLK).find(k => BLK[k].fig === id)));
}
function md(text, allowed) {
  return text.split(/\n\n+/).map(par => {
    const lines = par.split('\n');
    if (lines.every(l => /^- /.test(l))) return '<ul>' + lines.map(l => '<li>' + inline(l.slice(2), allowed) + '</li>').join('') + '</ul>';
    if (lines.every(l => /^\d+\. /.test(l))) return '<ol>' + lines.map(l => '<li>' + inline(l.replace(/^\d+\. /, ''), allowed) + '</li>').join('') + '</ol>';
    const h = inline(par, allowed).replace(/\n/g, '<br>');
    return /^(\{\{fig|\$\$)/.test(par.trim()) ? h : '<p>' + h + '</p>';
  }).join('');
}
// 流式输出按"原子"切分：公式、粗体、引用、图都不会被切开
const atoms = text => text.match(/\$\$[^$]*\$\$|\$[^$]*\$|\*\*[^\n]+?\*\*|\s?\[\[b:\w+\]\]|\{\{fig:\w+\}\}|[\s\S]/g) || [];
const plain = s => String(s).replace(/\$/g, '');
