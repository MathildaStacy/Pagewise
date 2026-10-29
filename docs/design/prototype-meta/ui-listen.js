/* Pagewise Meta 风原型 · 听讲流程：按步讲解、快捷动作、小测、续学、岔路与折叠、自由提问（交互以 explore/src/app.js 为准） */
'use strict';
const REVIEW_342 = {
  title: '复习卡点：为什么扩展时才做目标测试',
  steps: ['读取卡点和上次的问答（3.4.2）', '读取 3.4.2 Dijkstra算法或一致代价搜索（p.90–93）'],
  answer: [
    '上次卡在：**为什么目标测试要放在扩展时，而不是生成时。**用书里这张图说明 [[b:b0903]]：',
    '{{fig:f310}}',
    '1. 扩展 S，生成 A（g=1）和 B（g=3）。\n2. 扩展代价最小的 A，生成 G，此时 g(G)=11。\n3. 如果**生成时**就测试，这里就返回了代价 11 的路。\n4. 但边界里还有 B（g=3）。继续扩展 B，会发现经 B 到 G 只要 4。',
    '所以一致代价搜索要等到 G 作为边界里代价最小的结点被**取出扩展**时才测试 [[b:b0902]]，这时它一定是最便宜的 [[b:b0904]]。这回清楚了吗？'
  ].join('\n\n'),
  again: '换个比喻：**生成**像是看到一块写着「终点」的路牌，**扩展**像是真的开到了终点，并且确认没有更近的路。看到第一块路牌就停车，那块路牌可能就在一条绕远的路上 [[b:b0902]]。\n\n图里 A→G 那条边代价 10，就是那条「绕远的路」 [[b:b0903]]。'
};
const GENERIC = '（原型演示）实际 App 会把你的问题连同 3.5.2 当前这一步的原文一起发给 AI，回答里依赖书的说法都带页码，比如 [[b:b1025]]。如果引用了本轮没有读取的原文，会显示成这样 [[b:b0905]]。\n\n可以试着问「这跟前面的一致代价搜索有什么关系？」体验岔路。';
const NO_SCRIPT = '原型的讲解脚本只写到 3.5.2';

const ST = () => S.study;
const hasScript = () => !!LESSON[ST().sec];
const target = () => ST().detour ? ST().detour.items : ST().msgs;
function allowedNow() {
  const st = ST();
  return blocksOfSec(st.sec).map(b => b.id).concat(st.detour ? blocksOfSec(st.detour.sec).map(b => b.id) : []);
}
function studyRefresh() {
  const st = ST();
  if (cur().name !== 'study' || st.mode !== 'listen') return;
  refresh();
  const v = $('#view'); v.scrollTop = v.scrollHeight;
}
function updateStream(it) {
  const el = document.getElementById('b-' + it.id);
  if (!el) return;
  el.innerHTML = md(it._at.slice(0, it.shown).join(''), it.allowed) + '<span class="caret"></span>';
  const v = $('#view'); v.scrollTop = v.scrollHeight;
}
// AI 回答：先出「正在输入」，再逐项出现；讲解、推导、举例逐字流式
async function say(items) {
  const st = ST(), tgt = target();
  st.busy = true;
  const ty = { k: 'typing', id: uid() };
  tgt.push(ty); studyRefresh(); await sleep(560); tgt.splice(tgt.indexOf(ty), 1);
  for (const raw of items) {
    if (st.stopped) break;
    const it = Object.assign({ id: uid(), dt: !!st.detour, allowed: allowedNow(), enter: true }, raw);
    tgt.push(it);
    if (it.k === 'tool') {
      it.n = 0;
      for (let i = 0; i < it.lines.length; i++) { it.n = i + 1; studyRefresh(); await sleep(520); }
      it.n = it.lines.length + 1; continue;
    }
    if (it.t && (it.k === 'ai' || it.k === 'derive' || it.k === 'ex')) {
      it._at = atoms(it.t); it.shown = 0; studyRefresh();
      for (let i = 0; i <= it._at.length; i += 4) { if (st.stopped) { it.t = it._at.slice(0, i).join(''); break; } it.shown = i; updateStream(it); await sleep(16); }
      it.shown = null; studyRefresh(); await sleep(140); continue;
    }
    studyRefresh(); await sleep(260);
  }
  if (st.stopped) showToast('已停止');
  st.stopped = false; st.busy = false; studyRefresh();
}
function user(text, extra) {
  const st = ST();
  target().push(Object.assign({ k: 'user', id: uid(), t: text, dt: !!st.detour, enter: true }, extra || {}));
  studyRefresh();
}
function guard() { if (ST().busy) { showToast('正在回答…'); return false; } return true; }
const clone1 = a => a.map(x => Object.assign({}, x));

