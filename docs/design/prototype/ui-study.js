/* Pagewise 原型 · 伴读（一）：流式输出与讲解流程 */
'use strict';
const REVIEW_342 = {
  steps: ['读取卡点和上次的问答（3.4.2）', '读取 3.4.2 Dijkstra算法或一致代价搜索（p.90–93）'],
  answer: [
    '上次卡在：**为什么目标测试要放在扩展时，而不是生成时。**用书里这张图说明 [[b:b0903]]：',
    '{{fig:f310}}',
    '1. 扩展 S，生成 A（g=1）和 B（g=3）。\n2. 扩展代价最小的 A，生成 G，此时 g(G)=11。\n3. 如果**生成时**就测试，这里就返回了代价 11 的路。\n4. 但边界里还有 B（g=3）。继续扩展 B，会发现经 B 到 G 只要 4。',
    '所以一致代价搜索要等到 G 作为边界里代价最小的节点被**取出扩展**时才测试 [[b:b0902]]，这时它一定是最便宜的 [[b:b0904]]。',
    '这回清楚了吗？'
  ].join('\n\n'),
  again: [
    '换个比喻：**生成**像是看到一块写着「终点」的路牌，**扩展**像是真的开到了终点，并且确认没有更近的路。看到第一块路牌就停车，那块路牌可能就在一条绕远的路上 [[b:b0902]]。',
    '图里 A→G 那条边代价 10，就是那条「绕远的路」 [[b:b0903]]。'
  ].join('\n\n')
};
const GENERIC = [
  '（原型演示）实际 App 会把你的问题连同 3.5.2 当前段的原文一起发给 AI，回答里依赖书的说法都带页码，比如 [[b:b1025]]。如果引用了本轮没有读取的原文，会显示成这样 [[b:b0905]]。',
  '可以试着问「这跟前面的一致代价搜索有什么关系？」体验岔路。'
].join('\n\n');

const ST = () => S.study;
function openStudy() { if (cur().name !== 'study') go('study'); }
function allowedNow() {
  const st = ST();
  return blocksOfSec(st.sec).map(b => b.id).concat(st.detour ? blocksOfSec(st.detour).map(b => b.id) : []);
}
function studyRefresh() {
  if (cur().name !== 'study') return;
  refresh();
  const v = $('#view'); v.scrollTop = v.scrollHeight;
}
function updateStream(m) {
  const el = document.getElementById('m' + ST().msgs.indexOf(m));
  if (!el) return;
  el.innerHTML = md(m._at.slice(0, m.shown).join(''), m.allowed) + '<span class="caret"></span>';
  const v = $('#view'); v.scrollTop = v.scrollHeight;
}
async function say(text, extra) {
  const st = ST();
  const m = Object.assign({ r: 'a', text, dt: !!st.detour, allowed: allowedNow(), shown: 0, _at: atoms(text) }, extra || {});
  st.msgs.push(m); st.busy = true; studyRefresh();
  for (let i = 0; i <= m._at.length; i += 4) { m.shown = i; updateStream(m); await sleep(18); }
  m.shown = null; st.busy = false; studyRefresh();
}
async function steps(items) {
  const st = ST();
  const m = { r: 'steps', items, n: 0, dt: !!st.detour };
  st.msgs.push(m); st.busy = true;
  for (let i = 0; i < items.length; i++) { m.n = i + 1; studyRefresh(); await sleep(520); }
  st.busy = false;
}
function user(text, extra) { const st = ST(); st.msgs.push(Object.assign({ r: 'u', text, dt: !!st.detour }, extra || {})); studyRefresh(); }
function partPages(sec, i) { return partBlocks(sec, i).map(id => 'p.' + BLK[id].p).filter((v, k, a) => a.indexOf(v) === k).join('、'); }

