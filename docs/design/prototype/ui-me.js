/* Pagewise 原型 · 我的（解析服务、AI 服务、讲解偏好、存储）、原型控制台、启动 */
'use strict';
const sw = (v, fn) => '<span class="sw' + (v ? ' on' : '') + '" role="switch" aria-checked="' + !!v + '" onclick="' + on(fn) + '"></span>';
const daysLeft = d => Math.round((new Date(d + 'T00:00:00') - new Date('2026-10-28T00:00:00')) / 864e5);
const modelLabel = v => { const [sid, m] = v.split(':'); const s = S.ai.services.find(x => x.id === sid); return (s ? s.name : '') + ' · ' + m; };

SCREENS.me = {
  title: '我的', root: true,
  render() {
    const left = S.sim.tokenExpired ? -1 : daysLeft(S.mineru.expires);
    const row = (t, d, fn, warn) => '<div class="row tap" onclick="' + on(fn) + '"><div class="grow"><b>' + t + '</b><small' + (warn ? ' style="color:var(--stuck)"' : '') + '>' + d + '</small></div><span class="chev"></span></div>';
    return '<div class="sec">' +
      row('解析服务', 'MinerU 官方 API · ' + (left < 0 ? 'Token 已过期' : '今日 ' + S.mineru.used + '/2000 页' + (left <= 7 ? ' · Token ' + left + ' 天后过期' : '')), () => go('meMineru'), left <= 7) +
      row('AI 服务', S.ai.services.length + ' 个服务 · 讲解用 ' + S.ai.teach.split(':')[1], () => go('meAI')) +
      row('讲解偏好', (S.prefs.intuition ? '先直觉后公式' : '先定义后直觉') + ' · 每段' + S.prefs.len + ' · ' + (S.prefs.bilingual ? '术语中英对照' : '只用中文术语'), () => go('mePrefs')) +
      '</div><div class="sec">' +
      row('存储与备份', S.books.length + ' 本书 · 本机 612 MB', () => go('meStorage')) +
      row('关于 Pagewise', '版本 0.1 原型 · GPL-3.0', () => go('about')) + '</div>';
  }
};

SCREENS.meMineru = {
  title: '解析服务',
  render() {
    const m = S.mineru, left = S.sim.tokenExpired ? -1 : daysLeft(m.expires);
    return '<div class="sec"><div class="sec-h">MinerU 官方精准解析 API</div>' +
      '<div class="fld"><label>Token（保存在 Android Keystore）</label><input value="' + esc(m.token) + '" readonly></div>' +
      '<div class="row"><div class="grow">有效期<small' + (left <= 7 ? ' style="color:' + (left < 0 ? 'var(--bad)' : 'var(--stuck)') + '"' : '') + '>' + (left < 0 ? '已过期，解析会暂停' : m.expires + ' · 还有 ' + left + ' 天') + '</small></div><button class="btn sm pri" onclick="' + on(() => { S.sim.tokenExpired = false; m.token = 'mnr_••••••••••••c71e'; m.expires = '2027-01-26'; S.books.forEach(b => (b.parts || []).forEach(x => { if (x.err) { x.err = null; startParse(b); } })); refresh(); showToast('Token 已更新，暂停的解析会继续', 'ok'); }) + '">更新 Token</button></div>' +
      '<div class="row"><div class="grow">今日额度<small>每天 2000 页高优先级，超出后排队变慢，不会被拦截</small><div class="bar" style="margin-top:6px"><i style="width:' + Math.min(100, m.used / 20) + '%"></i></div></div><span class="n ink2">' + m.used + '/2000</span></div>' +
      '<div class="row"><div class="grow">默认解析模型<small>' + (m.model === 'vlm' ? '公式和复杂排版更好' : '速度更快') + '</small></div><div class="seg" style="width:150px">' + ['vlm', 'pipeline'].map(k => '<button class="' + (m.model === k ? 'on' : '') + '" onclick="' + on(() => { m.model = k; refresh(); }) + '">' + k + '</button>').join('') + '</div></div>' +
      '<div class="row"><div class="grow">上传前确认<small>每次上传书之前弹窗确认</small></div>' + sw(m.confirm, () => { m.confirm = !m.confirm; refresh(); }) + '</div>' +
      '<div class="row tap" onclick="' + on(() => showToast('连接正常 · 延迟 182 ms', 'ok')) + '"><div class="grow" style="color:var(--acc)">测试连接</div></div></div>' +
      '<div class="sec"><div class="sec-h">自建 MinerU 服务 <small>V1.1</small></div><div class="fld"><label>服务地址（例如局域网里 Mac 上的 mineru-api）</label><input placeholder="http://192.168.1.20:8000" disabled></div><div style="padding:8px 14px 12px"><div class="note">用自建服务时，书不离开你的网络，也不占官方额度。</div></div></div>';
  }
};