// ---------- 按步讲解 ----------
async function teachStep(i) {
  const st = ST();
  st.phase = 'teach';
  if (st.ss[st.cur] === 'now' && st.cur !== i) st.ss[st.cur] = 'todo';
  st.cur = i; st.ss[i] = 'now';
  st.msgs.push({ k: 'head', i, id: uid(), enter: true });
  if (!hasScript()) {
    return say([{ k: 'tool', lines: ['读取 ' + st.sec + ' 第 ' + (i + 1) + '/' + st.n + ' 步原文（' + st.steps[i].p + '）'] },
      { k: 'ai', t: '开始讲「' + st.steps[i].t + '」。\n\n（原型演示：讲解脚本只写到 3.5.2。实际 App 在这里会按同样的规则讲：先直觉，再定义和公式，再举书里的例子，最后用一个问题确认你懂了。）' }]);
  }
  await say(clone1(LESSON[st.sec][i]));
}
async function startSection() {
  // 新的一节：先生成本节路线图，再讲第 1 步
  const st = ST();
  await say([{ k: 'tool', lines: ['读取 ' + secName(st.sec) + '（' + pagesOf(st.sec) + '）', '生成本节路线图：' + st.n + ' 步'] }]);
  await teachStep(0);
}
function nextIndex(st) { for (let i = st.cur + 1; i < st.n; i++) if (st.ss[i] !== 'done') return i; return -1; }
function actNext() {
  if (!guard()) return;
  const st = ST(); if (!hasScript()) return showToast(NO_SCRIPT);
  st.ss[st.cur] = 'done';
  const nx = nextIndex(st);
  if (nx < 0) {
    if (S.prefs.quizEnd) { st.msgs.push({ k: 'quiz', id: uid(), qi: st.n - 1, final: true, enter: true }); st.phase = 'quiz'; return studyRefresh(); }
    return becomeReady();
  }
  teachStep(nx);
}
function becomeReady() {
  const st = ST();
  st.phase = 'ready';
  st.msgs.push({ k: 'done', id: uid(), enter: true });
  studyRefresh();
}
function actSkip() {
  if (!guard()) return;
  const st = ST(); if (!hasScript()) return showToast(NO_SCRIPT);
  if (nextIndex(st) < 0) return showToast('最后一步不能跳过');
  st.ss[st.cur] = 'skipped';
  st.msgs.push({ k: 'sys', id: uid(), t: (SKIP_NOTE[st.sec] || [])[st.cur] || '跳过了第 ' + (st.cur + 1) + ' 步' });
  const nx = nextIndex(st); st.cur = nx;   // 不把跳过的步改回 todo
  teachStep(nx);
}
function actAlt(kind) {
  if (!guard()) return;
  const st = ST(); if (!hasScript()) return showToast(NO_SCRIPT);
  user({ re: '换个说法', ex: '举个例子', dv: '展开推导' }[kind]);
  if (kind === 're') addCand(st.cur);
  say([{ k: kind === 'ex' ? 'ex' : kind === 'dv' ? 'derive' : 'ai', t: ALT[st.sec][st.cur][kind] }]);
}
function actQuiz() {
  if (!guard()) return;
  const st = ST(); if (!hasScript()) return showToast(NO_SCRIPT);
  user('考考我');
  st.msgs.push({ k: 'quiz', id: uid(), qi: st.cur, enter: true }); studyRefresh();
}
function actSource() { setMode('read'); }
function addCand(i) { const st = ST(); if (CAND[i] && !st.stuckCand.includes(CAND[i])) st.stuckCand.push(CAND[i]); }
async function answerQuiz(m, k) {
  const st = ST();
  if (m.pick != null || st.busy) return;
  const qz = QUIZ[st.sec][m.qi];
  m.pick = k; studyRefresh();
  if (k === qz.ans) await say([{ k: 'ai', t: qz.fb }]);
  else {
    addCand(m.qi);
    await say([{ k: 'ai', t: '不太对，正确答案是「' + qz.ops[qz.ans] + '」。我换个角度再讲一次。\n\n' + ALT[st.sec][m.qi].re }, { k: 'prop', x: CAND[m.qi], sec: st.sec }]);
  }
  if (m.final) becomeReady();
}

