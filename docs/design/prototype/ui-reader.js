/* Pagewise 原型 · 阅读器：原版 / 重排、讲过的段落、划词菜单 */
'use strict';
SCREENS.reader = {
  title: p => { const sec = readerSec(p); return '原文 · ' + esc(secName(sec)) + '<span class="sub">' + pagesOf(sec) + '</span>'; },
  navRight: () => modeSwitch('reader', () => { if (R.stack.length > 1 && R.stack[R.stack.length - 2].name === 'study') back(); else go('study'); }) + '<span style="width:40px;flex:none"></span>',
  top: p => {
    const sec = readerSec(p);
    return '<div class="rdtool"><div class="seg">' + [['orig', '原版'], ['flow', '重排']].map(([k, l]) => '<button class="' + (S.readerMode === k ? 'on' : '') + '" onclick="' + on(() => { S.readerMode = k; refresh(); }) + '">' + l + '</button>').join('') + '</div><span class="pgi">' + (S.sec[sec].status === 'done' ? '已学' : sec === S.study.sec ? '讲到第 ' + (S.study.part + 1) + ' 段' : '') + '　点段落可解释、提问</span></div>';
  },
  render(p) {
    const sec = readerSec(p), s = S.sec[sec];
    const ch = chapterOf(sec), par = S.sec[s.parent];
    const st = S.study;
    const taught = new Set(), curp = new Set();
    if (s.status === 'done') blocksOfSec(sec).forEach(b => taught.add(b.id));
    if (sec === st.sec && PARTS[sec]) {
      const lim = st.phase === 'resume' ? 0 : st.part;
      PARTS[sec].forEach((pt, i) => { if (i < lim || (i === lim && st.phase === 'ready')) pt.blocks.forEach(id => taught.add(id)); if (i === lim && st.phase !== 'resume') pt.blocks.forEach(id => curp.add(id)); });
      if (st.phase === 'resume') PARTS[sec][0].blocks.forEach(id => taught.add(id));
    }
    const flow = S.readerMode === 'flow';
    let h = '<div class="reader">';
    for (let pg = s.p0; pg <= s.p1; pg++) {
      const bs = BLOCKS.filter(b => b.p === pg);
      h += '<div class="page ' + (flow ? 'flow' : 'orig') + '" id="pg' + pg + '"><div class="run"><span>' + esc(secName(ch.id)) + '</span><span>' + esc(par ? secName(par.id) : '') + '</span></div>';
      if (!bs.length) h += '<div class="pph">这一页的正文没有放进原型<br>（原型只为 3.4.2、3.5.1、3.5.2 写了示意内容）</div>';
      bs.forEach(b => {
        const cl = 'blk ' + (b.t === 'title' ? 'title' : b.t === 'eq' ? 'eq' : '') + (taught.has(b.id) ? ' done' : '') + (curp.has(b.id) ? ' curp' : '') + (S.hl[b.id] ? ' hl' : '') + (p.block === b.id ? ' flash' : '');
        const body = b.t === 'image' ? figHtml(b.fig) : b.t === 'eq' ? '<span class="math blk">' + esc(b.x.replace(/\$/g, '')) + '</span>' : inline(b.x);
        h += '<div class="' + cl + '" id="' + b.id + '" onclick="' + on(e => selBlock(e, b.id)) + '">' + body + '</div>';
      });
      h += '<div class="pno">' + pg + '</div></div>';
    }
    return h + '</div><div class="muted" style="text-align:center;font-size:11px;padding:0 0 20px">示意内容，不是原书文字 · 左侧细线 = 伴读已讲过</div>';
  },
  after(p, reset) {
    if (!reset) return;
    const el = p.block ? document.getElementById(p.block) : null;
    if (el) { const v = $('#view'); v.scrollTop += el.getBoundingClientRect().top - v.getBoundingClientRect().top - 90; }
  }
};
function readerSec(p) { return p.block ? BLK[p.block].sec : (p.sec || S.study.sec); }