// ---------- 讲解流程 ----------
async function teachPart(i) {
  const st = ST(), sc = SCRIPT[st.sec];
  st.phase = 'teach'; st.part = i;
  st.msgs.push({ r: 'divd', text: '第 ' + (i + 1) + ' 段 · ' + PARTS[st.sec][i].name });
  if (!sc) {
    await steps(['读取 ' + st.sec + ' 第 ' + (i + 1) + '/' + st.n + ' 段原文（' + pagesOf(st.sec) + '）']);
    return say('开始 ' + secName(st.sec) + '。\n\n（原型演示：讲解脚本只写到 3.5.2。实际 App 在这里会按同样的规则讲新的一节：先直觉，再定义和公式，再举书里的例子，最后用一个问题确认你懂了。）');
  }
  await steps(['读取 ' + st.sec + ' 第 ' + (i + 1) + '/' + st.n + ' 段原文（' + partPages(st.sec, i) + '）']);
  await say(sc.teach[i]);
  if (i === st.n - 1) { st.msgs.push({ r: 'quiz', qi: i, final: true }); st.phase = 'quiz'; studyRefresh(); }
}
function guard() { const st = ST(); if (st.busy) { showToast('正在回答…'); return false; } return true; }
function actNext() {
  if (!guard()) return;
  const st = ST();
  if (!SCRIPT[st.sec]) return showToast('原型的讲解脚本只写到 3.5.2');
  user('懂了，继续');
  if (st.part < st.n - 1) teachPart(st.part + 1);
}
function actAlt() {
  if (!guard()) return;
  const st = ST(), sc = SCRIPT[st.sec]; if (!sc) return showToast('原型的讲解脚本只写到 3.5.2');
  user('换个说法');
  addCand(st.part);
  say(sc.alt[st.part]);
}
function actExample() {
  if (!guard()) return;
  const st = ST(), sc = SCRIPT[st.sec]; if (!sc) return showToast('原型的讲解脚本只写到 3.5.2');
  user('举个例子'); say(sc.example[st.part]);
}
function actDerive() {
  if (!guard()) return;
  const st = ST(), sc = SCRIPT[st.sec]; if (!sc) return showToast('原型的讲解脚本只写到 3.5.2');
  user('展开推导');
  say(sc.derive[st.part] || '这一段没有需要推导的地方：书里只给了定义 [[b:' + partBlocks(st.sec, st.part).slice(-1)[0] + ']]。下一段的一致性会有一个小推导。');
}
function actQuiz() {
  if (!guard()) return;
  const st = ST(); if (!SCRIPT[st.sec]) return showToast('原型的讲解脚本只写到 3.5.2');
  user('考考我');
  st.msgs.push({ r: 'quiz', qi: st.part }); studyRefresh();
}
const CAND = ['只看 g 或只看 h 的局限', '可容许的含义：为什么「不高估」就能保证最优', '一致性和可容许的区别', '可容许保证最优的反证法'];
function addCand(i) { const st = ST(); if (!st.stuckCand.includes(CAND[i])) st.stuckCand.push(CAND[i]); }
async function answerQuiz(m, k) {
  const st = ST();
  if (m.pick != null || st.busy) return;
  const qz = SCRIPT[st.sec].quiz[m.qi];
  m.pick = k; studyRefresh();
  if (k === qz.ans) {
    await say(qz.fb);
    if (m.final) { st.quizRight = true; st.phase = 'ready'; studyRefresh(); }
  } else {
    addCand(m.qi);
    await say('不太对，正确答案是「' + qz.ops[qz.ans] + '」。我换个角度再讲一次。\n\n' + SCRIPT[st.sec].alt[m.qi]);
    st.msgs.push({ r: 'prop', kind: 'stuck', x: CAND[m.qi], sec: st.sec }); studyRefresh();
    if (m.final) { st.quizRight = true; st.phase = 'ready'; studyRefresh(); }
  }
}

// ---------- 续学 ----------
async function resumeGo() {
  const st = ST(); if (st.busy) return;
  const r = st.msgs.find(m => m.r === 'resume'); if (r) r.done = 'go';
  await teachPart(1);
}
async function resumeReview() {
  const st = ST(); if (st.busy) return;
  const r = st.msgs.find(m => m.r === 'resume'); if (r) r.done = 'review';
  user('先复习卡点');
  st.detour = '3.4.2'; st.reviewing = true;
  st.msgs.push({ r: 'divd', text: '岔路 · ' + secName('3.4.2'), dt: true });
  await steps(REVIEW_342.steps);
  await say(REVIEW_342.answer);
}
async function reviewAgain() { if (!guard()) return; user('还是不太懂'); await say(REVIEW_342.again); }
function reviewOk() {
  if (!guard()) return;
  const s = S.stuck.find(x => x.id === 's1'); if (s) s.ok = true;
  user('清楚了，继续 A*');
  showToast('卡点「' + s.x.slice(0, 10) + '…」已标为掌握', 'ok');
  backMain(true);
}

// ---------- 岔路 ----------
async function enterDetour(sec, qText) {
  const st = ST(), D = DETOURS[sec];
  st.detour = sec;
  st.msgs.push({ r: 'divd', text: '岔路 · ' + secName(sec), dt: true });
  await steps(D.steps);
  await say(D.answer);
  (S.qa[sec] = S.qa[sec] || []).push(Object.assign({ from: st.sec }, D.qa));
  st.detourLog.push({ sec, q: qText || D.qa.q });
  showToast('这段问答已记入 ' + sec + ' 的学习记录', 'dt');
}
async function backMain(silent) {
  const st = ST();
  if (!silent) { if (!guard()) return; user('回到主线'); }
  const from = st.detour;
  st.detour = null; st.reviewing = false;
  st.msgs.push({ r: 'divd', text: '回到主线 · ' + secName(st.sec) });
  const r = st.msgs.find(m => m.r === 'resume');
  if (st.phase === 'resume' || (r && r.done === 'review' && st.part === 0)) return teachPart(1);
  if (!SCRIPT[st.sec]) return say('回到 ' + st.sec + '，我们接着来。');
  const name = PARTS[st.sec][st.part].name;
  await say('回到 A*：刚才讲到第 ' + (st.part + 1) + ' 段「' + name + '」。' + (from === '3.4.2' ? '记住刚才的结论，h≡0 时 A* 就是一致代价搜索，' : '') + (st.phase === 'ready' ? '这一节已经讲完，可以进入下一节了。' : '准备好了就点「懂了，继续」。'));
}

// ---------- 自由提问 ----------
async function sendText() {
  const st = ST();
  const ta = $('#cin'); const text = (ta.value || '').trim();
  if (!text || !guard()) return;
  const quote = st.quote; st.quote = null;
  user(text, quote ? { quote } : null);
  const qb = quote ? BLK[quote] : null;
  if (st.detour && /回|主线|继续/.test(text)) return backMain(true);
  if (st.reviewing && /清楚|懂了|明白/.test(text)) return reviewOk();
  const dsec = qb && DETOURS[qb.sec] && qb.sec !== st.sec ? qb.sec : Object.keys(DETOURS).find(k => k !== st.detour && DETOURS[k].match.test(text));
  if (dsec && dsec !== st.sec) return enterDetour(dsec, text);
  const hit = FREE.find(f => f.match.test(text + (qb ? qb.x : '')));
  if (hit) return say(hit.a);
  if (qb) return say('这段在说：' + qb.gist + ' [[b:' + qb.id + ']]\n\n（原型演示：实际回答会结合你的问题和这一段的上下文。）');
  say(GENERIC);
}