// ---------- 续学 ----------
function resumeGo() { const st = ST(); if (st.busy) return; const r = st.msgs.find(m => m.k === 'resume'); if (r) r.done = 'go'; teachStep(st.cur); }
async function resumeReview() {
  const st = ST(); if (st.busy) return;
  const r = st.msgs.find(m => m.k === 'resume'); if (r) r.done = 'review';
  user('先复习卡点');
  openDetour('3.4.2', REVIEW_342.title, true);
  await say([{ k: 'tool', lines: REVIEW_342.steps }, { k: 'ai', t: REVIEW_342.answer }]);
}
async function reviewAgain() { if (!guard()) return; user('还是不太懂'); await say([{ k: 'ai', t: REVIEW_342.again }]); }
function reviewOk(text) {
  if (!guard()) return;
  const s = S.stuck.find(x => x.id === 's1'); if (s) s.ok = true;
  user(typeof text === 'string' ? text : '清楚了，继续 ' + ST().sec);
  showToast('卡点「' + s.x.slice(0, 10) + '…」已标为掌握', 'ok');
  backMain(true);
}

// ---------- 岔路：进行中左侧靛蓝竖线，回到主线后折叠成「已解决」 ----------
function openDetour(sec, title, reviewing) {
  const st = ST();
  st.detour = { sec, title, reviewing: !!reviewing, items: [] };
  st.msgs.push({ k: 'detour', id: uid(), d: st.detour });
}
async function enterDetour(sec, text, quote) {
  const st = ST(), D = DETOURS[sec];
  openDetour(sec, D.qa.q);
  user(text, quote ? { quote } : null);
  await say([{ k: 'tool', lines: D.steps }, { k: 'ai', t: D.answer }]);
  (S.qa[sec] = S.qa[sec] || []).push(Object.assign({ from: st.sec }, D.qa));
  st.detourLog.push({ sec, q: text });
  showToast('这段问答已记入 ' + sec + ' 的学习记录', 'dt');
}
async function backMain(silent) {
  const st = ST(), d = st.detour; if (!d) return;
  if (!silent) { if (!guard()) return; user('回到主线'); }
  const i = st.msgs.findIndex(m => m.k === 'detour' && m.d === d);
  st.msgs[i] = { k: 'fold', id: uid(), open: false, title: d.title, items: d.items };
  st.detour = null;
  if (!d.reviewing) showToast('岔路已折叠，问答记进了 ' + d.sec + ' 的笔记', 'dt');
  if (st.phase === 'resume') { const r = st.msgs.find(m => m.k === 'resume'); if (r) r.done = r.done || 'review'; return teachStep(st.cur); }
  st.msgs.push({ k: 'sys', id: uid(), t: '回到主线 · 第 ' + (st.cur + 1) + ' 步 ' + st.steps[st.cur].t });
  if (!hasScript()) return studyRefresh();
  await say([{ k: 'ai', t: '回到 A*：刚才讲到第 ' + (st.cur + 1) + ' 步「' + st.steps[st.cur].t + '」。' + (d.sec === '3.4.2' && !d.reviewing ? '记住刚才的结论，h≡0 时 A* 就是一致代价搜索。' : '') + (st.phase === 'ready' ? '这一节已经讲完，可以进入下一节了。' : '准备好了就点「懂了，下一步」。') }]);
}

