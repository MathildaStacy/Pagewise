/* Pagewise Meta 风原型 · 我的（Facebook 设置页风格：白卡分组、灰色圆形图标）、外观 */
'use strict';
const daysLeft = d => Math.round((new Date(d + 'T00:00:00') - new Date('2026-10-28T00:00:00')) / 864e5);

SCREENS.me = {
  title: '我的', short: '我的', root: true,
  render() {
    const left = S.sim.tokenExpired ? -1 : daysLeft(S.mineru.expires);
    return grp('', row({ t: '解析服务', d: 'MinerU 官方 API · ' + (left < 0 ? 'Token 已过期' : '今日 ' + S.mineru.used + '/' + MINERU_DAILY_PRIORITY_PAGES + ' 页' + (left <= 7 ? ' · Token ' + left + ' 天后过期' : '')), warn: left <= 7, ic: ['doc', 'var(--orange)'], fn: () => go('meMineru') }) +
        row({ t: 'AI 服务', d: S.ai.services.length + ' 个服务 · 讲解用 ' + S.ai.teach.split(':')[1], ic: ['cpu', 'var(--indigo)'], fn: () => go('meAI') }) +
        row({ t: '讲解偏好', d: (S.prefs.intuition ? '先直觉后公式' : '先定义后直觉') + ' · 每段' + S.prefs.len + ' · ' + (S.prefs.bilingual ? '术语中英对照' : '只用中文术语'), ic: ['sliders', 'var(--green)'], fn: () => go('mePrefs') }), '', 'ic') +
      grp('', row({ t: '外观', d: 'Meta 风 · ' + { system: '跟随系统', light: '浅色', dark: '深色' }[S.theme] + ' · 正文' + S.fontSize, ic: ['paint', 'var(--tint)'], fn: () => go('meAppearance') }) +
        row({ t: '存储与备份', d: S.books.length + ' 本书 · 本机 612 MB', ic: ['drive', 'var(--teal)'], fn: () => go('meStorage') }) +
        row({ t: '关于 Pagewise', d: '版本 0.1 原型 · GPL-3.0', ic: ['info', 'var(--label2)'], fn: () => go('about') }), '', 'ic');
  }
};

SCREENS.meMineru = {
  title: '解析服务', short: '解析服务',
  render() {
    const m = S.mineru, left = S.sim.tokenExpired ? -1 : daysLeft(m.expires);
    return grp('MinerU 官方精准解析 API', '<div class="fld"><label>Token（保存在 Android Keystore，只显示末 4 位）</label><input value="' + esc(m.token) + '" readonly aria-label="Token"></div>' +
        row({ t: '有效期', d: '<span style="color:' + (left < 0 ? 'var(--red-ink)' : left <= 7 ? 'var(--orange-ink)' : 'inherit') + '">' + (left < 0 ? '已过期，解析会暂停' : m.expires + ' · 还有 ' + left + ' 天') + '</span>',
          right: '<button class="btn sm pri" onclick="' + on(() => { S.sim.tokenExpired = false; m.token = 'mnr_••••••••••••c71e'; m.expires = '2027-01-26'; S.books.forEach(b => (b.parts || []).forEach(x => { if (x.err) { x.err = null; startParse(b); } })); refresh(); showToast('Token 已更新，暂停的解析会继续', 'ok'); }) + '">更新 Token</button>' }) +
        '<div class="row"><span class="grow"><b>今日额度</b><small>每天 ' + MINERU_DAILY_PRIORITY_PAGES + ' 页最高优先级，超出后排队变慢，不会被拦截</small><div class="bar" style="margin-top:8px"><i style="width:' + Math.min(100, m.used / MINERU_DAILY_PRIORITY_PAGES * 100) + '%"></i></div></span><span class="val n">' + m.used + '/' + MINERU_DAILY_PRIORITY_PAGES + '</span></div>' +
        row({ t: '默认解析模型', d: m.model === 'vlm' ? '公式和复杂排版更好' : '速度更快', right: segHtml([['vlm', 'vlm'], ['pipeline', 'pipeline']], m.model, k => { m.model = k; refresh(); }, 'width:150px;flex:none') }) +
        row({ t: '上传前确认', d: '每次上传书之前弹窗确认', right: swHtml(m.confirm, () => { m.confirm = !m.confirm; refresh(); }, '上传前确认') }) +
        '<button class="row tap link l" onclick="' + on(() => showToast('连接正常 · 延迟 182 ms', 'ok')) + '">测试连接</button>') +
      grp('自建 MinerU 服务 · V1.1', '<div class="fld"><label>服务地址（例如局域网里 Mac 上的 mineru-api）</label><input placeholder="http://192.168.1.20:8000" disabled></div>', '用自建服务时，书不离开你的网络，也不占官方额度。');
  }
};

