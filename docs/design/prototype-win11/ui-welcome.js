/* Pagewise Win11 风原型 · 新手引导（首次启动，03 §12「没配 AI 服务 / MinerU Token」的正向入口） */
'use strict';
// 四屏：欢迎 → AI 服务 → MinerU Token（可跳过）→ 讲解偏好。不画顶栏；底部按钮放在 #dock 里，始终贴底
const PROVIDERS = [
  ['claude', 'Claude 官方', 'Anthropic Messages · api.anthropic.com', 'ai'],
  ['openai', 'OpenAI 官方', 'OpenAI Responses · api.openai.com', 'cloud'],
  ['relay', 'OpenAI 兼容（中转 / 本地）', 'Chat Completions · 自己填 Base URL', 'gear']
];
SCREENS.welcome = {
  title: '欢迎', short: '欢迎', bare: true,
  render(p) {
    const step = p.step || 0;
    const prog = step ? '<div class="wtop"><button class="ib" aria-label="上一步" onclick="' + on(() => { p.step = step - 1; render(true); }) + '">' + I('back') + '</button><div class="segs">' + [1, 2, 3].map(i => '<i class="' + (i < step ? 'd' : i === step ? 'n' : '') + '"></i>').join('') + '</div><span class="n muted">' + step + '/3</span></div>' : '';
    if (step === 0) return '<div class="wel">' + '<div class="wlogo">' + I('logo') + '</div><h1>Pagewise</h1><p class="muted">带着整本书的 AI 伴读</p>' +
      '<div class="card list wfeat">' + [['listen', '一节一节讲给你听', 'AI 先读完这一节原文，再按「步」讲；每个说法都带页码。'], ['branch', '随时岔出去问', '讲 A* 时问「这跟前面的一致代价搜索什么关系」，它会回去读那一节。'], ['cards', '学完自动整理', '摘要、卡点、闪卡草稿，你勾选后进复习。']].map(([i, t, d]) => row({ t, d, i3: i })).join('') + '</div>' +
      noteHtml('ai', '本地优先：书和学习记录只存在这台手机上。你需要自己准备一个 AI 服务的 Key；PDF 还需要 MinerU Token。', 'lock') + '</div>';
    if (step === 1) {
      const pv = p.pv || 'claude';
      return prog + '<div class="wbody"><h2>配置 AI 服务</h2><p class="muted">讲解、岔路、解释、摘要都靠它。之后可以在「我的 → AI 服务」里加更多。</p>' +
        '<div class="card list radio">' + PROVIDERS.map(([k, t, d, ic]) => '<button class="row tap' + (pv === k ? ' on' : '') + '" role="radio" aria-checked="' + (pv === k) + '" onclick="' + on(() => { p.pv = k; p.tested = false; refresh(); }) + '">' + T3(ic, 'sm') + '<span class="grow"><b>' + t + '</b><small>' + d + '</small></span><span class="rd"></span></button>').join('') + '</div>' +
        '<div class="card" style="margin-top:12px">' + (pv === 'relay' ? '<div class="fld"><label>Base URL</label><input placeholder="https://api.example-relay.com/v1"></div>' : '') +
        '<div class="fld"><label>API Key</label><input type="password" placeholder="' + (pv === 'claude' ? 'sk-ant-…' : 'sk-…') + '" value="' + (p.tested ? 'sk-ant-api03-xxxxxxxx' : '') + '"></div>' +
        '<div class="fld"><button class="btn block" onclick="' + on(() => { p.tested = true; refresh(); showToast('连接正常 · 读到 3 个模型', 'ok'); }) + '">' + I('link') + '测试连接</button></div></div>' +
        (p.tested ? '<div style="margin-top:12px">' + noteHtml('ok', '连接正常。讲解用 <b>claude-sonnet-5-5</b>，整理用 <b>claude-haiku-5-5</b>（可以改）。', 'check') + '</div>' : '') + '</div>';
    }
    if (step === 2) return prog + '<div class="wbody"><h2>MinerU Token</h2><p class="muted">PDF 要先交给 MinerU 解析成文字、公式和图片。EPUB 不需要，可以跳过。</p>' +
      '<div class="card"><div class="fld"><label>Token</label><input placeholder="在 mineru.net 申请后粘贴"></div><div class="fld"><label>有效期</label><input placeholder="2027-01-26"></div></div>' +
      '<div style="margin-top:12px">' + noteHtml('', '每天 ' + MINERU_DAILY_PRIORITY_PAGES + ' 页最高优先级，超出后排队变慢，不会被拦截。单个文件最多 ' + MINERU_MAX_PAGES + ' 页，Pagewise 会自动分片。', 'info') + '</div></div>';
    const P = S.prefs;
    return prog + '<div class="wbody"><h2>你喜欢怎么听</h2><p class="muted">随时可以在「我的 → 讲解偏好」里改。</p>' +
      '<div class="card list">' + row({ t: '先讲直觉，再讲公式', right: swHtml(P.intuition, () => { P.intuition = !P.intuition; }, '先讲直觉') }) +
      row({ t: '每段讲解长度', right: segHtml([['短', '短'], ['中', '中'], ['长', '长']], P.len, k => { P.len = k; refresh(); }, 'width:126px;flex:none') }) +
      row({ t: '一节讲完做小测', right: swHtml(P.quizEnd, () => { P.quizEnd = !P.quizEnd; }, '一节讲完做小测') }) +
      row({ t: '术语中英对照', d: '例如：可容许的（admissible）', right: swHtml(P.bilingual, () => { P.bilingual = !P.bilingual; }, '术语中英对照') }) + '</div>' +
      '<div class="fld" style="padding:12px 0 0"><label>补充要求（可选）</label><textarea placeholder="例如：多用编程里的类比；伪代码用 Python"></textarea></div></div>';
  },
  dock(p) {
    const step = p.step || 0, nx = () => { p.step = step + 1; render(true); };
    const done = () => { S.flags.firstRun = false; S.flags.noAI = false; tab('today'); showToast('准备好了。示例书《人工智能：现代方法》已经在书架上', 'ok'); };
    const b = [['开始配置', nx, 'pri'], ['下一步', nx, 'pri'], ['下一步', nx, 'pri'], ['开始学习', done, 'pri']][step];
    const skip = [['先逛逛，稍后配置', () => { S.flags.firstRun = false; tab('today'); }], ['稍后再配', () => { S.flags.noAI = true; nx(); }], ['我只读 EPUB，跳过', () => { S.flags.noToken = true; nx(); }], null][step];
    return '<div class="wfoot"><button class="btn block ' + b[2] + '" onclick="' + on(b[1]) + '">' + b[0] + '</button>' + (skip ? '<button class="btn text block" onclick="' + on(skip[1]) + '">' + skip[0] + '</button>' : '') + '</div>';
  }
};