// ---------- 自由提问 ----------
async function sendText() {
  const st = ST(), inp = $('#cin');
  const text = ((inp && inp.value) || '').trim();
  if (!text || !guard()) return;
  inp.value = '';
  const quote = st.quote, qb = quote ? BLK[quote] : null; st.quote = null;
  st.asked++;
  if (st.detour && /^回|主线/.test(text)) { user(text); return backMain(true); }
  if (st.detour && st.detour.reviewing && /清楚|懂了|明白/.test(text)) return reviewOk(text);
  if (!st.detour) {
    const dsec = qb && DETOURS[qb.sec] && qb.sec !== st.sec ? qb.sec : Object.keys(DETOURS).find(k => DETOURS[k].match.test(text));
    if (dsec && dsec !== st.sec) return enterDetour(dsec, text, quote);
  }
  user(text, quote ? { quote } : null);
  if (st.detour && /快|效率|更少|一定/.test(text)) return say([{ k: 'ai', t: '不一定更快，但 h 越准，A* 扩展的结点越少；h 可容许时两者找到的都是最优解 [[b:b1025]]。h≡0 时两者扩展的结点完全一样 [[b:b0902]]。' }]);
  const hit = FREE.find(f => f.match.test(text + (qb ? qb.x : '')));
  if (hit) return say([{ k: 'ai', t: hit.a }]);
  if (qb) return say([{ k: 'ai', t: '这段在说：' + qb.gist + ' [[b:' + qb.id + ']]\n\n（原型演示：实际回答会结合你的问题和这一段的上下文。）' }]);
  say([{ k: 'ai', t: GENERIC }]);
}
function stopAnswer() { const st = ST(); if (st.busy) st.stopped = true; }

// ---------- 路线图：点某一步 ----------
function tapStep(i) {
  const st = ST();
  if (st.busy) return showToast('正在回答…');
  if (st.mode !== 'listen') setMode('listen');
  if (st.ss[i] === 'done' && i === 0 && !st.histOpen && !$('#step-0')) { st.histOpen = true; refresh(); }
  const el = $('#step-' + i);
  if (el) return el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  if (!hasScript()) return showToast(NO_SCRIPT);
  sheet({ title: '从第 ' + (i + 1) + ' 步开始讲？', body: '<p class="sp">「' + esc(st.steps[i].t) + '」· ' + st.steps[i].p + '。中间没讲的步骤会留着，随时可以回来讲。</p>', acts: [['开始讲', () => jumpTo(i), 'pri'], ['取消', closeOverlay]] });
}
function jumpTo(i) {
  closeOverlay(true);
  const st = ST();
  if (st.phase === 'resume') { const r = st.msgs.find(m => m.k === 'resume'); if (r) r.done = 'go'; }
  if (st.mode !== 'listen') { st.mode = 'listen'; refresh(); }
  teachStep(i);
}
function finishSection() { if (!guard()) return; if (!hasScript()) return showToast(NO_SCRIPT); go('done'); }

// ---------- 模式切换：读书 ⇄ 听讲，位置不丢（05 §9） ----------
function stepOfBlock(id) { return ST().steps.findIndex(s => s.blocks.includes(id)); }
function setMode(m, focus) {
  const st = ST();
  if (cur().name !== 'study') { st.mode = m; st.focus = focus; return openStudy(); }
  if (m === st.mode && !focus) return;
  if (m === 'listen') {
    let b = focus;
    if (!b && st.mode === 'read') { const v = $('#view'), y = $('#head').getBoundingClientRect().bottom + 40; b = ($$('.blk', v).find(el => el.getBoundingClientRect().bottom > y) || {}).id; }
    st.mode = 'listen'; render(true);
    const v = $('#view'); v.scrollTop = v.scrollHeight;
    const s = b ? stepOfBlock(b) : -1;
    if (s < 0) return;
    const head = $('#step-' + s);
    if (head && st.ss[s] !== 'todo') { head.scrollIntoView({ block: 'start' }); if (!focus) showToast('听讲 · 第 ' + (s + 1) + ' 步'); }
    else if (focus) { if (st.busy) return; if (st.ss[s] === 'now') return showToast('正在讲第 ' + (s + 1) + ' 步'); jumpTo(s); }
    return;
  }
  st.mode = 'read'; render(true);
  flashBlock(focus || (st.steps[st.cur] || { blocks: [] }).blocks[0]);
}
function flashBlock(id) {
  const el = id && document.getElementById(id); if (!el) return;
  const v = $('#view'); v.scrollTop += el.getBoundingClientRect().top - v.getBoundingClientRect().top - v.clientHeight / 2 + 40;
  el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2000);
}
