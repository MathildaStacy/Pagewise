/* Pagewise 新谷歌风原型 · 状态与引擎（对应 docs/STUDY_ENGINE.md 的简化实现；听讲按「步」推进，见 docs/dev/05 §5） */
'use strict';
const clone = o => JSON.parse(JSON.stringify(o));
const BLK = Object.fromEntries(BLOCKS.map(b => [b.id, b]));
const SLM_CH = ['统计学习及监督学习概论', '感知机', 'k近邻法', '朴素贝叶斯法', '决策树', '逻辑斯谛回归与最大熵模型', '支持向量机', '提升方法', 'EM算法及其推广', '隐马尔可夫模型', '条件随机场', '监督学习方法总结', '无监督学习概论', '聚类方法', '奇异值分解', '主成分分析', '潜在语义分析', '概率潜在语义分析', '马尔可夫链蒙特卡罗法', '潜在狄利克雷分配', 'PageRank算法', '无监督学习方法总结'];
const DDIA_CH = ['Reliable, Scalable, and Maintainable Applications', 'Data Models and Query Languages', 'Storage and Retrieval', 'Encoding and Evolution', 'Replication', 'Partitioning', 'Transactions', 'The Trouble with Distributed Systems', 'Consistency and Consensus', 'Batch Processing', 'Stream Processing', 'The Future of Data Systems'];
const STAGES = ['上传', '排队', '解析', '下载结果', '建地图'];
const MINERU_MAX_PAGES = 200, MINERU_DAILY_PRIORITY_PAGES = 1000;   // 06 §2.1

let S;
function buildSections() {
  // AIMA 的地图：章（level 1）→ 节（level 2）→ 小节（level 3）
  const m = {}, order = [];
  const add = s => { m[s.id] = s; order.push(s.id); };
  CHAPTERS.forEach(([no, t, p0, p1, secs]) => {
    const chId = 'ch' + no;
    add({ id: chId, no, title: t, p0, p1, level: 1, status: no === '1' || no === '2' ? 'done' : no === '3' ? 'learning' : 'new', kids: [] });
    if (secs) secs.forEach(x => { const id = x.split(' ')[0]; add({ id, title: x.slice(id.length + 1), level: 2, parent: chId, status: 'done', summary: SUMMARY[id] }); m[chId].kids.push(id); });
    if (no === '3') CH3.forEach(([id, title, a, b, subs]) => {
      add({ id, title, p0: a, p1: b, level: 2, parent: chId, kids: subs.map(s => s[0]), status: subs.every(s => s[4] === 'done') ? 'done' : subs.some(s => s[4] !== 'new') ? 'learning' : 'new' });
      m[chId].kids.push(id);
      subs.forEach(([sid, st, sa, sb, ss]) => add({ id: sid, title: st, p0: sa, p1: sb, level: 3, parent: id, status: ss, summary: SUMMARY[sid], flag: sid === '3.5.4' }));
    });
  });
  // 第 1、2 章各节页码按章均分（示意）
  ['ch1', 'ch2'].forEach(c => { const ch = m[c], n = ch.kids.length, w = (ch.p1 - ch.p0 + 1) / n; ch.kids.forEach((k, i) => { m[k].p0 = Math.round(ch.p0 + i * w); m[k].p1 = Math.round(ch.p0 + (i + 1) * w) - 1; }); });
  return { m, order };
}

