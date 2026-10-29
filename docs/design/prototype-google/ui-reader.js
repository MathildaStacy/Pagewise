/* Pagewise 新谷歌风原型 · 读书：原版 / 重排、本节导读、讲过的段落、问答便签、段落编辑菜单、读完这一节 */
'use strict';
function readTool(sec) {
  const st = S.study, s = S.sec[sec];
  const hint = s.status === 'done' ? '已学' : sec === st.sec ? (st.phase === 'resume' ? '讲完第 1 步' : '讲到第 ' + (st.cur + 1) + ' 步') : '';
  return '<div class="rdtool">' + segHtml([['orig', '原版'], ['flow', '重排']], S.readerMode, k => { S.readerMode = k; refresh(); }) + '<span class="pgi">' + hint + (hint ? '<br>' : '') + '点段落可解释、提问</span></div>';
}
function readerMarks(sec) {
  const st = S.study, s = S.sec[sec], heard = new Set(), now = new Set();
  if (s.status === 'done') blocksOfSec(sec).forEach(b => heard.add(b.id));
  if (sec === st.sec) st.steps.forEach((x, i) => {
    if (st.ss[i] === 'done') x.blocks.forEach(id => heard.add(id));
    if (i === st.cur && st.ss[i] === 'now' && st.phase !== 'resume') x.blocks.forEach(id => now.add(id));
  });
  return { heard, now };
}
function blockHtml(b, mk) {
  const cl = ['blk', b.t === 'title' ? 'b-title' : b.t === 'eq' ? 'b-eq' : '', mk.heard.has(b.id) ? 'heard' : '', mk.now.has(b.id) ? 'now' : '', S.hl[b.id] ? 'hl' : ''].join(' ');
  const inner = b.t === 'image' ? figHtml(b.fig) : b.t === 'eq' ? '<span class="math blk">' + esc(plain(b.x)) + '</span>' : inline(b.x);
  const pin = S.pins[b.id];
  return '<div class="' + cl + '" id="' + b.id + '" onclick="' + on(e => blockMenu(e, b.id)) + '">' + inner + '</div>' +
    (pin ? '<button class="pin" onclick="' + on(() => openPin(b.id)) + '">' + I('pin') + '<span>已解决：' + esc(pin.q) + '</span></button>' : '');
}
function readerBody(sec) {
  const s = S.sec[sec], st = S.study, main = sec === st.sec, mk = readerMarks(sec), ch = chapterOf(sec), par = S.sec[s.parent];
  const g = main && GUIDE[sec];
  let h = g ? '<button class="guide' + (st.guide ? ' open' : '') + '" aria-expanded="' + st.guide + '" onclick="' + on(() => { st.guide = !st.guide; refresh(); }) + '"><span class="lbl">' + I('spark') + '本节导读</span><span class="gt' + (st.guide ? '' : ' one') + '">' + esc(st.guide ? g.full : g.one) + '</span>' + I('chev') + '</button>' : '';
  h += '<div class="pages">';
  if (S.readerMode === 'flow') {
    h += '<article class="page">';
    let lastP = 0;
    blocksOfSec(sec).forEach(b => {
      if (b.p !== lastP) { if (lastP) h += '<div class="pno">— ' + lastP + ' —</div>'; lastP = b.p; }
      h += blockHtml(b, mk);
    });
    h += '<div class="pno">— ' + lastP + ' —</div></article>';
  } else {
    for (let pg = s.p0; pg <= s.p1; pg++) {
      const bs = BLOCKS.filter(b => b.p === pg && b.sec === sec);
      h += '<article class="page orig" id="pg' + pg + '"><div class="run"><span>' + esc(secName(ch.id)) + '</span><span>' + esc(par ? secName(par.id) : '') + '</span></div>' +
        (bs.length ? bs.map(b => blockHtml(b, mk)).join('') : '<div class="pph">这一页的正文没有放进原型<br>（原型只为 3.4.2、3.5.1、3.5.2 写了示意内容）</div>') + '<div class="pno">' + pg + '</div></article>';
    }
  }
  h += '</div>';
  if (main && hasScript()) h += '<div class="readend"><button class="btn pri" onclick="finishSection()">读完这一节</button><small>和听讲一样生成摘要和闪卡草稿</small></div>';
  return h + '<div class="rfoot">示意内容，不是原书文字 · 左侧细线 = 听讲已讲过</div>';
}

