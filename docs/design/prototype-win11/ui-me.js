/* Pagewise Win11 风原型 · 我的（Win11 设置页风格：半透明卡片分组、行首 3D 彩色图标）、外观 */
'use strict';
const daysLeft = d => Math.round((new Date(d + 'T00:00:00') - new Date('2026-10-28T00:00:00')) / 864e5);

SCREENS.me = {
  title: '我的', short: '我的', root: true, kicker: 'Pagewise · 本地优先',
  render() {
    const left = S.sim.tokenExpired ? -1 : daysLeft(S.mineru.expires), noAI = S.flags.noAI, noTk = S.flags.noToken;
    // Win11 Settings 首页的样子：顶部一张概览卡（本机存储 + 三个快捷开关），下面是分组的设置项，行首是 Fluent 3D 图标
    let h = '<section class="card mehero"><div class="top">' + T3('shield') + '<div class="grow"><b>书和学习记录只存在这台手机上</b><small>没有账号、没有后端。上传给 MinerU 和发给 AI 的内容，都在「AI 看到的内容」里看得到。</small></div></div>' +
      '<div class="stor"><div class="l"><span>本机存储</span><span class="n">612 MB / 可用 38.2 GB</span></div><div class="sbar2"><i style="flex:418;background:#4C7CF0"></i><i style="flex:126;background:#9C84FF"></i><i style="flex:68;background:#E2549F"></i><i style="flex:5000;background:var(--line)"></i></div><div class="lgd"><span><i style="background:#4C7CF0"></i>解析结果</span><span><i style="background:#9C84FF"></i>原文件</span><span><i style="background:#E2549F"></i>学习记录</span></div></div>' +
      '<div class="qk">' + [['moon', '深色', S.theme === 'dark', () => { setTheme(S.theme === 'dark' ? 'light' : 'dark'); refresh(); }], ['listen', '先讲直觉', S.prefs.intuition, () => { S.prefs.intuition = !S.prefs.intuition; refresh(); }], ['question', '一节一测', S.prefs.quizEnd, () => { S.prefs.quizEnd = !S.prefs.quizEnd; refresh(); }]].map(([ic, l, v, fn]) => '<button class="' + (v ? 'on' : '') + '" aria-pressed="' + !!v + '" onclick="' + on(fn) + '">' + I(ic) + l + '</button>').join('') + '</div></section>';
    if (noAI || noTk || left <= 7) h += '<div class="pad" style="margin-bottom:16px">' + noteHtml('warn', noAI ? '<b>还没有配置 AI 服务</b>，听讲和解释用不了。' : noTk ? '<b>还没有配置 MinerU Token</b>，PDF 解析不了；EPUB 不受影响。' : left < 0 ? '<b>MinerU Token 已过期</b>，解析会暂停。' : '<b>MinerU Token ' + left + ' 天后过期</b>，到期前去官网换一个新的。', 'warn') + '</div>';
    h += grp('学习', row({ t: '解析服务', d: noTk ? '未配置 Token' : 'MinerU 官方 API · ' + (left < 0 ? 'Token 已过期' : '今日 ' + S.mineru.used + '/' + MINERU_DAILY_PRIORITY_PAGES + ' 页' + (left <= 7 ? ' · Token ' + left + ' 天后过期' : '')), warn: left <= 7 || noTk, i3: 'key', fn: () => go('meMineru') }) +
        row({ t: 'AI 服务', d: noAI ? '未配置' : S.ai.services.length + ' 个服务 · 讲解用 ' + S.ai.teach.split(':')[1], warn: noAI, i3: 'cpu', fn: () => go('meAI') }) +
        row({ t: '讲解偏好', d: (S.prefs.intuition ? '先直觉后公式' : '先定义后直觉') + ' · 每段' + S.prefs.len + ' · ' + (S.prefs.bilingual ? '术语中英对照' : '只用中文术语'), i3: 'sliders', fn: () => go('mePrefs') }) +
        row({ t: '学习记录', d: '连续 ' + STATS.streak + ' 天 · 每日目标 ' + S.goal + ' 分钟', i3: 'chart', fn: () => go('stats') }));
    h += grp('应用', row({ t: '外观', d: 'Win11 风 · ' + { system: '跟随系统', light: '浅色', dark: '深色' }[S.theme] + ' · 正文' + S.fontSize, i3: 'paint', fn: () => go('meAppearance') }) +
        row({ t: '存储与备份', d: S.books.length + ' 本书 · 本机 612 MB', i3: 'drive', fn: () => go('meStorage') }) +
        row({ t: '新手引导', d: '重新走一遍首次启动的三步', i3: 'rocket', fn: () => go('welcome', { step: 0 }) }) +
        row({ t: '关于 Pagewise', d: '版本 0.1 原型 · GPL-3.0', i3: 'info', fn: () => go('about') }));
    return h;
  }
};