function selBlock(e, id) {
  e.stopPropagation();
  closeOverlay();
  document.querySelectorAll('.blk.sel').forEach(x => x.classList.remove('sel'));
  const el = document.getElementById(id); el.classList.add('sel');
  const app = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect();
  const m = document.createElement('div');
  m.className = 'selmenu';
  m.innerHTML = [['解释', () => explainBlock(id)], ['翻译', () => translateBlock(id)], ['问 AI', () => askBlock(id)], [S.hl[id] ? '取消高亮' : '高亮', () => { S.hl[id] = !S.hl[id]; closeOverlay(); refresh(); showToast(S.hl[id] ? '已高亮，可在笔记里查看' : '已取消高亮'); }], ['笔记', () => noteBlock(id)]]
    .map(([l, f]) => '<button onclick="' + on(ev => { ev.stopPropagation(); m.remove(); f(); }) + '">' + l + '</button>').join('');
  $('#app').appendChild(m);
  const top = Math.max(60, r.top - app.top - 46);
  m.style.top = top + 'px';
  m.style.left = Math.max(8, Math.min(app.width - m.offsetWidth - 8, r.left - app.left + r.width / 2 - m.offsetWidth / 2)) + 'px';
  setTimeout(() => document.addEventListener('click', function off() { const x = $('#app .selmenu'); if (x) x.remove(); document.querySelectorAll('.blk.sel').forEach(y => y.classList.remove('sel')); document.removeEventListener('click', off); }), 0);
}
function quoteHtml(b) { return '<div style="font-family:var(--serif);font-size:13px;line-height:1.8;color:var(--ink2);border-left:3px solid var(--hl);padding:2px 0 2px 10px;margin-bottom:10px">' + inline(b.x) + '</div>'; }
function explainBlock(id) {
  const b = BLK[id];
  sheet('解释', '<div class="sb">' + quoteHtml(b) + md((b.gist || '这一段是图或标题，没有需要解释的地方。') + (b.gist ? ' [[b:' + id + ']]' : ''), [id]) + '</div>' +
    '<div class="sf"><button class="btn ghost" onclick="' + on(() => { S.stuck.unshift({ id: 'sx' + Date.now(), sec: b.sec, x: (b.gist || b.x).replace(/\$/g, '').slice(0, 30), ok: false }); closeOverlay(); showToast('已记为卡点'); }) + '">记为卡点</button><button class="btn pri" onclick="' + on(() => askBlock(id)) + '">带到伴读里继续问</button></div>', 'p.' + b.p + ' · ' + secName(b.sec) + ' · 整理模型');
}
function translateBlock(id) {
  const b = BLK[id];
  sheet('翻译', '<div class="sb">' + quoteHtml(b) + '<div class="note">原型没有准备翻译内容。实际 App 会用整理模型把这一段译成英文（或把英文书译成中文），术语和书的地图里的译名保持一致。</div></div>', 'p.' + b.p);
}
function askBlock(id) {
  closeOverlay();
  S.study.quote = id;
  if (R.stack.length > 1 && R.stack[R.stack.length - 2].name === 'study') back(); else replace('study');
  setTimeout(() => { const t = $('#cin'); if (t) t.focus(); }, 30);
}
function noteBlock(id) {
  const b = BLK[id];
  modal({ title: '记笔记 · p.' + b.p, body: quoteHtml(b) + '<textarea id="nb" class="edt" placeholder="写下你的理解"></textarea>', ok: '保存', onOk: () => {
    const v = ($('#nb').value || '').trim(); if (!v) return false;
    S.userNote[b.sec] = (S.userNote[b.sec] ? S.userNote[b.sec] + '\n' : '') + 'p.' + b.p + '：' + v;
    showToast('已保存到 ' + b.sec + ' 的笔记', 'ok');
  } });
}