// ---------- 段落菜单（Android 文字选择工具栏）：解释 · 翻译 · 问 AI · 从这里开始讲 · 高亮 · 笔记 ----------
function blockMenu(e, id) {
  const b = BLK[id];
  if (b.t === 'title') return;
  e.stopPropagation();
  const el = document.getElementById(id);
  $$('.blk.sel').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
  editMenu(el, [['解释', () => explainBlock(id)], ['翻译', () => translateBlock(id)], ['问 AI', () => askBlock(id)], ['从这里开始讲', () => startHere(id)],
    [S.hl[id] ? '取消高亮' : '高亮', () => { S.hl[id] = !S.hl[id]; refresh(); showToast(S.hl[id] ? '已高亮，可在笔记里查看' : '已取消高亮'); }], ['笔记', () => noteBlock(id)]]);
  setTimeout(() => el.classList.add('sel'), 0);
}
function startHere(id) {
  const b = BLK[id];
  if (b.sec === S.study.sec) return setMode('listen', id);
  startAt(b.sec);
}
const quoteHtml = b => '<p class="sp quote">' + (b.t === 'image' ? esc(b.x) : inline(b.x)) + '</p>';
function explainBlock(id) {
  const b = BLK[id];
  const ans = (b.gist || '这一段是图或标题，没有需要解释的地方。') + (b.gist ? ' [[b:' + id + ']]' : '');
  sheet({ title: '解释', sub: 'p.' + b.p + ' · ' + esc(secName(b.sec)) + ' · 整理模型', body: quoteHtml(b) + '<div class="ai" id="xans"><div class="typing"><i></i><i></i><i></i></div></div>',
    acts: [['带到听讲里继续问', () => askBlock(id), 'pri'],
      ['好的', () => { closeOverlay(); if (b.gist && !S.pins[id]) { S.pins[id] = { q: '这段在说什么', a: ans }; refresh(); showToast('已贴成问答便签', 'ok'); } }],
      ['记为卡点', () => { S.stuck.unshift({ id: 'sx' + Date.now(), sec: b.sec, x: plain(b.gist || b.x).slice(0, 30), ok: false }); closeOverlay(); showToast('已记为卡点'); }]] });
  setTimeout(() => { const x = $('#xans'); if (x) x.innerHTML = md(ans, [id]); }, REDUCED ? 0 : 650);
}
function translateBlock(id) {
  const b = BLK[id];
  sheet({ title: '翻译', sub: 'p.' + b.p + ' · 整理模型', body: quoteHtml(b) + '<div class="note">原型没有准备翻译内容。实际 App 会用整理模型把这一段译成英文（或把英文书译成中文），术语和书的地图里的译名保持一致。</div>', acts: [['好的', closeOverlay, 'pri']] });
}
function askBlock(id) {
  closeOverlay(true);
  S.study.quote = id;
  if (cur().name === 'study') { S.study.mode = 'listen'; render(true); }
  else if (R.stack.length > 1 && R.stack[R.stack.length - 2].name === 'study') { S.study.mode = 'listen'; back(); }
  else { S.study.mode = 'listen'; openStudy(); }
  setTimeout(() => { const t = $('#cin'); if (t) t.focus(); }, 60);
}
function noteBlock(id) {
  const b = BLK[id];
  modal({ title: '记笔记 · p.' + b.p, body: quoteHtml(b) + '<textarea id="nb" class="edt" placeholder="写下你的理解"></textarea>', ok: '保存', onOk: () => {
    const v = ($('#nb').value || '').trim(); if (!v) return false;
    S.userNote[b.sec] = (S.userNote[b.sec] ? S.userNote[b.sec] + '\n' : '') + 'p.' + b.p + '：' + v;
    setTimeout(() => showToast('已保存到 ' + b.sec + ' 的笔记', 'ok'), 200);
  } });
  setTimeout(() => $('#nb') && $('#nb').focus(), 300);
}
function openPin(id) {
  const p = S.pins[id];
  sheet({ title: esc(p.q), sub: '问答便签 · p.' + BLK[id].p, body: '<div class="ai" style="font-size:16px">' + md(p.a, [id]) + '</div>', acts: [['在听讲里继续问', () => askBlock(id), 'pri'], ['好的', closeOverlay]] });
}

// ---------- 单独打开的读书页（非主线小节，或从笔记、复习、搜索进来） ----------
SCREENS.reader = {
  title: p => secName(readerSec(p)), sub: p => pagesOf(readerSec(p)), short: '读书',
  right: () => modeSwitch('read', () => { if (R.stack.length > 1 && R.stack[R.stack.length - 2].name === 'study') { S.study.mode = 'listen'; back(); } else { S.study.mode = 'listen'; openStudy(); } }) + '<span style="width:48px;flex:none"></span>',
  top: p => readTool(readerSec(p)),
  render: p => readerBody(readerSec(p)),
  after(p, reset) { if (reset && p.block) flashBlock(p.block); }
};
function readerSec(p) { return p.block ? BLK[p.block].sec : (p.sec || S.study.sec); }