function reset() {
  const { m, order } = buildSections();
  S = {
    books: clone(BOOKS).map(b => Object.assign(b, b.id === 'slm' ? { chapters: SLM_CH } : b.id === 'ddia' ? { chapters: DDIA_CH } : {})),
    sec: m, secOrder: order,
    cards: clone(CARDS), stuck: clone(STUCK),
    qa: clone(QA), userNote: { '3.4.2': '一致代价搜索 ≈ Dijkstra，但在隐式图上、找到目标就停。' }, hl: clone(HIGHLIGHTS),
    study: null,
    readerMode: 'orig',
    mineru: { token: 'mnr_••••••••••••a3f9', expires: '2026-11-03', used: 412, model: 'vlm', confirm: true, self: '' },
    theme: 'system', fontSize: '中',
    ai: {
      services: [
        { id: 'a1', name: 'Claude 官方', proto: 'Anthropic Messages', base: 'https://api.anthropic.com', key: 'sk-ant-••••••••7Qa', models: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'] },
        { id: 'a2', name: 'OpenAI 兼容（中转）', proto: 'OpenAI Responses', base: 'https://api.example-relay.com/v1', key: 'sk-••••••••K2d', models: ['gpt-5-mini'] }
      ],
      teach: 'a1:claude-sonnet-5-5', tidy: 'a1:claude-haiku-5-5'
    },
    prefs: { intuition: true, len: '中', askEach: true, quizEnd: true, bilingual: true, recap: true, lang: '中文' },
    sim: { tokenExpired: false },
    daysAway: 3,
    exportFmt: 'md', exportStrip: true, pins: clone(PINS)
  };
  resetStudy();
}

// ---------- 听讲 / 读书状态 ----------
let UID = 0;
const uid = () => 'm' + (++UID);
function newStudy(sec) {
  const steps = STEPS[sec] || [];
  return { sec, steps, n: steps.length, ss: steps.map(() => 'todo'), cur: 0, mode: 'listen', msgs: [], detour: null, phase: 'teach', busy: false,
    histOpen: false, stuckCand: [], detourLog: [], quote: null, guide: false, asked: 0 };
}
function pushLesson(st, i, old) {
  st.msgs.push({ k: 'head', i, id: uid(), old });
  (LESSON[st.sec] || [])[i].forEach(it => st.msgs.push(Object.assign({ id: uid(), old }, it)));
}
function resetStudy(at, opts) {
  // 默认：3 天前讲完第 1 步，今天打开先看到续学卡片
  const st = S.study = newStudy('3.5.2');
  st.msgs.push({ k: 'hist', id: uid(), label: '3 天前 · 第 1 步 · 5 条消息' });
  pushLesson(st, 0, true);
  st.msgs.push({ k: 'user', id: uid(), t: HISTORY.user, old: true }, { k: 'ai', id: uid(), t: HISTORY.after, old: true });
  st.ss[0] = 'done'; st.cur = 1;
  if (at == null) { st.phase = 'resume'; st.msgs.push({ k: 'resume', id: uid() }); return; }
  for (let i = 1; i <= at; i++) { if (i > 1) st.ss[i - 1] = 'done'; pushLesson(st, i); st.cur = i; st.ss[i] = 'now'; }
  if (opts && opts.quiz) { st.ss[at] = 'done'; st.msgs.push({ k: 'quiz', id: uid(), qi: at, final: true }); st.phase = 'quiz'; }
  if (opts && opts.ready) { st.ss[at] = 'done'; st.phase = 'ready'; }
}

// ---------- 查询 ----------
const secOf = id => S.sec[id];
const secName = id => { const s = S.sec[id]; return s ? (s.level === 1 ? '第' + s.no + '章 ' + s.title : id + ' ' + s.title) : id; };
const pagesOf = id => { const s = S.sec[id]; return s && s.p0 ? 'p.' + s.p0 + '–' + s.p1 : ''; };
const chapterOf = id => { let s = S.sec[id]; while (s && s.level > 1) s = S.sec[s.parent]; return s; };
const stepBlocks = (sec, i) => ((STEPS[sec] || [])[i] || { blocks: [] }).blocks;
const blocksOfSec = sec => BLOCKS.filter(b => b.sec === sec);
const leafSecs = () => S.secOrder.map(id => S.sec[id]).filter(s => s.level === 3 || (s.level === 2 && !s.kids));
const doneCount = () => leafSecs().filter(s => s.status === 'done').length;
const bookOf = id => S.books.find(b => b.id === id);

// ---------- 复习调度（Leitner 5 盒，规格 §9） ----------
const BOX_DAYS = [0, 1, 3, 7, 15, 30];
const dueCards = () => S.cards.filter(c => c.due <= 0);
function nextBox(c, r) { return r === 'again' ? 1 : r === 'hard' ? c.box : Math.min(5, c.box + 1); }
function rateCard(c, r) {
  c.box = nextBox(c, r); c.due = BOX_DAYS[c.box];
  if (r === 'again' && !S.stuck.some(s => s.x === c.f && !s.ok)) S.stuck.unshift({ id: 's' + Date.now(), sec: c.sec, x: c.f, ok: false, fromCard: true });
}

// ---------- 上下文估算（规格 §5） ----------
function ctxLayers() {
  const st = S.study;
  const cur = stepBlocks(st.sec, st.cur).reduce((a, id) => a + (BLK[id].x.length || 0), 0);
  const conv = st.msgs.filter(m => !m.old && (m.k === 'ai' || m.k === 'user')).reduce((a, m) => a + m.t.length, 0);
  const L = [
    { k: '讲解规则', d: '讲解顺序、引用规则、讲解偏好', t: 920, c: true, col: 'var(--teal)' },
    { k: '书的地图', d: '全书 28 章目录 + 已学 ' + doneCount() + ' 个小节的摘要', t: 3380, c: true, col: 'var(--purple)' },
    { k: '当前原文', d: st.sec + ' 第 ' + (st.cur + 1) + '/' + st.n + ' 步 · ' + (st.steps[st.cur] ? st.steps[st.cur].p : ''), t: Math.round(cur * 1.4) + 1600, col: 'var(--tint)' },
    { k: '学习记录', d: '进度、相关卡点 ' + S.stuck.filter(s => !s.ok).length + ' 个、最近问题', t: 640, col: 'var(--orange)' }
  ];
  if (st.detour) L.push({ k: '岔路原文', d: secName(st.detour.sec) + ' · ' + pagesOf(st.detour.sec), t: 2860, col: 'var(--indigo)' });
  L.push({ k: '最近对话', d: '本步的对话；更早的只保留摘要', t: Math.round(conv * 1.3) + 380, col: 'var(--label3)' });
  return L;
}

// ---------- 解析模拟 ----------
let parseTimer = null;
function startParse(book) {
  book.status = 'parsing';
  if (!parseTimer) parseTimer = setInterval(tickParse, 650);
}
function tickParse() {
  let any = false;
  S.books.forEach(b => {
    if (b.status !== 'parsing') return;
    const p = b.parts.find(x => x.stage < STAGES.length);
    if (!p) { b.status = 'ready'; S.mineru.used += b.pages; showToast('《' + b.title + '》解析完成', 'ok'); return; }
    any = true;
    if (p.err) return;
    if (S.sim.tokenExpired && p.stage === 0) { p.err = 'Token 已过期（A0211），请在「我的 → 解析服务」更新'; return; }
    p.pct = (p.pct || 0) + (p.stage === 2 ? 9 : 34) * (p.speed || 1);
    if (p.pct >= 100) { p.stage++; p.pct = 0; if (p.stage === STAGES.length) b.readyTo = p.to; }
  });
  const c = cur();
  if (c && (c.name === 'parse' || c.name === 'shelf')) refresh();
  if (!any && !S.books.some(b => b.status === 'parsing')) { clearInterval(parseTimer); parseTimer = null; }
}
