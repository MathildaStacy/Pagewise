/* Pagewise Win11 风原型 · 原型控制台（Win11 窗口：深浅色 / 场景 / 页面 / 页面状态）、启动 */
'use strict';
const PAGES = [
  ['今天', [['today', '今天'], ['ask', '问书架'], ['stats', '学习记录'], ['welcome', '新手引导', { step: 0 }]]],
  ['书架', [['shelf', '书架'], ['importSet', '解析设置', { i: 1 }], ['parse', '解析进度', { book: 'slm' }], ['map', '书的地图', { book: 'aima' }]]],
  ['学习', [['study', '听讲'], ['read', '读书'], ['reader', '读书·其他小节', { sec: '3.4.2' }], ['done', '本节小结']]],
  ['复习 · 笔记', [['review', '复习'], ['rv', '复习闪卡'], ['notes', '笔记'], ['notesBook', '笔记·按节'], ['noteDetail', '笔记·3.4.2', { sec: '3.4.2' }]]],
  ['我的', [['me', '我的'], ['meMineru', '解析服务'], ['meAI', 'AI 服务'], ['meAIEdit', '编辑服务', { id: 'a1' }], ['mePrefs', '讲解偏好'], ['meAppearance', '外观'], ['meStorage', '存储与备份'], ['about', '关于'], ['kit', '组件库']]]
];
const ALL_PAGES = PAGES.flatMap(g => g[1]);
function openPage(name, p) {
  if (ROOTS.includes(name)) return tab(name);
  if (name === 'study' || name === 'read') { S.study.mode = name === 'read' ? 'read' : 'listen'; R.stack = [{ name: 'today', p: {} }, { name: 'map', p: { book: 'aima' } }]; return go('study'); }
  const root = name.startsWith('me') || name === 'about' || name === 'kit' ? 'me' : name === 'rv' ? 'review' : name.startsWith('note') ? 'notes' : ['ask', 'stats', 'welcome'].includes(name) ? 'today' : 'shelf';
  R.stack = [{ name: root, p: {} }];
  if (name === 'done') R.stack.push({ name: 'map', p: { book: 'aima' } }, { name: 'study', p: {} });
  if (name === 'kit') R.stack.push({ name: 'about', p: {} });
  go(name, p ? clone(p) : {});
}
const SCEN = [
  ['续学', '隔 3 天打开，先回顾卡点', () => { resetStudy(); S.daysAway = 3; openPage('study'); }],
  ['岔路', '讲 A* 时问一致代价搜索', () => { resetStudy(1); openPage('study'); setTimeout(() => { $('#cin').value = '这跟前面的一致代价搜索有什么关系？'; sendText(); }, 300); }],
  ['点引用', '原文预览浮层', () => { resetStudy(1); openPage('study'); setTimeout(() => peek('b1025'), 350); }],
  ['路线图', '点第 4 步，从这里开始讲', () => { resetStudy(1); openPage('study'); setTimeout(() => openRoadmap(), 350); }],
  ['小测', '讲完最后一步，做本节小测', () => { resetStudy(3, { quiz: true }); openPage('study'); }],
  ['读书模式', '讲过的段落、便签、导读', () => { resetStudy(2); S.readerMode = 'flow'; openPage('read'); }],
  ['段落菜单', '点一段：解释、从这里讲', () => { resetStudy(2); S.readerMode = 'flow'; openPage('read'); setTimeout(() => { flashBlock('b1026'); setTimeout(() => { const el = $('#b1026'); if (el) el.click(); }, 120); }, 400); }],
  ['学完一节', '摘要、卡点、闪卡草稿', () => { resetStudy(3, { ready: true }); openPage('done'); }],
  ['问书架', '跨书问「A* 和 Dijkstra」', () => { S.ask = { q: '', state: 'idle' }; openPage('ask'); setTimeout(() => runAsk('A* 和 Dijkstra 是什么关系？'), 300); }],
  ['首次启动', '欢迎 → AI → MinerU → 偏好', () => { S.flags.firstRun = true; openPage('welcome', { step: 0 }); }],
  ['导入新书', '扫描版 744 页，分 4 片', () => { tab('shelf'); openImport(); }],
  ['解析失败', 'Token 过期，解析暂停', () => { S.sim.tokenExpired = true; tab('shelf'); go('importSet', { i: 0 }); showToast('已模拟 Token 过期，点「开始解析」看看'); }],
  ['复习闪卡', '点卡片 3D 翻面', () => openPage('rv')],
  ['AI 出错', '回答到一半断开，重试', () => { S.flags.aiError = true; resetStudy(1); openPage('study'); setTimeout(() => actAlt('ex'), 350); }],
  ['导出笔记', 'Markdown / Anki', () => { openPage('notesBook'); setTimeout(openExport, 100); }],
  ['组件库', '所有组件和状态', () => openPage('kit')]
];
// 页面状态（03 §12）：打开后去对应页面看
const FLAGS = [
  ['emptyShelf', '空书架', '今天 / 书架的空状态', 'today'],
  ['noAI', '未配置 AI 服务', '听讲说明卡、我的 → AI 服务', 'study'],
  ['noToken', '未配置 MinerU Token', '解析设置底部按钮、解析服务', 'importSet'],
  ['tokenExpired', 'MinerU Token 过期', '开始解析后暂停', 'importSet'],
  ['offline', '断网', '发送时提示，消息留在输入框', 'study'],
  ['aiError', 'AI 出错', '下一次回答中途断开', 'study'],
  ['doneLoading', '小结生成中', '骨架屏', 'done'],
  ['doneError', '小结生成失败', '可重试，也可以手写', 'done']
];
const flagVal = k => k === 'tokenExpired' ? S.sim.tokenExpired : S.flags[k];
function setFlag(k, v) {
  if (k === 'tokenExpired') S.sim.tokenExpired = v; else S.flags[k] = v;
  if (k === 'doneLoading' && v) S.flags.doneError = false;
  if (k === 'doneError' && v) S.flags.doneLoading = false;
  const f = FLAGS.find(x => x[0] === k), pg = ALL_PAGES.find(x => x[0] === f[3]);
  if (v) openPage(pg[0], pg[2] || (f[3] === 'importSet' ? { i: 0 } : null)); else refresh();
}
function renderConsole() {
  const c = cur(), pg = c.name === 'study' && S.study.mode === 'read' ? 'read' : c.name;
  $('#console').innerHTML = '<h1>Windows 11 · 2026</h1><div class="lead">Pagewise 的完整可交互原型，依据 <a href="explore/windows11-2026.html">explore/windows11-2026.html</a>：壁纸透过 Mica 染色、Copilot 彩虹、药丸按钮、16–20px 圆角卡片、Fluent 3D 彩色图标、悬浮亚克力 Tab 栏。比其他皮肤多了「今天」Tab、问书架、学习记录、新手引导、组件库和各种空 / 错误状态。</div>' +
    '<div class="tg">' + [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, l]) => '<button class="' + (S.theme === k ? 'on' : '') + '" onclick="setTheme(\'' + k + '\');refresh()">' + l + '</button>').join('') + '</div>' +
    '<h2>场景</h2><div class="jump">' + SCEN.map(([t, d], i) => '<button onclick="SCEN[' + i + '][2]()">' + t + '<small>' + d + '</small></button>').join('') + '</div>' +
    '<h2>页面 · ' + ALL_PAGES.length + '</h2><div class="pgs">' + PAGES.map(([g, list]) => '<div class="gl">' + g + '</div>' + list.map(([k, l, p]) => '<button class="' + (pg === k ? 'on' : '') + '" onclick="openPage(\'' + k + '\',' + (p ? esc(JSON.stringify(p)) : 'null') + ')">' + l + '</button>').join('')).join('') + '</div>' +
    '<h2>页面状态</h2><div class="flags">' + FLAGS.map(([k, l, d]) => '<label><span class="grow">' + l + '<small>' + d + '</small></span><span class="sw' + (flagVal(k) ? ' on' : '') + '" role="switch" aria-checked="' + !!flagVal(k) + '" onclick="setFlag(\'' + k + '\',' + !flagVal(k) + ')"></span></label>').join('') + '</div>' +
    '<h2>试试这些</h2><p>· 今天页点彩虹框「问问你书架上的书」，问「A* 和 Dijkstra 是什么关系？」。</p><p>· 听讲里输入「这跟前面的一致代价搜索有什么关系？」进入岔路，再点「回到主线」看折叠。</p><p>· 点步骤卡片打开本节路线图；点讲解里的 <b>p.103</b> 弹出原书预览，浮层按住顶部下滑关闭。</p><p>· 读书里点段落弹出亚克力命令栏；问答便签是黄色胶囊。</p><p>· 我的 → 关于 → 组件库：所有组件、Token 和图标。</p>' +
    '<h2>说明</h2><p>书名和章节目录来自《人工智能：现代方法（第4版）》；页码、原文、讲解和闪卡都是示意内容。AI 回答是预先写好的脚本。实现说明见 prototype-win11/README.md。</p>' +
    '<button class="rst" onclick="reset();setTheme(S.theme);setFont(S.fontSize);tab(\'today\')">重置原型</button>';
}

// ---------- 启动 ----------
reset();
startParse(bookOf('slm'));
setTheme('system');
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'system') setTheme('system'); });
$('#view').addEventListener('scroll', onScroll, { passive: true });
(function boot() {
  const want = decodeURIComponent(location.hash.slice(1));
  const pg = ALL_PAGES.find(x => x[1] === want || x[0] === want);
  if (pg) openPage(pg[0], pg[2]); else render(true);
})();