SCREENS.meAI = {
  title: 'AI 服务',
  render() {
    const opts = S.ai.services.flatMap(s => s.models.map(m => [s.id + ':' + m, s.name + ' · ' + m]));
    const sel = (k, d) => '<div class="fld"><label>' + d + '</label><select onchange="' + on(e => { S.ai[k] = e.target.value; refresh(); }) + '">' + opts.map(([v, l]) => '<option value="' + v + '"' + (S.ai[k] === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></div>';
    return '<div class="sec"><div class="sec-h">服务 <small>Key 保存在 Android Keystore</small></div>' +
      S.ai.services.map(s => '<div class="row tap" onclick="' + on(() => go('meAIEdit', { id: s.id })) + '"><div class="grow"><b>' + esc(s.name) + '</b><small>' + esc(s.proto) + ' · ' + esc(s.base.replace(/^https:[/][/]/, '')) + '</small></div><span class="chev"></span></div>').join('') +
      '<div class="row tap" onclick="' + on(() => go('meAIEdit', {})) + '"><div class="grow" style="color:var(--acc)">＋ 添加服务</div></div></div>' +
      '<div class="sec"><div class="sec-h">模型分配</div>' + sel('teach', '讲解模型（伴读、岔路、解释）') + sel('tidy', '整理模型（摘要、闪卡草稿、续学回顾、翻译）') + '<div style="padding:8px 14px 12px"><div class="note">讲解用强一点的模型，整理用便宜的模型。讲解规则和书的地图走 prompt caching。</div></div></div>' +
      '<div class="sec"><div class="sec-h">用量 <small>本机统计</small></div><div class="kv"><span>人工智能：现代方法</span><span class="n">1.24M tokens · 缓存命中 71%</span><span>本月合计</span><span class="n">1.31M tokens</span></div></div>';
  }
};
SCREENS.meAIEdit = {
  title: p => p.id ? '编辑服务' : '添加服务',
  render(p) {
    const s = S.ai.services.find(x => x.id === p.id) || { name: '', proto: 'Anthropic Messages', base: '', key: '', models: [] };
    return '<div class="sec"><div class="fld"><label>名称</label><input value="' + esc(s.name) + '" placeholder="例如：Claude 官方"></div>' +
      '<div class="fld"><label>协议</label><select>' + ['Anthropic Messages', 'OpenAI Responses'].map(x => '<option' + (x === s.proto ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
      '<div class="fld"><label>Base URL</label><input value="' + esc(s.base) + '" placeholder="https://api.anthropic.com"></div>' +
      '<div class="fld"><label>API Key</label><input value="' + esc(s.key) + '" placeholder="sk-…" type="text"></div>' +
      '<div class="fld"><label>模型（逗号分隔）</label><input value="' + esc(s.models.join(', ')) + '"></div></div>' +
      '<div style="padding:6px 14px;display:flex;gap:8px"><button class="btn ghost" style="flex:1" onclick="' + on(() => showToast('连接正常 · 模型列表已读取', 'ok')) + '">测试连接</button><button class="btn pri" style="flex:1" onclick="' + on(() => { showToast('已保存（原型不改数据）'); back(); }) + '">保存</button></div>';
  }
};

SCREENS.mePrefs = {
  title: '讲解偏好',
  render() {
    const P = S.prefs, t = (k, l, d) => '<div class="row"><div class="grow">' + l + '<small>' + d + '</small></div>' + sw(P[k], () => { P[k] = !P[k]; refresh(); }) + '</div>';
    return '<div class="sec">' + t('intuition', '先讲直觉，再讲公式', '关掉后先给定义和公式') +
      '<div class="row"><div class="grow">每段讲解长度<small>短：半屏 · 中：一屏半以内 · 长：完整展开</small></div><div class="seg" style="width:130px">' + ['短', '中', '长'].map(k => '<button class="' + (P.len === k ? 'on' : '') + '" onclick="' + on(() => { P.len = k; refresh(); }) + '">' + k + '</button>').join('') + '</div></div>' +
      t('askEach', '每段结尾提一个问题', '确认你懂了再往下讲') + t('quizEnd', '一节讲完做小测', '答错会换个角度再讲一次') +
      t('bilingual', '术语中英对照', '例如：可容许的（admissible）') + t('recap', '续学回顾', '隔天打开时先用三句话回顾上次的进度和卡点') + '</div>' +
      '<div class="sec"><div class="fld"><label>补充要求（会写进讲解规则）</label><textarea placeholder="例如：多用编程里的类比；伪代码用 Python">多用编程里的类比，我是后端工程师。</textarea></div></div>';
  }
};
SCREENS.meStorage = {
  title: '存储与备份',
  render() {
    const sz = { aima: '418 MB', slm: '126 MB', ddia: '12 MB' };
    return '<div class="sec"><div class="sec-h">每本书</div>' + S.books.map(b => '<div class="row"><div class="grow">' + esc(b.title) + '<small>原文件 ' + b.size + ' · 解析结果 ' + (sz[b.id] || '—') + '</small></div><button class="btn sm ghost" onclick="' + on(() => modal({ title: '清理解析缓存？', body: '会删除《' + esc(b.title) + '》的解析结果（Markdown、内容块、图片），<b>保留学习记录、笔记和闪卡</b>。以后再打开需要重新解析。', ok: '清理', onOk: () => showToast('原型里不真的删除') })) + '">清理</button></div>').join('') + '</div>' +
      '<div class="sec"><div class="row tap" onclick="' + on(() => showToast('已导出 pagewise-backup-2026-10-28.zip 到「下载」（不含 Key）', 'ok')) + '"><div class="grow">导出备份<small>整库：书的地图、学习记录、笔记、闪卡、设置；不含 API Key 和 Token</small></div><span class="chev"></span></div>' +
      '<div class="row tap" onclick="' + on(() => showToast('选择备份文件（原型未实现）')) + '"><div class="grow">从备份恢复</div><span class="chev"></span></div></div>';
  }
};
SCREENS.about = {
  title: '关于',
  render: () => '<div class="sec" style="padding:24px 16px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--acc)">Pagewise</div><div class="muted" style="font-size:12px;margin:4px 0 14px">带着整本书的 AI 伴读 · 0.1 原型</div><div class="note" style="text-align:left">本地优先，没有后端：书和学习记录只存在手机上。书只在两种情况下离开手机：上传给 MinerU 解析（你确认后），以及当前讲解需要的小节原文发给你配置的 AI 服务。</div></div>'
};

// ---------- 原型控制台 ----------
const PAGES = [['shelf', '书架'], ['map', '书的地图', { book: 'aima' }], ['study', '伴读'], ['reader', '原文', { block: 'b1025' }], ['done', '本节小结'], ['importSet', '解析设置', { i: 1 }], ['review', '复习'], ['rv', '复习闪卡'], ['notes', '笔记'], ['notesBook', '笔记·按节'], ['noteDetail', '笔记·3.4.2', { sec: '3.4.2' }], ['me', '我的'], ['meMineru', '解析服务'], ['meAI', 'AI 服务'], ['mePrefs', '讲解偏好']];
function openPage(name, p) { const roots = ['shelf', 'review', 'notes', 'me']; if (roots.includes(name)) return tab(name); R.stack = [{ name: name.startsWith('me') ? 'me' : name === 'rv' ? 'review' : name.startsWith('note') ? 'notes' : 'shelf', p: {} }]; go(name, p ? clone(p) : {}); }
const SCEN = [
  ['续学', '隔 3 天打开，先回顾卡点', () => { resetStudy(); S.daysAway = 3; openPage('study'); }],
  ['岔路', '讲 A* 时问一致代价搜索', () => { resetStudy(1); openPage('study'); setTimeout(() => { $('#cin').value = '这跟前面的一致代价搜索有什么关系？'; sendText(); }, 200); }],
  ['小测', '讲到最后一段，做本节小测', () => { resetStudy(3); openPage('study'); }],
  ['学完一节', '摘要、卡点、闪卡草稿', () => { resetStudy(3); S.study.quizRight = true; S.study.phase = 'ready'; openPage('done'); }],
  ['点引用看原文', 'p.103 段落高亮', () => openPage('reader', { block: 'b1025' })],
  ['划词解释', '在原文里点一段', () => { openPage('reader', { block: 'b1026' }); setTimeout(() => explainBlock('b1026'), 300); }],
  ['导入新书', '扫描版 744 页，分 2 片', () => { tab('shelf'); openImport(); }],
  ['解析失败', 'Token 过期，解析暂停', () => { S.sim.tokenExpired = true; tab('shelf'); go('importSet', { i: 0 }); showToast('已模拟 Token 过期，点「开始解析」看看'); }],
  ['复习闪卡', '今天到期的卡片', () => openPage('rv')],
  ['导出笔记', 'Markdown / Anki', () => { openPage('notesBook'); setTimeout(openExport, 100); }]
];
function renderConsole() {
  const c = cur();
  $('#console').innerHTML = '<h2>Pagewise 原型控制台</h2><div class="lead">左边是手机界面，可以直接点。这里可以跳到某个场景或页面。</div>' +
    '<h3>场景</h3><div class="jump">' + SCEN.map(([t, d, f], i) => '<button onclick="SCEN[' + i + '][2]()">' + t + '<small>' + d + '</small></button>').join('') + '</div>' +
    '<h3>页面</h3><div class="pages">' + PAGES.map(([k, l, p], i) => '<button class="' + (c.name === k ? 'on' : '') + '" onclick="openPage(PAGES[' + i + '][0], PAGES[' + i + '][2])">' + l + '</button>').join('') + '</div>' +
    '<h3>试试这些</h3><p>· 伴读里输入「这跟前面的一致代价搜索有什么关系？」或「和贪心搜索有啥区别」，会走岔路。</p><p>· 点回答里的 <span class="cite">p.103</span> 跳到原文；原文里点任意段落可解释、问 AI、高亮。</p><p>· 顶部「AI 看到的内容」显示本轮上下文和 token。</p>' +
    '<h3>说明</h3><p>书名和章节目录来自《人工智能：现代方法（第4版）》；页码、「原文」、讲解和闪卡都是为原型写的示意内容，不是原书文字。AI 回答是预先写好的脚本，耗时是模拟的。</p>' +
    '<button class="rst" onclick="reset();tab(&quot;shelf&quot;)">重置原型</button>';
}

// ---------- 启动 ----------
reset();
startParse(bookOf('slm'));
(function boot() {
  const want = decodeURIComponent(location.hash.slice(1));
  const pg = PAGES.find(x => x[1] === want || x[0] === want);
  if (pg) openPage(pg[0], pg[2]); else render(true);
})();
