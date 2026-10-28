/* Pagewise 原型 · UI 基础：路由、浮层、富文本、流式输出 */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 事件处理：把闭包登记到 H，返回可放进 onclick 的字符串
const H = [];
const on = fn => 'H[' + (H.push(fn) - 1) + '](event)';

// ---------- 路由 ----------
const R = { stack: [{ name: 'shelf', p: {} }] };
const SCREENS = {};
const TABS = [
  ['shelf', '书架', '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M15 5.5l3.6-1 3 14.6-3.6 1z"/>'],
  ['review', '复习', '<rect x="4" y="7" width="13" height="13" rx="2"/><path d="M8 4h10a2 2 0 012 2v11"/>'],
  ['notes', '笔记', '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>'],
  ['me', '我的', '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>']
];
function cur() { return R.stack[R.stack.length - 1]; }
function go(name, p) { closeOverlay(); R.stack.push({ name, p: p || {} }); render(true); }
function back() { closeOverlay(); if (R.stack.length > 1) { R.stack.pop(); render(true); } }
function tab(name) { closeOverlay(); R.stack = [{ name, p: {} }]; render(true); }
function replace(name, p) { closeOverlay(); R.stack[R.stack.length - 1] = { name, p: p || {} }; render(true); }
function render(resetScroll) {
  const c = cur(), sc = SCREENS[c.name];
  const view = $('#view'), st = view.scrollTop;
  const title = typeof sc.title === 'function' ? sc.title(c.p) : sc.title;
  const root = !!sc.root;
  $('#nav').className = 'nav' + (root ? ' root' : '');
  $('#nav').innerHTML = (root ? '' : '<button class="ib" onclick="back()" aria-label="返回">‹</button>') +
    '<h1>' + title + '</h1>' + (sc.navRight ? sc.navRight(c.p) : (root ? '' : '<span style="width:40px"></span>'));
  $('#top').innerHTML = sc.top ? sc.top(c.p) : '';
  view.innerHTML = sc.render(c.p);
  $('#bottom').innerHTML = sc.bottom ? sc.bottom(c.p) : '';
  const fab = $('#app > .fabi'); if (fab) fab.remove();
  const rootName = R.stack[0].name;
  $('#tabbar').style.display = root ? '' : 'none';
  const due = dueCards().length;
  $('#tabbar').innerHTML = TABS.map(([k, l, ic]) => '<button class="' + (k === rootName ? 'on' : '') + '" onclick="tab(\'' + k + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">' + ic + '</svg>' + l + (k === 'review' && due ? '<span class="badge">' + due + '</span>' : '') + '</button>').join('');
  view.scrollTop = resetScroll ? 0 : st;
  if (sc.after) sc.after(c.p, resetScroll);
  renderConsole();
}
function refresh() { render(false); }

// ---------- 浮层 ----------
function closeOverlay() { $('#overlay').innerHTML = ''; const m = $('#app .selmenu'); if (m) m.remove(); }
function modal(o) {
  // o: {title, body, ok, cancel, onOk, onCancel}
  const btns = [];
  if (o.cancel !== false) btns.push('<button onclick="' + on(() => { closeOverlay(); o.onCancel && o.onCancel(); }) + '">' + (o.cancel || '取消') + '</button>');
  btns.push('<button class="pri" onclick="' + on(() => { const r = o.onOk && o.onOk(); if (r !== false) closeOverlay(); }) + '">' + (o.ok || '确定') + '</button>');
  $('#overlay').innerHTML = '<div class="mask" onclick="if(event.target===this)closeOverlay()"><div class="dlg" role="dialog"><div class="dh">' + o.title + '</div><div class="db">' + o.body + '</div><div class="df">' + btns.join('') + '</div></div></div>';
}
function sheet(title, html, sub) {
  $('#overlay').innerHTML = '<div class="mask bottom" onclick="if(event.target===this)closeOverlay()"><div class="sheet" role="dialog"><div class="grab"></div><div class="sh">' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + html + '</div></div>';
}
function showToast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ---------- 富文本 ----------
// 标记：**粗体** $公式$ $$独立公式$$ [[b:块ID]] {{fig:ID}} 「- 」列表 「1. 」有序列表
function figHtml(id, blockId) {
  const f = FIGS[id];
  const tap = blockId ? ' onclick="' + on(() => openCite(blockId)) + '"' : '';
  return '<div class="fig"' + tap + '>' + f.svg + '<div class="cap">' + esc(f.cap) + '</div></div>';
}
function citeHtml(id, allowed) {
  const b = BLK[id];
  if (!b || (allowed && !allowed.includes(id))) return '<span class="unv">未核实</span>';
  const dt = S.study && b.sec !== S.study.sec;
  return '<span class="cite' + (dt ? ' dt' : '') + '" role="button" title="' + esc(secName(b.sec)) + '" onclick="' + on(() => openCite(id)) + '">p.' + b.p + '</span>';
}
function inline(s, allowed) {
  return esc(s)
    .replace(/\$\$([^$]+)\$\$/g, (_, m) => '<span class="math blk">' + m + '</span>')
    .replace(/\$([^$]+)\$/g, (_, m) => '<span class="math">' + m + '</span>')
    .replace(/\*\*([^\n]+?)\*\*/g, '<b>$1</b>')
    .replace(/\[\[b:([\w]+)\]\]/g, (_, id) => citeHtml(id, allowed))
    .replace(/\{\{fig:(\w+)\}\}/g, (_, id) => figHtml(id));
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
const atoms = text => text.match(/\$\$[^$]*\$\$|\$[^$]*\$|\*\*[^\n]+?\*\*|\[\[b:\w+\]\]|\{\{fig:\w+\}\}|[\s\S]/g) || [];