SCREENS.meAI = {
  title: 'AI 服务', short: 'AI 服务',
  render() {
    const opts = S.ai.services.flatMap(s => s.models.map(m => [s.id + ':' + m, s.name + ' · ' + m]));
    const sel = (k, t, d) => '<label class="row"><span class="grow"><b>' + t + '</b><small>' + d + '</small><select style="margin-top:4px;color:var(--tint);font-size:15px;-webkit-appearance:none;appearance:none;cursor:pointer" onchange="' + on(e => { S.ai[k] = e.target.value; refresh(); }) + '">' + opts.map(([v, l]) => '<option value="' + v + '"' + (S.ai[k] === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></span>' + I('updown').replace('class="i"', 'class="i chev"') + '</label>';
    return grp('服务 · Key 保存在 Android Keystore', S.ai.services.map(s => row({ t: esc(s.name), d: esc(s.proto) + ' · ' + esc(s.base.replace(/^https:[/][/]/, '')), fn: () => go('meAIEdit', { id: s.id }) })).join('') +
        '<button class="row tap link l" onclick="' + on(() => go('meAIEdit', {})) + '">' + I('add') + '添加服务</button>') +
      grp('模型分配', sel('teach', '讲解模型', '听讲、岔路、解释') + sel('tidy', '整理模型', '路线图、摘要、闪卡草稿、续学回顾、翻译'), '讲解用强一点的模型，整理用便宜的模型。讲解规则和书的地图走 prompt caching。') +
      grp('用量 · 本机统计', row({ t: '人工智能：现代方法', val: '<span class="n">1.24M · 缓存 71%</span>' }) + row({ t: '本月合计', val: '<span class="n">1.31M tokens</span>' }));
  }
};
SCREENS.meAIEdit = {
  title: p => p.id ? '编辑服务' : '添加服务', short: '服务',
  right: () => '<button class="nt" style="font-weight:600" onclick="' + on(() => { showToast('已保存（原型不改数据）', 'ok'); back(); }) + '">保存</button>',
  render(p) {
    const s = S.ai.services.find(x => x.id === p.id) || { name: '', proto: 'Anthropic Messages', base: '', key: '', models: [] };
    const f = (l, v, ph) => '<div class="fld"><label>' + l + '</label><input value="' + esc(v) + '" placeholder="' + esc(ph || '') + '"></div>';
    return grp('', f('名称', s.name, '例如：Claude 官方') +
        '<div class="fld"><label>协议</label><select>' + ['Anthropic Messages', 'OpenAI Responses', 'OpenAI Chat Completions'].map(x => '<option' + (x === s.proto ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        f('Base URL', s.base, 'https://api.anthropic.com') + f('API Key', s.key, 'sk-…') + f('模型（逗号分隔）', s.models.join(', '), 'claude-sonnet-5-5')) +
      grp('', '<button class="row tap link l" onclick="' + on(() => showToast('已读取 3 个模型', 'ok')) + '">读取模型列表</button><button class="row tap link l" onclick="' + on(() => showToast('连接正常 · 模型列表已读取', 'ok')) + '">测试连接</button>') +
      (p.id ? grp('', '<button class="row tap link l" style="color:var(--red)" onclick="' + on(() => modal({ title: '删除「' + esc(s.name) + '」？', body: '用到这个服务的模型分配会改成另一个服务。', ok: '删除', danger: true, onOk: () => setTimeout(() => showToast('原型里不真的删除'), 300) })) + '">删除服务</button>') : '');
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
      grp('补充要求', '<div class="fld"><textarea aria-label="补充要求" placeholder="例如：多用编程里的类比；伪代码用 Python">多用编程里的类比，我是后端工程师。</textarea></div>', '会写进讲解规则。');
  }
};

// 外观（03 §11 新增）：皮肤、深浅色、正文字号，切换即时生效
SCREENS.meAppearance = {
  title: '外观', short: '外观',
  render() {
    const SK = { paper: ['纸感', 'prototype.html'], glass: ['苹果风', 'prototype-apple.html'], google: ['新谷歌风', 'prototype-google.html'] };
    const sk = (id, name, d) => '<button class="skin' + (id === 'meta' ? ' on' : '') + '" aria-pressed="' + (id === 'meta') + '" onclick="' + on(() => { if (SK[id]) modal({ title: '切换到「' + SK[id][0] + '」？', body: '原型里每套皮肤是一个单独的文件。会打开 ' + SK[id][1] + '（' + SK[id][0] + '皮肤）。实际 App 里切换不重启、不丢当前页面。', ok: '打开', onOk: () => { location.href = SK[id][1]; } }); }) + '"><div class="mini ' + id + '">' +
      (id === 'paper' ? '<div class="nv"></div><div class="cd"></div><div class="ln"></div><div class="ln"></div><div class="ln" style="width:60%"></div><div class="tb"></div>'
        : id === 'glass' ? '<div class="lt2"></div><div class="cd"></div><div class="ln"></div><div class="ln"></div><div class="tb"></div>'
        : id === 'google' ? '<div class="nv"></div><div class="cd"></div><div class="ln"></div><div class="ln"></div><div class="ln" style="width:55%"></div><div class="tb"></div>'
        : '<div class="hd"><i></i><u></u><u></u></div><div class="cd"></div><div class="ln"></div><div class="ln"></div><div class="tb"></div>') + '</div>' + name + '<small>' + d + '</small></button>';
    return '<div class="grp-h" style="margin:12px 12px 0">皮肤</div><div class="skins">' + sk('paper', '纸感', '默认') + sk('glass', '苹果风', '毛玻璃 · 圆角') + sk('google', '新谷歌风', 'Material 3 · 色调') + sk('meta', 'Meta 风', '灰底白卡 · 胶囊') + '</div><div class="grp-f" style="margin:0 12px 20px">换皮肤只改样子，功能、页面和按钮位置都一样。</div>' +
      grp('深浅色', [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, l]) => row({ t: l, fn: () => { setTheme(k); refresh(); }, chev: false, right: S.theme === k ? '<span style="color:var(--tint);display:flex">' + I('check') + '</span>' : '' })).join('')) +
      grp('读书正文字号', '<div class="fld">' + segHtml([['小', '小'], ['中', '中'], ['大', '大']], S.fontSize, k => { setFont(k); refresh(); }) + '<div class="ai" style="margin-top:12px;font-family:var(--serif);font-size:var(--fz-book);line-height:1.8">可容许的启发式函数从不高估到达目标的代价。</div></div>', '只影响重排模式和讲解正文。');
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
  r.setProperty('--fz-ai', { 小: '15px', 中: '17px', 大: '19px' }[k]);
  r.setProperty('--fz-book', { 小: '15px', 中: '17px', 大: '19.5px' }[k]);
}

SCREENS.meStorage = {
  title: '存储与备份', short: '存储',
  render() {
    const sz = { aima: '418 MB', slm: '126 MB', ddia: '12 MB' };
    return grp('每本书', S.books.map(b => row({ t: esc(b.title), d: '原文件 ' + b.size + ' · 解析结果 ' + (sz[b.id] || '—'),
        right: '<button class="btn sm danger" onclick="' + on(() => modal({ title: '清理解析缓存？', body: '会删除《' + esc(b.title) + '》的解析结果（Markdown、内容块、图片），<b>保留学习记录、笔记和闪卡</b>。以后再打开需要重新解析。', ok: '清理', danger: true, onOk: () => setTimeout(() => showToast('原型里不真的删除'), 300) })) + '">清理</button>' })).join('')) +
      grp('备份', row({ t: '导出备份', d: '整库：书的地图、学习记录、笔记、闪卡、设置；不含 API Key 和 Token', fn: () => showToast('已导出 pagewise-backup-2026-10-28.zip 到「下载」（不含 Key）', 'ok') }) +
        row({ t: '从备份恢复', fn: () => showToast('选择备份文件（原型未实现）') }));
  }
};
SCREENS.about = {
  title: '关于', short: '关于',
  render: () => '<div class="about"><div class="lg">' + I('logo') + '</div><b>Pagewise</b><div class="muted" style="font-size:13px;margin:2px 0 0">带着整本书的 AI 伴读 · 0.1 原型</div></div>' +
    grp('', '<div class="nd" style="font-size:14px">本地优先，没有后端：书和学习记录只存在手机上。书只在两种情况下离开手机：上传给 MinerU 解析（你确认后），以及当前讲解需要的小节原文发给你配置的 AI 服务。</div>') +
    grp('', row({ t: '版本', val: '0.1 原型' }) + row({ t: '开源协议', val: 'GPL-3.0' }))
};
