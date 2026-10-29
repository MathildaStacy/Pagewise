/* Pagewise Win11 风原型 · 本节小结（独立页面；视觉参考 app.js finish()：圆形勾选框的圆角卡片） */
'use strict';
const DRAFT = {
  summary: 'A* 用 f(n) = g(n) + h(n) 选择扩展结点；h 可容许（从不高估）时 A* 代价最优。一致性是更强的条件（三角不等式），一致时状态第一次被扩展就是最优路径。在同样的信息下，A* 是最优高效的。',
  cards: [
    { f: 'A* 的评价函数是什么？各项含义？', b: 'f(n) = g(n) + h(n)：g 是从起点到 n 的已走代价，h 是从 n 到目标的估计代价。' },
    { f: '什么是可容许的启发式函数？', b: '从不高估到达目标的真实代价（乐观）。h 可容许时，A* 代价最优。' },
    { f: '一致性的定义？和可容许的关系？', b: 'h(n) ≤ c(n, a, n′) + h(n′)。一致 ⇒ 可容许，反之不一定。' },
    { f: 'h(n) ≡ 0 时 A* 变成什么？', b: '一致代价搜索（Dijkstra 算法）。', detour: true },
    { f: '最优高效（optimally efficient）指什么？', b: '在同一启发式、保证最优的算法中，A* 扩展的结点数几乎最少。' }
  ]
};
const ckRow = (on_, title, sub, fn, extra, cls) => '<button class="row tap ck' + (cls ? ' ' + cls : '') + (on_ ? ' on' : '') + '" role="checkbox" aria-checked="' + on_ + '" onclick="' + on(fn) + '"><span class="cb">' + I('check') + '</span><span class="grow"><b>' + esc(title) + '</b>' + (extra || '') + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>';
SCREENS.done = {
  title: '本节小结', short: '小结',
  render(p) {
    const st = ST();
    // 控制台「页面状态」：草稿生成中（骨架屏）/ 生成失败（可重试，也可以手写后保存）
    if (S.flags.doneLoading) return '<div class="dhero">' + T3('ai', 'lg') + '<div class="t">正在整理摘要和闪卡…</div><div class="s">整理模型 · ' + S.ai.tidy.split(':')[1] + '</div><div class="bar ind ai" style="width:160px;margin:14px auto 0"><i></i></div></div>' +
      ['摘要', '卡点', '闪卡草稿'].map((t, i) => '<section class="grp"><div class="grp-h">' + t + '</div><div class="card skelcard"><div class="skel" style="height:14px;width:90%"></div><div class="skel" style="height:14px;width:' + (70 - i * 10) + '%"></div>' + (i ? '<div class="skel" style="height:14px;width:50%"></div>' : '') + '</div></section>').join('');
    if (!p.d) {
      const dt = st.detourLog.length > 0;
      p.d = { summary: DRAFT.summary, cards: DRAFT.cards.filter(c => !c.detour || dt).map(c => Object.assign({ on: true }, c)),
        stuck: st.stuckCand.filter(x => !S.stuck.some(y => y.x === x && !y.ok)).map(x => ({ x, on: true })) };
      if (!p.d.stuck.length) p.d.stuck.push({ x: '可容许和一致性的区别', on: false });
    }
    const d = p.d, done = st.ss.filter(x => x === 'done').length, sk = st.ss.filter(x => x === 'skipped').length;
    let h = (S.flags.doneError ? '<div class="pad" style="margin-bottom:14px">' + noteHtml('bad', '<b>草稿生成失败</b>：整理模型返回 401（Key 无效）。可以重试，也可以自己写好摘要后保存。<div class="btns" style="margin-top:8px"><button class="btn sm pri" onclick="' + on(() => { S.flags.doneError = false; S.flags.doneLoading = true; refresh(); setTimeout(() => { S.flags.doneLoading = false; refresh(); }, 1400); }) + '">' + I('retry') + '重试</button><button class="btn sm" onclick="go(\'meAI\')">检查 AI 服务</button></div>', 'warn') + '</div>' : '') +
      '<div class="dhero">' + T3('check', 'lg') + '<div class="k">' + esc(secName(chapterOf(st.sec).id)) + '</div><div class="t">' + esc(secName(st.sec)) + ' · 讲完了</div><div class="s">' + st.n + ' 步' + (sk ? ' · 跳过 ' + sk + ' 步' : '') + ' · ' + st.msgs.filter(m => m.k === 'user' && !m.old).length + ' 次提问 · 岔路 ' + st.detourLog.length + ' 次</div></div>';
    h += '<section class="grp"><div class="grp-h">摘要 <span class="tag ai">' + I('spark') + 'AI 起草，可以改</span></div><textarea class="edt" aria-label="摘要" oninput="' + on(e => { d.summary = e.target.value; }) + '">' + esc(S.flags.doneError ? '' : d.summary) + '</textarea></section>';
    h += '<section class="grp"><div class="grp-h">卡点 <span>没完全掌握的地方</span></div><div class="card list">' + d.stuck.map(s => ckRow(s.on, s.x, '', () => { s.on = !s.on; refresh(); }, '', 'stk')).join('') + '</div></section>';
    h += '<section class="grp"><div class="grp-h">闪卡草稿 <span>' + d.cards.filter(c => c.on).length + '/' + d.cards.length + ' 张会加入复习 · 长按改写</span></div><div class="card list">' + d.cards.map(c => ckRow(c.on, c.f, c.b, () => { c.on = !c.on; refresh(); }, c.detour ? ' <span class="tag dt">来自岔路</span>' : '')).join('') + '</div>' +
      '<button class="btn text" style="margin-top:6px" onclick="' + on(() => editCard(d)) + '">' + I('add') + '自己加一张</button></section>';
    if (st.detourLog.length) h += grp('岔路记录', st.detourLog.map(x => row({ t: esc(x.q), d: '已记入 ' + esc(secName(x.sec)) + ' 的笔记' })).join(''));
    const nx = '3.5.3';
    h += '<div class="pad"><button class="btn pri block" onclick="' + on(() => saveSection(d, nx)) + '">保存，开始 ' + nx + ' ' + esc(S.sec[nx].title) + '</button><div class="muted" style="font-size:12px;text-align:center;margin-top:10px">保存后主线进度移到 ' + nx + '</div></div>';
    return h;
  }
};
function saveSection(d, nx) {
  const st = ST(), s = S.sec[st.sec];
  s.status = 'done'; s.summary = d.summary;
  const cards = d.cards.filter(c => c.on), stuck = d.stuck.filter(x => x.on);
  cards.forEach((c, i) => S.cards.push({ id: 'n' + Date.now() + i, sec: st.sec, f: c.f, b: c.b, box: 1, due: 1 }));
  stuck.forEach((x, i) => { if (!S.stuck.some(y => y.x === x.x && !y.ok)) S.stuck.unshift({ id: 'sn' + Date.now() + i, sec: st.sec, x: x.x, ok: false }); });
  S.sec[nx].status = 'learning';
  const old = st.sec;
  S.study = newStudy(nx);
  S.study.msgs.push({ k: 'sys', id: uid(), t: old + ' 已学完 · 新增 ' + cards.length + ' 张闪卡' + (stuck.length ? '、' + stuck.length + ' 个卡点' : '') });
  S.daysAway = 0;
  showToast('已保存 ' + cards.length + ' 张闪卡，进度移到 ' + nx, 'ok');
  // 回到下面那个听讲页（不叠两层）；after() 发现新小节还没开讲，会先生成路线图再讲第 1 步
  if (R.stack.length > 1 && R.stack[R.stack.length - 2].name === 'study') { closeOverlay(true); R.stack.pop(); render(true); } else replace('study');
}

// 编辑 / 新增闪卡（03 §7 editCard：长按卡片打开编辑对话框；原型用「自己加一张」演示同一个对话框）
function editCard(d) {
  modal({ title: '新的闪卡', body: '<div class="fld" style="padding:4px 0 0"><label>正面（问题）</label><input id="cf" placeholder="例如：A* 什么时候退化成一致代价搜索？"></div><div class="fld" style="padding:10px 0 0"><label>背面（答案）</label><textarea id="cb" placeholder="h(n) ≡ 0 时"></textarea></div>', ok: '添加', onOk: () => {
    const f = ($('#cf').value || '').trim(), b = ($('#cb').value || '').trim();
    if (!f) { $('#cf').closest('.fld').classList.add('bad'); return false; }
    d.cards.push({ f, b: b || '（没写答案）', on: true }); setTimeout(refresh, 250);
  } });
  setTimeout(() => $('#cf') && $('#cf').focus(), 300);
}
