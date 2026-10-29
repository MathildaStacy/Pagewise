/* Pagewise 书页排版风原型 · 组件库（02 §9 SkinGallery 的原型版）：Token、字体、所有组件的各个状态、thread 卡片、浮层、图标。
   给实现皮肤的人对照用：每个区块标题后面写着对应的 kit 组件名（02 §5）和这里用到的 CSS class。 */
'use strict';
const KIT_SECS = [['color', '颜色'], ['type', '字体'], ['button', '按钮'], ['input', '输入'], ['select', '选择'], ['info', '提示'], ['progress', '进度'], ['list', '列表'], ['card', '卡片'], ['thread', '听讲'], ['overlay', '浮层'], ['icon', '图标']];
const COLOR_TOKENS = [
  ['纸与线', ['desk', 'bg', 'paper', 'card-hi', 'card-lo', 'surface-alt', 'rule', 'rule2', 'line']],
  ['墨', ['ink', 'ink2', 'ink3', 'paper-ink', 'btn', 'on-btn']],
  ['主线 / 岔路', ['accent', 'accent-bg', 'accent-ink', 'detour', 'detour-bg', 'detour-ink']],
  ['状态', ['ok', 'ok-bg', 'stuck', 'stuck-bg', 'bad', 'bad-bg']],
  ['内容 · 朱批', ['highlight', 'pin', 'pin-bg', 'derive', 'derive-bg', 'ai', 'ai-soft', 'ai-ink', 'example-ink']]
];
SCREENS.kit = {
  title: '组件库', sub: '书页排版风 · 开发用', short: '组件库',
  top: () => '<div class="chips kitnav">' + KIT_SECS.map(([k, l]) => '<button class="chip" onclick="' + on(() => { const el = $('#kit-' + k), v = $('#view'); v.scrollTo({ top: v.scrollTop + el.getBoundingClientRect().top - $('#head').getBoundingClientRect().bottom - 8, behavior: REDUCED ? 'auto' : 'smooth' }); }) + '">' + l + '</button>').join('') + '</div>',
  render() {
    const sec = (k, t, comp, body) => '<section class="kit" id="kit-' + k + '"><div class="grp-h big">' + t + ' <small>' + comp + '</small></div>' + body + '</section>';
    const lab = t => '<div class="kl">' + t + '</div>';
    let h = '<div class="pad" style="margin-bottom:14px">' + noteHtml('acc', '每个区块标题右侧是对应的 kit 组件（docs/dev/02-skins.md §5）和原型里的 CSS class。颜色值从当前深浅色实时读取，切换深色可以对照。', 'info') + '</div>';
    // 颜色
    h += sec('color', '颜色 Token', 'tokens.ts · ColorTokens', COLOR_TOKENS.map(([g, list]) => lab(g) + '<div class="sw-grid">' + list.map(n => '<div class="swc"><i style="background:var(--' + n + ')"></i><b>--' + n + '</b><span data-var="--' + n + '"></span></div>').join('') + '</div>').join(''));
    // 字体
    h += sec('type', '字体', 'TypeTokens', '<div class="card typo">' + [
      ['largeTitle · 32/500 衬线（根页刊头）', '<span style="font:500 32px/1.2 var(--display)">晚上好</span>'],
      ['title · 20/500 衬线（浮层标题、步标题）', '<span style="font:500 20px/1.3 var(--display)">导入一本书</span>'],
      ['headline · 17/500 衬线（顶栏、书名、列表标题）', '<span style="font:500 17px/1.3 var(--display)">3.5.2 A* 搜索</span>'],
      ['label · 11 黑体 · 字距 .16em（区块标题、小字标签）', '<span class="sc">最近的卡点</span>'],
      ['body · 14/400 黑体', '<span style="font-size:14px">讲解规则和书的地图走 prompt caching。</span>'],
      ['aiBody · 黑体 15.5 / 1.75，左边 1px 朱线', '<span style="display:block;font-size:15.5px;line-height:1.75;padding-left:12px;box-shadow:inset 1px 0 0 var(--ai)">书里给的条件叫<b>可容许的</b>：h 从不高估真实代价。</span>'],
      ['bookBody · 宋体 16.5 / 1.9，书页底色', '<span style="display:block;font:16.5px/1.9 var(--serif);background:var(--paper);padding:4px 8px">可容许的启发式本质上是乐观的。</span>'],
      ['caption · 12', '<span style="font-size:12px;color:var(--ink2)">第 3 章 · 通过搜索解决问题</span>'],
      ['数字 · 衬线（大数字）/ tabular-nums（表格）', '<span style="font:400 38px var(--display)">412</span> <span class="n" style="font-size:14px">412 / 1000</span>']
    ].map(([k, v]) => '<div class="tr"><small>' + k + '</small>' + v + '</div>').join('') + '</div>');
    // 按钮
    h += sec('button', '按钮', 'Button · .btn .pri .dt .ai .danger .text .sm .block', lab('variant') + '<div class="btns"><button class="btn pri">主按钮</button><button class="btn">次按钮</button><button class="btn dt">' + I('branch') + '岔路</button><button class="btn ai">' + I('spark') + 'AI</button><button class="btn danger">危险</button><button class="btn danger fill">删除</button><button class="btn text">文字按钮</button></div>' +
      lab('size: sm / 禁用') + '<div class="btns"><button class="btn pri sm">记下</button><button class="btn sm">不用</button><button class="btn pri" disabled>开始复习</button><button class="btn" disabled>次按钮</button></div>' +
      lab('block · 浮动按钮 Fab · 图标按钮 IconButton') + '<button class="btn pri block">' + I('play') + '继续听讲</button><div class="btns" style="margin-top:10px;align-items:center"><span class="fab" style="position:static">' + I('add') + '导入</span><button class="ib">' + I('search') + '</button><button class="ib" style="background:var(--card-hi);box-shadow:inset 0 0 0 1px var(--stroke),var(--sh-card)">' + I('grid') + '</button><span class="avatar">' + I('person') + '</span><button class="nt">导出</button><button class="nt pri">保存</button></div>');
    // 输入
    h += sec('input', '输入', 'Field · Composer · .fld .srch .composer .askbox', '<div class="card">' +
      '<div class="fld"><label>普通</label><input placeholder="例如：Claude 官方"></div>' +
      '<div class="fld"><label>聚焦（底边强调色）</label><input class="kfocus" value="https://api.anthropic.com"></div>' +
      '<div class="fld bad"><label>出错</label><input value="sk-ant-xxx"><div class="err">Key 无效（401）</div></div>' +
      '<div class="fld"><label>只读</label><input readonly value="mnr_••••••••••••a3f9"></div>' +
      '<div class="fld"><label>多行</label><textarea>多用编程里的类比。</textarea></div></div>' +
      lab('搜索框') + '<label class="srch">' + I('search') + '<input placeholder="书名、作者"></label>' +
      lab('听讲输入框（细线框，聚焦时框线变墨蓝；发送键是墨色方块）') + '<form class="composer" style="margin:0" onsubmit="return false"><div class="glow"></div><div class="box"><button type="button" class="ib">' + I('add') + '</button><input placeholder="问点什么，或说「讲慢一点」"><button type="button" class="ib">' + I('mic') + '</button><button class="send">' + I('send') + '</button></div></form>' +
      lab('引用条 QuoteBar') + '<div class="qbar" style="margin:0"><b>' + I('book') + '引用 p.103</b><span class="grow">A* 是否代价最优，取决于启发式函数的性质。</span><button>' + I('close') + '</button></div>');
    // 选择
    h += sec('select', '选择', 'Switch · CheckRow · Segmented · ModeSwitch · QuickActions', '<div class="card list">' +
      row({ t: '开关 · 开', right: '<span class="sw on" role="switch" aria-checked="true"></span>' }) + row({ t: '开关 · 关', right: '<span class="sw" role="switch" aria-checked="false"></span>' }) +
      '<div class="row ck on"><span class="cb">' + I('check') + '</span><span class="grow"><b>复选 · 选中</b><small>CheckRow</small></span></div><div class="row ck"><span class="cb">' + I('check') + '</span><span class="grow"><b>复选 · 未选</b></span></div></div>' +
      lab('分段 Segmented（.selbar.boxed）') + segHtml([['orig', '原版'], ['flow', '重排']], 'orig', () => {}) + '<div style="height:8px"></div>' + segHtml([['短', '短'], ['中', '中'], ['长', '长']], '中', () => {}) +
      lab('读书 | 听讲 ModeSwitch（.selbar.modebar）') + modeBar('listen', () => {}, '<button class="ctx"><i></i>AI 看到的内容' + I('chev') + '</button>') +
      lab('快捷动作 chips（主操作 / 普通 / 岔路 / 筛选选中）') + '<div class="chips" style="padding:0;flex-wrap:wrap"><button class="chip pri">' + I('check') + '懂了，下一步</button><button class="chip">' + I('alt') + '换个说法</button><button class="chip dt">' + I('branch') + '回到主线 3.5.2</button><button class="chip on">在学 1</button></div>');
    // 提示
    h += sec('info', '提示', 'Note · Tag · Toast · badge', ['', 'acc', 'ai', 'ok', 'warn', 'bad'].map((k, i) => '<div style="margin-bottom:6px">' + noteHtml(k, ['默认：解析在后台进行。', '主线：p.1–200 已就绪。', 'AI：回答里每个说法都带页码。', '成功：连接正常。', '卡点 / 警告：Token 3 天后过期。', '错误：Token 已过期（A0211）。'][i], ['clock', 'info', 'spark', 'check', 'warn', 'warn'][i]) + '</div>').join('') +
      lab('Tag') + '<div class="btns">' + [['', '问答 2'], ['acc', '在学'], ['ok', '已学'], ['stuck', '卡点'], ['dt', '岔路'], ['bad', 'PDF'], ['ai', 'AI 起草']].map(([k, l]) => '<span class="tag ' + k + '">' + l + '</span>').join('') + '<span style="position:relative;width:30px;height:20px"><span class="badge" style="left:6px;top:0">12</span></span></div>' +
      lab('Toast（点一下看效果）') + '<div class="btns">' + [['', '默认'], ['ok', '成功'], ['dt', '岔路'], ['bad', '错误']].map(([k, l]) => '<button class="btn sm" onclick="' + on(() => showToast(l + '：' + { '': '已复制', ok: '已保存 5 张闪卡', dt: '这段问答已记入 3.4.2', bad: '网络不可用' }[k], k)) + '">' + l + '</button>').join('') + '</div>');
    // 进度
    h += sec('progress', '进度', 'ProgressBar · StepProgress · StageStrip · SectionStatusIcon', lab('ProgressBar：默认 / AI / 完成 / 出错 / 不确定') + ['', 'ai', 'ok', 'bad', 'ind'].map((k, i) => '<div class="bar ' + k + '" style="margin-bottom:10px"><i style="width:' + [34, 61, 100, 46, 40][i] + '%"></i></div>').join('') +
      lab('分段条：已讲 / 当前 / 跳过 / 未讲') + '<div class="segs"><i class="d"></i><i class="n"></i><i class="k"></i><i></i></div>' +
      lab('步骤卡片 StepProgress') + '<div class="card stepper" style="margin:0"><div class="row1"><span class="no">第 2/4 步</span><b>可容许的启发式</b><span class="pg n">p.103</span>' + I('list') + '</div><div class="segs"><i class="d"></i><i class="n"></i><i></i><i></i></div><div class="names"><button class="d">直觉 ✓</button><button class="n">可容许的启发式</button><button>一致性</button><button>最优性证明</button></div></div>' +
      lab('解析阶段 StageStrip') + '<div class="card part" style="margin:0"><div class="stg">' + STAGES.map((s, j) => '<span class="' + (j < 2 ? 'done' : j === 2 ? 'cur' : '') + '"><i>' + (j < 2 ? I('check') : j + 1) + '</i>' + s + '</span>').join('') + '</div><div class="stg" style="margin-top:8px">' + STAGES.map((s, j) => '<span class="' + (j < 1 ? 'done' : j === 1 ? 'err' : '') + '"><i>' + (j < 1 ? I('check') : j === 1 ? '!' : j + 1) + '</i>' + s + '</span>').join('') + '</div></div>' +
      lab('小节状态：未学 / 在学 / 已学 · 路线图步骤：已讲 / 当前 / 跳过 / 未讲') + '<div class="btns" style="align-items:center">' + sstIcon('new') + sstIcon('learning') + sstIcon('done') + '<span style="width:16px"></span><span class="rs done">' + I('check') + '</span><span class="rs now">2</span><span class="rs skipped">' + I('skip') + '</span><span class="rs todo">4</span></div>');
    // 列表
    h += sec('list', '列表', 'ListSection · Row · .list .row', '<div class="card list">' + row({ t: '纯文字行', d: '副标题' }) + row({ t: '带图标、可点', d: 'MinerU 官方 API · 今日 412/1000 页', i3: 'key', fn: () => {} }) + row({ t: '线条图标 + 右侧值', ic: 'clock', val: '0.1 原型' }) + row({ t: '右侧开关', d: '每段结尾提一个问题', right: '<span class="sw on"></span>' }) + row({ t: '警告副标题', d: 'Token 3 天后过期', warn: true, i3: 'warn', fn: () => {} }) +
      '<button class="row tap link">' + I('add') + '链接行（添加服务）</button><button class="row tap link danger">' + I('trash') + '危险链接行</button></div>' +
      lab('书 Book row（书架、笔记）') + '<div class="card list blist"><button class="book">' + cover(bookOf('aima'), 'sm') + '<span class="grow"><b class="tt">人工智能：现代方法（第4版）</b><span class="meta">Russell, Norvig · PDF · 1136 页</span><span class="st">' + bookStatus(bookOf('aima')) + '</span><span class="bar"><i style="width:34%"></i></span></span>' + chev() + '</button></div>' +
      lab('封面 Cover：lg / 默认 / sm / xs') + '<div class="btns" style="align-items:flex-end">' + cover(bookOf('aima'), 'lg') + cover(bookOf('slm')) + cover(bookOf('ddia'), 'sm') + cover(bookOf('aima'), 'xs') + '</div>');
    // 卡片
    h += sec('card', '卡片', 'ShelfContinueCard（L3 插槽）· Widget · Empty · Skeleton', heroCard().replace('class="hero"', 'class="hero" style="margin:0 0 12px"') + '<div class="row2" style="margin:0 0 12px">' + '<div class="card wid">' + T3('cards') + '<div class="num">12<small>张</small></div><div class="lab">今天要复习的闪卡</div><div class="foot">开始复习' + I('chev') + '</div></div><div class="card wid">' + T3('fire') + '<div class="num">6<small>天</small></div><div class="lab">连续学习</div><div class="days"><i class="on">一</i><i class="on">二</i><i class="on">三</i><i class="today">四</i><i>五</i></div></div></div>' +
      '<div class="card">' + empty('folder', '空状态 Empty', '一句说明 + 主要操作。', '<button class="btn pri sm">导入第一本书</button>') + '</div>' +
      lab('骨架 Skeleton（首次加载 > 300ms）') + '<div class="card skelcard"><div class="skel" style="height:14px;width:80%"></div><div class="skel" style="height:14px;width:60%"></div><div class="skel" style="height:14px;width:70%"></div></div>');
    // thread
    const A = Object.keys(BLK);
    const fake = (o) => Object.assign({ id: uid(), allowed: A }, o);
    h += sec('thread', '听讲 thread', 'AiMessage · UserBubble · ToolSteps · SourceCard · AuxBlock · CheckCard · QuizCard · ProposalCard · FoldCard · DoneCard · Typing', '<div class="thread kthread">' +
      '<div class="sys">3 天前 · 讲完了第 1 步</div>' +
      '<div class="head"><span class="no">第 2 步 · 定义</span><b>可容许的启发式</b><span class="pg n">p.103</span></div>' +
      whoMark([fake({ k: 'tool', lines: ['读取 3.5.2 第 2/4 步原文（p.103）'] }), fake({ k: 'ai', t: 'A* 找到的路一定最便宜吗？答案取决于 $h$。书里给的条件叫**可容许的（admissible）**：$h$ 从不高估到终点的真实代价 [[b:b1025]]。引用了本轮没读的原文会显示成 [[b:b0905x]]。' }), fake({ k: 'src', b: 'b1025' }),
        fake({ k: 'ex', t: 'A 到 G 实际要 5，**h(A)=4**，没有高估；所以这个 h 是可容许的。' }), fake({ k: 'derive', t: '设最优代价 $C^*$，若返回 $C > C^*$，最优路径上必有未扩展结点 n，$f(n) ≤ C^* < C$，矛盾。' }), fake({ k: 'check', t: '想一想：把 h(B) 改成 8，还可容许吗？' })]).map(item).join('') +
      '<div class="user">那如果 h 高估了，会发生什么？</div><div class="user dt"><span class="q">p.91 · 一致代价搜索像水面上的波纹一样…</span>这跟前面的一致代价搜索有什么关系？</div>' +
      '<div class="check quiz"><div class="q">' + T3('question', 'xs') + '<span><small>考考你 · 第 2 步（已作答）</small>下面哪个说法正确？</span></div><div class="opts col"><button class="opt muted"><span class="k">A</span><span class="grow">可容许 ⇒ 一致</span></button><button class="opt right"><span class="k">' + I('check') + '</span><span class="grow">一致 ⇒ 可容许</span></button><button class="opt wrong"><span class="k">' + I('close') + '</span><span class="grow">两者等价</span></button></div></div>' +
      '<div class="card prop"><div class="hd">' + T3('pin', 'xs') + '<span>AI 建议 · 记为卡点</span></div>「一致性和可容许的区别」<div class="btns"><button class="btn sm pri">记下</button><button class="btn sm">不用</button></div></div>' +
      '<div class="fold"><button class="fold-h"><span class="bi">' + I('branch') + '</span><span class="t"><b>岔路已解决 · A* 和一致代价搜索的关系</b><small>回到过 3.4.2 · 3 条</small></span>' + I('chevDown') + '</button></div>' +
      '<div class="detour-run"><div class="ai dt"><div class="md"><p>进行中的岔路：左侧一条紫色竖线，引用胶囊也是紫色 ' + citeHtml('b0902') + '。</p></div></div></div>' +
      '<div class="card donecard"><div class="hd">' + T3('check', 'xs') + '<span>本节讲完了</span></div>4 步里讲了 3 步，跳过 1 步。</div>' +
      '<div class="card errcard"><div class="hd">' + T3('error', 'xs') + '<span>回答中断了</span></div>AI 服务返回 529：服务暂时过载。已收到的部分保留了。<div class="btns"><button class="btn sm pri">' + I('retry') + '重试</button></div></div>' +
      '<div class="card noai">' + T3('cpu') + '<div class="grow"><b>还没有配置 AI 服务</b><span>听讲需要一个 AI 服务来讲解。</span></div></div>' +
      item({ k: 'typing' }) + '</div>' +
      lab('岔路提示条 DetourBanner') + '<div class="banner" style="margin:0"><span class="bi">' + I('branch') + '</span><span class="grow"><small>岔路</small>3.4.2 Dijkstra算法或一致代价搜索</span><button class="btn sm dt">回到主线 3.5.2</button></div>');
    // 浮层
    h += sec('overlay', '浮层', 'Sheet · Dialog · SelectionMenu', '<div class="btns">' +
      '<button class="btn" onclick="' + on(() => sheet({ title: '底部面板 Sheet', sub: '副标题', body: '<p class="sp">按住顶部下滑可以关闭。两个按钮横排，主按钮在左。</p>', acts: [['主操作', closeOverlay, 'pri'], ['取消', closeOverlay]] })) + '">Sheet · 2 个按钮</button>' +
      '<button class="btn" onclick="' + on(() => sheet({ title: '解释', sub: 'p.103 · 3.5.2 A*搜索 · 整理模型', body: quoteHtml(BLK.b1025) + '<div class="ai"><div class="who"><span class="orb">' + I('spark') + '</span>Pagewise</div><div class="md">' + md(BLK.b1025.gist + ' [[b:b1025]]', A) + '</div></div>', acts: [['带到听讲里继续问', closeOverlay, 'pri'], ['好的，贴成便签', closeOverlay], ['记为卡点', closeOverlay]] })) + '">Sheet · 3 个按钮（竖排）</button>' +
      '<button class="btn" onclick="' + on(() => modal({ title: '上传到 MinerU？', body: '《深度学习入门》（22.6 MB，285 页）会上传到 MinerU 官方服务器解析。', ok: '上传并解析' })) + '">Dialog</button>' +
      '<button class="btn danger" onclick="' + on(() => modal({ title: '清理解析缓存？', body: '会删除解析结果，<b>保留学习记录、笔记和闪卡</b>。', ok: '清理', danger: true })) + '">危险 Dialog</button>' +
      '<button class="btn" onclick="' + on(() => modal({ title: '记笔记 · p.103', body: quoteHtml(BLK.b1025) + '<textarea class="edt" placeholder="写下你的理解"></textarea>', ok: '保存' })) + '">带输入的 Dialog</button></div>' +
      lab('段落菜单 SelectionMenu（点下面这段）') + '<div class="page"><div class="blk" id="kitblk" onclick="' + on(e => { e.stopPropagation(); const el = e.currentTarget; el.classList.add('sel'); editMenu(el, [['解释', () => {}, 'spark', 'ai'], ['翻译', () => {}, 'globe'], ['问 AI', () => {}, 'teach'], ['从这里讲', () => {}, 'listen'], ['高亮', () => {}, 'edit'], ['笔记', () => {}, 'note']]); setTimeout(() => el.classList.add('sel'), 0); }) + '">可容许的启发式函数从不高估到达目标的代价，因此是乐观的。</div></div>');
    // 图标
    h += sec('icon', '图标', 'Icon（线条，I()）· 带框图标（T3()）', lab('线条图标 · 1.35 线宽 · 24 网格 · 单色') + '<div class="icgrid">' + Object.keys(ICONS).map(n => '<div>' + I(n) + '<span>' + n + '</span></div>').join('') + '</div>' +
      lab('T3 · 发丝线方框 36/30（lg 56 圆框）· 颜色只表示语义') + '<div class="icgrid i3g">' + Object.keys(ICONS3).map(n => '<div>' + T3(n, 'sm') + '<span>' + n + '</span></div>').join('') + '</div>');
    return h;
  },
  after() {
    const cs = getComputedStyle(document.documentElement);
    $$('#view [data-var]').forEach(el => { el.textContent = cs.getPropertyValue(el.dataset.var).trim().replace(/\s+/g, ' ').slice(0, 40); });
  }
};