SCREENS.meMineru = {
  title: '解析服务', short: '解析服务',
  render() {
    const m = S.mineru, left = S.sim.tokenExpired ? -1 : daysLeft(m.expires);
    if (S.flags.noToken) return '<div class="pad" style="margin:4px 0 16px">' + noteHtml('acc', 'PDF 要先交给 MinerU 解析成文字、公式和图片。去 <b>mineru.net</b> 申请一个 API Token，贴在下面。EPUB 不需要。', 'info') + '</div>' +
      grp('MinerU 官方精准解析 API', '<div class="fld"><label>Token</label><input id="tk" placeholder="粘贴 Token"></div><div class="fld"><label>有效期（API 不返回，按官网显示填写）</label><input placeholder="2027-01-26"></div>' +
        '<div class="fld"><button class="btn pri block" onclick="' + on(() => { S.flags.noToken = false; refresh(); showToast('Token 已保存 · 连接正常', 'ok'); }) + '">保存并测试连接</button></div>', 'Token 保存在 Android Keystore，备份文件里不包含它。');
    return grp('MinerU 官方精准解析 API', '<div class="fld"><label>Token（保存在 Android Keystore，只显示末 4 位）</label><input value="' + esc(m.token) + '" readonly aria-label="Token"></div>' +
        row({ t: '有效期', d: '<span style="color:' + (left < 0 ? 'var(--bad-ink)' : left <= 7 ? 'var(--stuck-ink)' : 'inherit') + '">' + (left < 0 ? '已过期，解析会暂停' : m.expires + ' · 还有 ' + left + ' 天') + '</span>',
          right: '<button class="btn sm pri" onclick="' + on(() => { S.sim.tokenExpired = false; m.token = 'mnr_••••••••••••c71e'; m.expires = '2027-01-26'; S.books.forEach(b => (b.parts || []).forEach(x => { if (x.err) { x.err = null; startParse(b); } })); refresh(); showToast('Token 已更新，暂停的解析会继续', 'ok'); }) + '">更新 Token</button>' }) +
        '<div class="row"><span class="grow"><b>今日额度</b><small>每天 ' + MINERU_DAILY_PRIORITY_PAGES + ' 页最高优先级，超出后排队变慢，不会被拦截</small><div class="bar" style="margin-top:8px"><i style="width:' + Math.min(100, m.used / MINERU_DAILY_PRIORITY_PAGES * 100) + '%"></i></div></span><span class="val n">' + m.used + '/' + MINERU_DAILY_PRIORITY_PAGES + '</span></div>' +
        row({ t: '默认解析模型', d: m.model === 'vlm' ? '公式和复杂排版更好' : '速度更快', right: segHtml([['vlm', 'vlm'], ['pipeline', 'pipeline']], m.model, k => { m.model = k; refresh(); }, 'width:150px;flex:none') }) +
        row({ t: '上传前确认', d: '每次上传书之前弹窗确认', right: swHtml(m.confirm, () => { m.confirm = !m.confirm; refresh(); }, '上传前确认') }) +
        '<button class="row tap link" onclick="' + on(() => showToast('连接正常 · 延迟 182 ms', 'ok')) + '">' + I('link') + '测试连接</button>') +
      grp('自建 MinerU 服务 · V1.1', '<div class="fld"><label>服务地址（例如局域网里 Mac 上的 mineru-api）</label><input placeholder="http://192.168.1.20:8000" disabled></div>', '用自建服务时，书不离开你的网络，也不占官方额度。');
  }
};

