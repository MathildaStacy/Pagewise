/* Pagewise 苹果风原型 · 原型控制台（右侧）、启动 */
'use strict';
const PAGES = [['shelf', '书架'], ['map', '书的地图', { book: 'aima' }], ['study', '听讲'], ['read', '读书'], ['reader', '读书·其他小节', { sec: '3.4.2' }], ['done', '本节小结'],
  ['importSet', '解析设置', { i: 1 }], ['parse', '解析进度', { book: 'slm' }], ['review', '复习'], ['rv', '复习闪卡'], ['notes', '笔记'], ['notesBook', '笔记·按节'], ['noteDetail', '笔记·3.4.2', { sec: '3.4.2' }],
  ['me', '我的'], ['meMineru', '解析服务'], ['meAI', 'AI 服务'], ['mePrefs', '讲解偏好'], ['meAppearance', '外观'], ['meStorage', '存储与备份']];
function openPage(name, p) {
  const roots = ['shelf', 'review', 'notes', 'me'];
  if (roots.includes(name)) return tab(name);
  if (name === 'study' || name === 'read') { S.study.mode = name === 'read' ? 'read' : 'listen'; R.stack = [{ name: 'shelf', p: {} }, { name: 'map', p: { book: 'aima' } }]; return go('study'); }
  R.stack = [{ name: name.startsWith('me') ? 'me' : name === 'rv' ? 'review' : name.startsWith('note') ? 'notes' : 'shelf', p: {} }];
  if (name === 'done') R.stack.push({ name: 'map', p: { book: 'aima' } }, { name: 'study', p: {} });
  go(name, p ? clone(p) : {});
}
const SCEN = [
  ['续学', '隔 3 天打开，先回顾卡点', () => { resetStudy(); S.daysAway = 3; openPage('study'); }],
  ['岔路', '讲 A* 时问一致代价搜索', () => { resetStudy(1); openPage('study'); setTimeout(() => { $('#cin').value = '这跟前面的一致代价搜索有什么关系？'; sendText(); }, 300); }],
  ['点引用', '原文预览浮层', () => { resetStudy(1); openPage('study'); setTimeout(() => peek('b1025'), 350); }],
  ['路线图', '点第 4 步，从这里开始讲', () => { resetStudy(1); openPage('study'); setTimeout(() => tapStep(3), 350); }],
  ['小测', '讲完最后一步，做本节小测', () => { resetStudy(3, { quiz: true }); openPage('study'); }],
  ['读书模式', '讲过的段落、便签、导读', () => { resetStudy(2); S.readerMode = 'flow'; openPage('read'); }],
  ['段落菜单', '点一段：解释、从这里开始讲', () => { resetStudy(2); S.readerMode = 'flow'; openPage('read'); setTimeout(() => { flashBlock('b1026'); setTimeout(() => { const el = $('#b1026'); if (el) el.click(); }, 120); }, 400); }],
  ['学完一节', '摘要、卡点、闪卡草稿', () => { resetStudy(3, { ready: true }); openPage('done'); }],
  ['导入新书', '扫描版 744 页，分 4 片', () => { tab('shelf'); openImport(); }],
  ['解析失败', 'Token 过期，解析暂停', () => { S.sim.tokenExpired = true; tab('shelf'); go('importSet', { i: 0 }); showToast('已模拟 Token 过期，点「开始解析」看看'); }],
  ['复习闪卡', '点卡片 3D 翻面', () => openPage('rv')],
  ['导出笔记', 'Markdown / Anki', () => { openPage('notesBook'); setTimeout(openExport, 100); }]
];
function renderConsole() {
  const c = cur(), pg = c.name === 'study' && S.study.mode === 'read' ? 'read' : c.name;
  $('#console').innerHTML = '<h1>苹果风</h1><div class="lead">Pagewise 第二皮肤 glass 的完整原型：页面、导航、文案和操作位置与 <a href="prototype.html">纸感原型</a> 一致，组件按 iOS（Liquid Glass）习惯重做。听讲 / 读书用 explore 里的新交互。</div>' +
    '<div class="tg">' + [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, l]) => '<button class="' + (S.theme === k ? 'on' : '') + '" onclick="setTheme(\'' + k + '\');refresh()">' + l + '</button>').join('') + '</div>' +
    '<h2>场景</h2><div class="jump">' + SCEN.map(([t, d], i) => '<button onclick="SCEN[' + i + '][2]()">' + t + '<small>' + d + '</small></button>').join('') + '</div>' +
    '<h2>页面</h2><div class="pgs">' + PAGES.map(([k, l], i) => '<button class="' + (pg === k ? 'on' : '') + '" onclick="openPage(PAGES[' + i + '][0], PAGES[' + i + '][2])">' + l + '</button>').join('') + '</div>' +
    '<h2>试试这些</h2><p>· 听讲里输入「这跟前面的一致代价搜索有什么关系？」进入岔路，再点「回到主线」看折叠。</p><p>· 点讲解里的 <b>p.103</b> 弹出原书预览；浮层可以按住顶部下滑关闭。</p><p>· 顶栏右侧「读书 | 听讲」切换，位置不丢；读书里点段落 →「从这里开始讲」。</p><p>· 书架、复习、笔记、我的往下滚，大标题收进顶栏。</p>' +
    '<h2>说明</h2><p>书名和章节目录来自《人工智能：现代方法（第4版）》；页码、原文、讲解和闪卡都是示意内容。AI 回答是预先写好的脚本。依据：docs/dev/02-skins.md §2、§5、§7。</p>' +
    '<button class="rst" onclick="reset();setTheme(S.theme);setFont(S.fontSize);tab(\'shelf\')">重置原型</button>';
}

// ---------- 启动 ----------
reset();
startParse(bookOf('slm'));
setTheme('system');
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'system') setTheme('system'); });
$('#view').addEventListener('scroll', onScroll, { passive: true });
(function boot() {
  const want = decodeURIComponent(location.hash.slice(1));
  const pg = PAGES.find(x => x[1] === want || x[0] === want);
  if (pg) openPage(pg[0], pg[2]); else render(true);
})();