SCREENS.meAI = {
  title: 'AI 服务', short: 'AI 服务',
  render() {
    const opts = S.ai.services.flatMap(s => s.models.map(m => [s.id + ':' + m, s.name + ' · ' + m]));
    if (S.flags.noAI) return '<div class="card" style="margin:4px 16px 20px">' + empty('cpu', '还没有 AI 服务', '听讲、岔路、解释、摘要都需要一个 AI 服务。支持 Anthropic Messages、OpenAI Responses、OpenAI Chat Completions 三种协议。', '<button class="btn pri" onclick="go(\'meAIEdit\', {})">' + I('add') + '添加服务</button>') + '</div>';
    const sel = (k, t, d) => '<label class="row"><span class="grow"><b>' + t + '</b><small>' + d + '</small><select class="pick" onchange="' + on(e => { S.ai[k] = e.target.value; refresh(); }) + '">' + opts.map(([v, l]) => '<option value="' + v + '"' + (S.ai[k] === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></span>' + I('updown').replace('class="i"', 'class="i chev"') + '</label>';
    return grp('服务 · Key 保存在 Android Keystore', S.ai.services.map((s, i) => row({ t: esc(s.name) + (i === 0 ? ' <span class="tag ok">正常</span>' : ''), d: esc(s.proto) + ' · ' + esc(s.base.replace(/^https:[/][/]/, '')), i3: i === 0 ? 'ai' : 'cloud', fn: () => go('meAIEdit', { id: s.id }) })).join('') +
        '<button class="row tap link" onclick="' + on(() => go('meAIEdit', {})) + '">' + I('add') + '添加服务</button>') +
      grp('模型分配', sel('teach', '讲解模型', '听讲、岔路、解释') + sel('tidy', '整理模型', '路线图、摘要、闪卡草稿、续学回顾、翻译'), '讲解用强一点的模型，整理用便宜的模型。讲解规则和书的地图走 prompt caching。') +
      grp('用量 · 本机统计', '<div class="row"><span class="grow"><b>人工智能：现代方法</b><small>缓存命中 71%</small><div class="bar" style="margin-top:8px"><i style="width:71%"></i></div></span><span class="val n">1.24M</span></div>' + row({ t: '统计学习方法', d: '解析中，还没开始学', val: '<span class="n">0</span>' }) + row({ t: '本月合计', val: '<span class="n">1.31M tokens</span>' }));
  }
};
SCREENS.meAIEdit = {
  title: p => p.id ? '编辑服务' : '添加服务', short: '服务',
  right: () => '<button class="nt pri" onclick="' + on(() => { if (S.flags.noAI) S.flags.noAI = false; showToast('已保存（原型不改数据）', 'ok'); back(); }) + '">保存</button>',
  render(p) {
    const s = S.ai.services.find(x => x.id === p.id) || { name: '', proto: 'Anthropic Messages', base: '', key: '', models: [] };
    const f = (l, v, ph, extra) => '<div class="fld"><label>' + l + '</label><input value="' + esc(v) + '" placeholder="' + esc(ph || '') + '"' + (extra || '') + '></div>';
    return grp('', f('名称', s.name, '例如：Claude 官方') +
        '<div class="fld"><label>协议</label><select>' + ['Anthropic Messages', 'OpenAI Responses', 'OpenAI Chat Completions'].map(x => '<option' + (x === s.proto ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        f('Base URL', s.base, 'https://api.anthropic.com') + f('API Key', s.key, 'sk-…', ' type="password"') + f('模型（逗号分隔）', s.models.join(', '), 'claude-sonnet-5-5')) +
      '<div class="pad" style="margin:-8px 0 16px">' + noteHtml('', '也可以把服务商给的整段配置（JSON / curl）粘贴到「名称」里，会自动拆出 Base URL、Key 和模型。', 'info') + '</div>' +
      grp('', '<button class="row tap link" onclick="' + on(() => showToast('已读取 3 个模型', 'ok')) + '">' + I('download') + '读取模型列表</button><button class="row tap link" onclick="' + on(() => showToast('连接正常 · 模型列表已读取', 'ok')) + '">' + I('link') + '测试连接</button>') +
      (p.id ? grp('', '<button class="row tap link danger" onclick="' + on(() => modal({ title: '删除「' + esc(s.name) + '」？', body: '用到这个服务的模型分配会改成另一个服务。', ok: '删除', danger: true, onOk: () => setTimeout(() => showToast('原型里不真的删除'), 300) })) + '">删除服务</button>') : '');
  }
};

SCREENS.mePrefs = {
  title: '讲解偏好', short: '讲解偏好',
  render() {
    const P = S.prefs, t = (k, l, d) => row({ t: l, d, right: swHtml(P[k], () => { P[k] = !P[k]; refresh(); }, l) });
    return grp('', t('intuition', '先讲直觉，再讲公式', '关掉后先给定义和公式') +
        row({ t: '每段讲解长度', d: '短：半屏 · 中：一屏半以内 · 长：完整展开', right: segHtml([['短', '短'], ['中', '中'], ['长', '长']], P.len, k => { P.len = k; refresh(); }, 'width:120px;flex:none') }) +
        t('askEach', '每段结尾提一个问题', '确认你懂了再往下讲') + t('quizEnd', '一节讲完做小测', '答错会换个角度再讲一次') +
        t('bilingual', '术语中英对照', '例如：可容许的（admissible）') + t('recap', '续学回顾', '隔天打开时先用三句话回顾上次的进度和卡点')) +
      grp('补充要求', '<div class="fld"><textarea aria-label="补充要求" placeholder="例如：多用编程里的类比；伪代码用 Python">多用编程里的类比，我是后端工程师。</textarea></div>', '会写进讲解规则。') +
      grp('讲解用的语言', row({ t: '讲解语言', d: '和书的语言无关', right: segHtml([['中文', '中文'], ['English', 'English']], P.lang, k => { P.lang = k; refresh(); }, 'width:150px;flex:none') }));
  }
};

// 外观（03 §11 新增）：皮肤、深浅色、正文字号，切换即时生效
SCREENS.meAppearance = {
  title: '外观', short: '外观',
  render() {
    const SK = { paper: ['纸感', 'prototype.html'], glass: ['苹果风', 'prototype-apple.html'], google: ['新谷歌风', 'prototype-google.html'], meta: ['Meta 风', 'prototype-meta.html'] };
    const mini = { paper: '<div class="nv"></div><div class="cd"></div><div class="ln"></div><div class="ln"></div><div class="ln" style="width:60%"></div><div class="tb"></div>',
      glass: '<div class="lt2"></div><div class="cd"></div><div class="ln"></div><div class="ln"></div><div class="tb"></div>',
      google: '<div class="nv"></div><div class="cd"></div><div class="ln"></div><div class="ln"></div><div class="ln" style="width:55%"></div><div class="tb"></div>',
      meta: '<div class="hd"><i></i><u></u><u></u></div><div class="cd"></div><div class="ln"></div><div class="ln"></div><div class="tb"></div>',
      win11: '<div class="h1"></div><div class="as"></div><div class="cd"></div><div class="ln"></div><div class="tb"></div>' };
    const sk = (id, name, d) => '<button class="skin' + (id === 'win11' ? ' on' : '') + '" aria-pressed="' + (id === 'win11') + '" onclick="' + on(() => { if (SK[id]) modal({ title: '切换到「' + SK[id][0] + '」？', body: '原型里每套皮肤是一个单独的文件。会打开 ' + SK[id][1] + '（' + SK[id][0] + '皮肤）。实际 App 里切换不重启、不丢当前页面。', ok: '打开', onOk: () => { location.href = SK[id][1]; } }); }) + '"><div class="mini ' + id + '">' + mini[id] + '</div><b>' + name + '</b><small>' + d + '</small>' + (id === 'win11' ? '<span class="ck2">' + I('check') + '</span>' : '') + '</button>';
    return '<div class="grp-h" style="margin:4px 20px 0">皮肤</div><div class="skins">' + sk('win11', 'Win11 风', 'Mica · 彩虹 · 3D 图标') + sk('paper', '纸感', '默认') + sk('glass', '苹果风', '毛玻璃 · 圆角') + sk('google', '新谷歌风', 'Material 3 · 色调') + sk('meta', 'Meta 风', '灰底白卡 · 胶囊') + '</div><div class="grp-f" style="margin:0 20px 20px">换皮肤只改样子，功能、页面和按钮位置都一样。</div>' +
      grp('深浅色', '<div class="fld">' + segHtml([['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']], S.theme, k => { setTheme(k); refresh(); }) + '</div>') +
      grp('读书正文字号', '<div class="fld">' + segHtml([['小', '小'], ['中', '中'], ['大', '大']], S.fontSize, k => { setFont(k); refresh(); }) + '<div class="fzdemo">可容许的启发式函数从不高估到达目标的代价。</div></div>', '只影响重排模式和讲解正文；界面文字跟随系统字号。') +
      grp('强调色', '<div class="accs">' + ['#0067C0', '#7B4FE0', '#0E8A4F', '#C42B1C', '#E06A00'].map((c, i) => '<button style="background:' + c + '" class="' + (i ? '' : 'on') + '" aria-label="强调色 ' + c + '" onclick="' + on(() => showToast(i ? '原型只做了 Windows 默认蓝' : '已经是默认蓝')) + '">' + (i ? '' : I('check')) + '</button>').join('') + '</div>', 'Windows 11 里强调色跟随系统；V1 固定默认蓝。');
  }
};
function setTheme(k) {
  S.theme = k;
  const dark = k === 'dark' || (k === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
function setFont(k) {
  S.fontSize = k;
  const r = document.documentElement.style;
  r.setProperty('--fz-ai', { 小: '14px', 中: '15.5px', 大: '17.5px' }[k]);
  r.setProperty('--fz-book', { 小: '15px', 中: '16.5px', 大: '19px' }[k]);
}

SCREENS.meStorage = {
  title: '存储与备份', short: '存储',
  render() {
    const sz = { aima: '418 MB', slm: '126 MB', ddia: '12 MB' };
    return '<section class="card mehero" style="margin-top:4px"><div class="stor" style="margin:0"><div class="l"><span>Pagewise 占用</span><span class="n">612 MB</span></div><div class="sbar2"><i style="flex:418;background:#4C7CF0"></i><i style="flex:126;background:#9C84FF"></i><i style="flex:68;background:#E2549F"></i></div><div class="lgd"><span><i style="background:#4C7CF0"></i>解析结果 418 MB</span><span><i style="background:#9C84FF"></i>原文件 139 MB</span><span><i style="background:#E2549F"></i>学习记录 55 MB</span></div></div></section>' +
      grp('每本书', S.books.map(b => row({ t: esc(b.title), d: '原文件 ' + b.size + ' · 解析结果 ' + (sz[b.id] || '—'),
        right: '<button class="btn sm danger" onclick="' + on(() => modal({ title: '清理解析缓存？', body: '会删除《' + esc(b.title) + '》的解析结果（Markdown、内容块、图片），<b>保留学习记录、笔记和闪卡</b>。以后再打开需要重新解析。', ok: '清理', danger: true, onOk: () => setTimeout(() => showToast('原型里不真的删除'), 300) })) + '">清理</button>' })).join('')) +
      grp('备份', row({ t: '导出备份', d: '整库：书的地图、学习记录、笔记、闪卡、设置；不含 API Key 和 Token', i3: 'export', fn: () => showToast('已导出 pagewise-backup-2026-10-29.zip 到「下载」（不含 Key）', 'ok') }) +
        row({ t: '从备份恢复', d: '会覆盖当前的学习记录，恢复前会先自动备份一份', i3: 'cloud', fn: () => modal({ title: '从备份恢复？', body: '会用备份里的内容<b>覆盖</b>当前的书的地图、学习记录、笔记和闪卡。恢复前会先把现在的数据自动备份到「下载」。<br><br>API Key 和 Token 不在备份里，恢复后需要重新填写。', ok: '选择备份文件', onOk: () => setTimeout(() => showToast('选择备份文件（原型未实现）'), 300) }) }), '上次备份：10 月 22 日 · 58 MB');
  }
};
SCREENS.about = {
  title: '关于', short: '关于',
  render: () => '<div class="about"><div class="lg">' + I('logo') + '</div><b>Pagewise</b><div class="muted" style="font-size:13px;margin:2px 0 0">带着整本书的 AI 伴读 · 0.1 原型</div></div>' +
    grp('', '<div class="nd">本地优先，没有后端：书和学习记录只存在手机上。书只在两种情况下离开手机：上传给 MinerU 解析（你确认后），以及当前讲解需要的小节原文发给你配置的 AI 服务。</div>') +
    grp('', row({ t: '版本', d: '开发版：长按版本号进入组件库', val: '0.1 原型', fn: () => go('kit'), chev: false }) + row({ t: '开源协议', val: 'GPL-3.0' }) + row({ t: '导出日志', d: '最近 7 天的运行日志，不含书的内容和 Key', fn: () => showToast('已导出 pagewise-log.txt 到「下载」', 'ok') })) +
    grp('开发', row({ t: '组件库', d: '所有组件的各个状态、Token、图标', i3: 'layers', fn: () => go('kit') }))
};
