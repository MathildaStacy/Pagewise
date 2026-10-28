# 02 · 设计系统与换肤

## 1. 目标

- 业务和 UI 完全分开：同一份 ViewModel 可以由任意皮肤渲染。
- V1 交付两套皮肤：
  - **`paper` 纸感（默认）**：视觉、布局、交互以 `docs/design/prototype.html` 为准。
  - **`glass` 苹果风**：功能、信息架构、操作流程、按钮所在区域和 `paper` 一致；组件的样子、材质、字体、动效按 iOS（Liquid Glass）的习惯重新做，参考 `docs/design/explore/apple.html`。**不是给 paper 换一套颜色**，见 §2。
- 以后加 Meta 风、谷歌风等，只新增 `src/ui/skins/<name>/`，不改业务代码，也尽量不改页面。

## 2. 皮肤之间什么必须一样、什么可以不同

这张表是给苹果风（以及以后的皮肤）的边界。实现时拿不准的情况，先查这张表。

| | 必须一样（所有皮肤） | 可以不同（皮肤自己决定） |
| --- | --- | --- |
| 功能 | 每个页面能做的事、确认步骤、AI 只提议不直接写 | — |
| 信息架构 | 4 个 Tab 及顺序、页面集合、导航关系、哪些内容在哪个页面 | 页面内的分组方式（如 iOS 的圆角分组列表 vs 通栏列表） |
| 操作位置 | 每个操作所在的**区域**：顶栏左返回 / 顶栏右操作、听讲页底部的快捷动作 + 输入框、顶部进度 + 岔路提示条、书架的导入入口、浮层底部的按钮区 | 区域内部的排布细节（对齐、间距、按钮宽窄）、按钮的样子（实心 / 胶囊 / 文字按钮） |
| 文案 | 所有文案（VM 给的字符串原样显示） | 纯装饰性的标签（如 iOS 返回键旁显示上一页标题"地图"） |
| 语义色 | 主线、岔路、高亮、卡点、补充推导、AI 举例、对 / 错，各自颜色互不相同；原书文字和 AI 讲解一眼能分开（原书用衬线体） | 具体色值、明暗、透明度 |
| 状态表达 | 每个状态都要能看出来（已讲 / 当前 / 跳过 / 未讲；解析各阶段；卡片盒子） | 用颜色、记号、形状、动效中的哪种表达 |
| 交互 | 点哪里触发什么；浮层能下滑关闭；返回键行为 | 动效曲线、时长、按下反馈（缩放 / 涟漪 / 高亮），平台习惯的**附加**手势（如列表左滑出快捷操作），但附加手势不能是唯一入口 |
| 组件形态 | — | 顶栏（居中小标题 / 大标题随滚动收起）、Tab 栏（通栏 / 悬浮胶囊）、分段控件、开关、浮层（带档位的 iOS sheet / Material bottom sheet）、选择菜单、提示（Toast / 顶部 HUD）、材质（实色 / 毛玻璃）、圆角、阴影、图标集、字体字号 |
| 无障碍 | 触控目标 ≥ 48dp、跟随系统字号、浅深色对比度 WCAG AA、`accessibilityLabel` 一致 | — |

一句话：**用户换皮肤后不需要重新学怎么用，但能明显感觉到是另一种风格的 App。**

## 3. 三层定制

```
L1 Token        颜色、字体、字号、圆角、间距、阴影、材质、动效        每套皮肤必须给全（light + dark）
L2 组件实现     Button、Sheet、AppBar、StepProgress…（§5 的契约）      皮肤可以只覆盖一部分，其余用 base 实现
L3 页面插槽     某个页面的局部区域整体替换（如书架顶部的「继续学习」卡）  尽量不用；用了要在 skin.md 写明理由
```

- `src/ui/kit/base/` 是一套**按契约写好、只读 Token 的基础实现**。paper 皮肤基本等于 base + paper Token。
- glass 皮肤覆盖：`AppBar`、`TabBar`、`ModeSwitch`、`Segmented`、`Switch`、`Sheet`、`Dialog`、`Toast`、`SelectionMenu`、`StepProgress`、`QuickActions`、`Composer`、`ListSection`/`Row`、`Button`、`Glass`（新材质）。其余（富文本、消息气泡、卡片类）只靠 Token 区分。
- V1 不允许 L3 整页替换；L3 插槽只开放 §6.3 列出的几个。

## 4. Token

### 4.1 类型（`src/ui/kit/tokens.ts`）

```ts
export type Scheme = 'light' | 'dark';

export interface ColorTokens {
  // 底与面
  bg: string;          // 页面底色（prototype --bg / apple --bg）
  surface: string;     // 卡片、列表行、顶栏（prototype #fff / apple --bg2）
  surfaceAlt: string;  // 次级填充：分段控件底、灰按钮（prototype --bg / apple --fill）
  paper: string;       // 原书页面底（prototype --paper / apple --page）
  paperInk: string;    // 原书文字
  pressed: string;     // 按下态
  line: string;        // 分隔线、描边
  scrim: string;       // 浮层遮罩
  // 文字
  ink: string; ink2: string; ink3: string;
  onAccent: string;    // 主色上的文字
  // 语义色（每组：前景 / 浅底 / 深前景）
  accent: string; accentBg: string; accentInk: string;   // 主线、主按钮、引用
  detour: string; detourBg: string;                       // 岔路
  stuck: string; stuckBg: string; stuckInk: string;       // 卡点
  ok: string; okBg: string;                               // 已学、答对
  bad: string; badBg: string; badInk: string;             // 错误、答错
  highlight: string;                                      // 高亮底
  pin: string; pinBg: string;                             // 问答便签
  derive: string; deriveBg: string;                       // 补充推导
  example: string; exampleBg: string;                     // AI 举例
  stepDone: string; stepCur: string; stepTodo: string;    // 进度
  // 材质
  glass: string; glassStrong: string; glassLine: string;  // paper 皮肤里等于 surface
}

export interface TypeStyle { fontFamily?: string; fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700'; letterSpacing?: number }
export interface TypeTokens {
  largeTitle: TypeStyle;  // 根页面大标题（paper 不用，等于 title）
  title: TypeStyle;       // 顶栏标题
  headline: TypeStyle;    // 区块标题、卡片标题
  body: TypeStyle;        // 界面正文
  aiBody: TypeStyle;      // AI 讲解正文（需求：16 / 1.75）
  bookBody: TypeStyle;    // 原书正文（衬线）
  bookOrig: TypeStyle;    // 原版页里的文字（较小）
  label: TypeStyle;       // 按钮、标签
  caption: TypeStyle;     // 次要说明
  micro: TypeStyle;       // tag、引用胶囊
  num: { fontFamily?: string; fontVariant: ['tabular-nums'] };
  serifFamily: string;    // Android：'serif'（系统 Noto Serif CJK）
  sansFamily: string;     // Android：'sans-serif'
}

export interface ShapeTokens { xs: number; sm: number; md: number; lg: number; xl: number; sheet: number; pill: 999 }
export interface SpaceTokens { pageX: number; gap: number; rowY: number; sectionGap: number }
export interface ElevationTokens { card: ShadowStyle; pop: ShadowStyle; fab: ShadowStyle }  // ShadowStyle = RN 阴影字段 + elevation
export interface MotionTokens {
  fast: number; normal: number; slow: number;     // ms
  easing: [number, number, number, number];       // cubic-bezier
  spring: { damping: number; stiffness: number; mass: number };
  pressScale: number;                              // 按下缩放（paper 1 = 不缩放，用底色反馈）
}
export interface Tokens {
  scheme: Scheme;
  color: ColorTokens; type: TypeTokens; shape: ShapeTokens; space: SpaceTokens;
  elevation: ElevationTokens; motion: MotionTokens;
  capabilities: { blur: boolean; haptics: boolean };
}
```

字号单位是 dp，渲染时让 RN 默认的 `allowFontScaling` 生效（跟随系统字号）；所有固定高度的容器（按钮、行）用 `minHeight`，不能把放大后的文字截断。

### 4.2 paper 皮肤取值（`skins/paper/tokens.ts`）

浅色直接取自 `docs/design/prototype/shell.html` 的 `:root`。深色原型里没有，下表是**初稿**，T2 做完后跑对比度测试（§8），不达标就调。新增的「补充推导 / AI 举例 / 便签」原型里没有，也是初稿。

| Token | light | dark（初稿） |
| --- | --- | --- |
| bg | `#F4F3F0` | `#121316` |
| surface | `#FFFFFF` | `#1C1D21` |
| surfaceAlt | `#F4F3F0` | `#26272C` |
| paper | `#FBF8F1` | `#1E1C18` |
| paperInk | `#2A2723` | `#DDD6C8` |
| pressed | `#F8F7F5` | `#232428` |
| line | `#ECEAE6` | `#2E2F34` |
| scrim | `rgba(0,0,0,.42)` | `rgba(0,0,0,.6)` |
| ink / ink2 / ink3 | `#1F2329` / `#5C626B` / `#9AA0A8` | `#E8E6E1` / `#ABAFB6` / `#7D828A` |
| onAccent | `#FFFFFF` | `#0E1A30` |
| accent / accentBg / accentInk | `#2F5AA8` / `#EAF0FA` / `#1E3F7A` | `#86A8E8` / `#1F2B42` / `#B9CCF2` |
| detour / detourBg | `#7A4FB5` / `#F3EEFA` | `#B996EA` / `#2B2339` |
| stuck / stuckBg / stuckInk | `#C2610C` / `#FDF1E6` / `#7A3D06` | `#F0A060` / `#3A2716` / `#F6C9A0` |
| ok / okBg | `#2E8B57` / `#E8F5EE` | `#5CC08A` / `#173322` |
| bad / badBg / badInk | `#C8372D` / `#FCEBEA` / `#8A231C` | `#F07A70` / `#3B1C1A` / `#F7B7B1` |
| highlight | `#FFE89A` | `#5C4B14` |
| pin / pinBg | `#8A5A00` / `#FFF6D6` | `#FFD66B` / `#3A3115` |
| derive / deriveBg | `#6B5A2E` / `#F5F0E3` | `#D9C58F` / `#2B261A` |
| example / exampleBg | `#1F7A6E` / `#E6F3F1` | `#6FD1C2` / `#15302C` |
| stepDone / stepCur / stepTodo | `#2F5AA8` / `#9DB3DC` / `#F4F3F0` | `#86A8E8` / `#3D5580` / `#26272C` |
| glass / glassStrong / glassLine | = surface / surface / line | 同左 |

其他：
- 字体：界面 `sans-serif`，原书 `serif`。字号：title 17/600，headline 15/600，body 14/400 行高 1.5，aiBody 16 行高 1.78（28），bookBody 16.5 行高 1.9，bookOrig 12.5 行高 1.85，label 13/500，caption 12，micro 11。
- 圆角：xs 3（tag）、sm 8（输入框、note、分段）、md 10–12（卡片、测验选项）、lg 16（继续学习卡、对话框）、sheet 18、按钮全部胶囊。
- 阴影：card 无（靠底色分区），pop `0 6 16 rgba(0,0,0,.3)`，fab `0 4 14 rgba(0,0,0,.25)`；Android 用 `elevation` 2 / 8 / 6 近似。
- 动效：fast 150、normal 260、slow 400，easing `(.3,.7,0,1)`，pressScale 1（按下用 `pressed` 底色）。
- capabilities：blur false，haptics false。

### 4.3 glass 皮肤取值（`skins/glass/tokens.ts`）

取自 `explore/src/apple.html` 的 `:root` 和 `[data-theme=dark]`。

| Token | light | dark |
| --- | --- | --- |
| bg | `#F2F2F7` | `#000000` |
| surface | `#FFFFFF` | `#1C1C1E` |
| surfaceAlt | `rgba(120,120,128,.14)` | `rgba(120,120,128,.28)` |
| paper | `#FFFFFF` | `#1C1C1E` |
| paperInk | `#000000` | `#FFFFFF` |
| line | `rgba(60,60,67,.16)` | `rgba(84,84,88,.55)` |
| scrim | `rgba(0,0,0,.22)` | `rgba(0,0,0,.45)` |
| ink / ink2 / ink3 | `#000` / `rgba(60,60,67,.62)` / `rgba(60,60,67,.32)` | `#FFF` / `rgba(235,235,245,.62)` / `rgba(235,235,245,.3)` |
| accent / accentBg | `#007AFF` / `rgba(0,122,255,.11)` | `#0A84FF` / `rgba(10,132,255,.2)` |
| detour / detourBg | `#5856D6` / `rgba(88,86,214,.11)` | `#7D7AFF` / `rgba(94,92,230,.22)` |
| stuck | `#E07A00` | `#FF9F0A` |
| ok | `#34C759` | `#30D158` |
| bad | `#FF3B30` | `#FF453A` |
| highlight | `rgba(255,204,0,.32)` | `rgba(255,214,10,.26)` |
| pin / pinBg | `#8A5A00` / `rgba(255,204,0,.2)` | `#FFD60A` / `rgba(255,214,10,.14)` |
| derive / deriveBg | `#AF52DE` / `rgba(175,82,222,.09)` | `#DA8FFF` / `rgba(191,90,242,.16)` |
| example / exampleBg | `#0A9CB5` / `rgba(48,176,199,.11)` | `#5DE0F5` / `rgba(64,200,224,.14)` |
| glass / glassStrong / glassLine | `rgba(255,255,255,.66)` / `rgba(255,255,255,.9)` / `rgba(255,255,255,.75)` | `rgba(40,40,44,.62)` / `rgba(44,44,48,.92)` / `rgba(255,255,255,.12)` |

缺的（accentInk、stuckBg、okBg、badBg、badInk、stuckInk、stepXxx、pressed、onAccent）按同色 10–14% 透明度做浅底、深色版取更亮一档补齐，T2 时写进文件并跑对比度测试。

其他：
- 字体：Android 上没有 SF，用系统 `sans-serif`（Roboto + Noto Sans CJK）；原书 `serif`。字号按 iOS 档位：largeTitle 34/700，title 17/600，headline 21/700（步骤标题），body 17 行高 1.47，aiBody 17 行高 1.65，bookBody 17 行高 1.85，label 15/500，caption 13，micro 12/600。
- 圆角：sm 10、md 18–20（卡片、源文卡、补充块）、lg 24（书页）、sheet 40（悬浮式 sheet，左右下各留 8）、按钮和 chip 全胶囊。
- 阴影：pop `0 8 28 rgba(0,0,0,.10)` + 0.5 内描边（glassLine）。
- 动效：normal 380、slow 460，easing `(.32,.72,0,1)`（iOS 弹性），pressScale 0.96，消息出现「上浮 10dp + 淡入」。
- capabilities：blur true（运行时检测，低端机 / 省电模式降级），haptics false（V1 不加震动依赖）。

### 4.4 图标

`skin.icons: Record<IconName, IconComponent>`。`IconName` 是固定枚举（`back`、`more`、`search`、`check`、`skip`、`next`、`send`、`mic`、`book`、`bookOpen`、`teach`、`derive`、`spark`、`clock`、`chev`、`branch`、`pin`、`flag`、`cards`、`note`、`person`、`shelf`、`add`、`close`、`sync`…，T2 列全）。paper 用 lucide 1.7 线宽；glass 用 lucide 1.9–2.4 线宽、圆头（接近 SF Symbols），返回键是「‹」细箭头。页面只写 `<Icon name="back" />`。

## 5. 组件契约

所有组件从 `@ui/kit` 导入；它们是**代理**，运行时从当前皮肤取实现：

```tsx
// src/ui/kit/proxy.tsx
export function makeProxy<K extends keyof ComponentMap>(name: K) {
  const Proxy = (props: ComponentProps<K>) => {
    const Impl = useSkin().components[name];   // 皮肤覆盖 ?? base
    return <Impl {...props} />;
  };
  Proxy.displayName = `Kit.${name}`;
  return Proxy;
}
export const Button = makeProxy('Button');
```

契约（props 是皮肤之间的唯一约定，**皮肤不能加必填 props**）。下表列全部组件，粗体是 glass 要自己实现的。

| 组件 | 关键 props | 说明 |
| --- | --- | --- |
| `Screen` | `scroll?`, `edges?`, `children` | 页面根容器：底色、安全区 |
| **`AppBar`** | `title`, `subtitle?`, `variant: 'root'\|'push'`, `onBack?`, `backLabel?`, `right?: ReactNode`, `scrollY?` | paper：48dp 白底居中标题（root 左对齐 20 号）。glass：push 页居中标题 + 「‹ backLabel」，root 页大标题随 `scrollY` 收起成小标题 |
| **`TabBar`** | `items: {key,label,icon,badge?}[]`, `active`, `onSelect` | paper：58dp 通栏。glass：悬浮胶囊毛玻璃，选中项胶囊底 |
| **`ModeSwitch`** | `value: 'read'\|'listen'`, `onChange` | 「读书 \| 听讲」，放在顶栏右侧（两个皮肤都在这里）。paper：主色浅底 + 主色滑块（原型 `.nav .mode`）。glass：iOS 分段控件（灰底白滑块） |
| **`Segmented`** | `options`, `value`, `onChange` | 原版/重排、vlm/pipeline、短/中/长、Markdown/Anki |
| **`Switch`** | `value`, `onChange`, `accessibilityLabel` | glass 打开态用 `ok` 绿 |
| **`Button`** | `variant: 'primary'\|'secondary'\|'ghost'\|'detour'\|'danger'\|'text'`, `size: 'sm'\|'md'\|'block'`, `icon?`, `disabled?`, `onPress` | |
| `IconButton` | `icon`, `onPress`, `label`, `badge?` | |
| **`QuickActions`** | `items: {key,label,kind?:'primary'\|'detour',icon?}[]`, `onPress(key)` | 听讲页输入框上方横向滚动的快捷动作。glass：毛玻璃 chip，浮在内容上 |
| **`Composer`** | `value`, `onChange`, `placeholder`, `onSend`, `sendDisabled`, `quote?: {label,onClear}`, `micAvailable`, `onMic?` | glass：毛玻璃胶囊 + 底部渐隐 |
| **`StepProgress`** | `steps: {title, state:'done'\|'current'\|'skipped'\|'todo'}[]`, `label`, `onPressStep(i)`, `onPressBar`, `right?` | 听讲页顶部进度。paper：原型 `.stbar`（左「第 k/n 步」+ 细分段条 + 右「AI 看到的内容 ›」），点条打开路线图浮层。glass：同一位置的横向胶囊步骤条（apple.html `.rail`），点某一步直接触发 `onPressStep` |
| `DetourBanner` | `title`, `onBack`, `backLabel` | 岔路提示条，在进度条下方 |
| `ListSection` / **`Row`** | `title?`, `note?` / `title`, `subtitle?`, `right?`, `chevron?`, `onPress?`, `tone?` | glass：inset 圆角分组，分隔线缩进 |
| `Field` | `label`, `value`, `onChange`, `secure?`, `multiline?`, `placeholder?`, `error?` | |
| `Note` | `tone: 'neutral'\|'accent'\|'warn'\|'bad'`, `children` | 原型 `.note` |
| `Tag` | `tone`, `label` | |
| `ProgressBar` | `value 0..1`, `tone?` | |
| `StageStrip` | `stages: {label, state:'done'\|'current'\|'error'\|'todo'}[]` | 解析阶段条 |
| `Cover` | `title`, `color`, `size` | 书封面占位 |
| `StatusDot` / `SectionStatusIcon` | `tone` / `status: 'new'\|'learning'\|'done'` | |
| `CheckRow` | `checked`, `title`, `subtitle?`, `tag?`, `onToggle` | 小结页的勾选 |
| **`Sheet`** | `visible`, `title`, `subtitle?`, `onClose`, `actions?: {label, kind, onPress}[]`, `detent?: 'auto'\|'half'\|'full'`, `children` | paper：直角贴底、顶部 18 圆角、按钮横排。glass：悬浮 40 圆角毛玻璃、按钮竖排全宽 |
| **`Dialog`** | `visible`, `title`, `body`, `confirm`, `cancel?`, `onConfirm`, `onCancel` | |
| **`Toast`** / `ToastHost` | `message`, `tone: 'default'\|'ok'\|'detour'\|'bad'` | paper：顶部深色圆角条；glass：顶部毛玻璃 HUD 胶囊 |
| **`SelectionMenu`** | `anchor: {x,y,w,h}`, `items: {key,label}[]`, `onSelect`, `onDismiss` | 读书页点段落的菜单。paper：深色横条（原型 `.selmenu`）。glass：iOS 编辑菜单样式（浅色胶囊、竖线分隔） |
| `Fab` | `label`, `icon`, `onPress` | 书架「＋ 导入」 |
| **`Glass`** | `strength: 'regular'\|'strong'`, `style`, `children` | 材质容器。paper 实现 = 实色 `surface` |
| `Empty` | `title?`, `body` | |
| 富文本 `RichView` | `doc: RichDoc`, `onCite(ref)`, `onFigure(ref)` | 渲染 AI 讲解 AST（05 §2）：段落、粗体、行内 / 独立公式、引用胶囊、未核实标记、列表、图、补充推导块、AI 举例块 |
| `MathView` | `tex`, `display` | 调 `MathRenderer`，`SvgXml` 显示；失败时显示 TeX 原文（等宽） |
| `CiteChip` | `label('p.103')`, `tone: 'main'\|'detour'`, `onPress` | |
| `FigureView` | `uri`, `caption`, `onPress` | |
| 听讲 thread 卡片 | `UserBubble`、`AiMessage`、`ToolSteps`、`StepHeader`、`SourceCard`、`AuxBlock(kind)`、`CheckCard`、`ResumeCard`、`FoldCard`、`QuizCard`、`ProposalCard`、`DoneCard`、`SysDivider`、`Typing` | props 一一对应 03 §5.2 的 `ThreadItem` |
| 读书 | `PageOrig`（位图 + 位置框叠加）、`BlockView`、`PinChip`、`GuideBar`、`ReadEnd` | |
| 复习 | `FlashCard`、`RateBar`、`BoxChart` | |
| 上下文面板 | `StackBar`、`LayerRow` | |

规则：
- 组件内部只用 Token（`useTokens()`）和 `makeStyles`；不能读 VM、不能 import 业务。
- 组件之间可以组合（`Sheet` 里用 `Button`），但要用代理而不是直接用某个皮肤的实现。
- 每个组件必须有 `accessibilityRole` / `accessibilityLabel` / `accessibilityState`。

## 6. 皮肤机制

### 6.1 定义

```ts
// src/ui/kit/skin.ts
export interface Skin {
  id: 'paper' | 'glass' | string;
  name: string;                         // 「纸感」「苹果风」，显示在 我的 → 外观
  tokens: Record<Scheme, Tokens>;
  icons: IconMap;
  components: Partial<ComponentMap>;    // 不写的用 base
  slots?: Partial<SlotMap>;             // L3，见 §6.3
  navigationTheme(t: Tokens): NavTheme; // 给 react-navigation（标题栏我们自己画，headerShown:false）
  statusBar(t: Tokens): { style: 'light-content'|'dark-content'; background: string };
}
export const defineSkin = (s: Skin) => s;
export const skins = { paper, glass } as const;
```

### 6.2 Provider 与切换

```tsx
<SkinProvider skinId={settings.skin} scheme={settings.scheme /* 'system'|'light'|'dark' */}>
  <NavigationContainer theme={...}>…</NavigationContainer>
</SkinProvider>
```

- `SkinProvider` 解析 `system` 用 `useColorScheme()`；context 值 = `{ skin, tokens }`，`useMemo` 稳定。
- 切换皮肤 / 深浅色：只改 context，**不重建导航树**，当前页面、滚动位置、正在流式的回答都不丢。验收见 07 T2。
- `makeStyles`：

```ts
export const makeStyles = <T extends NamedStyles<T>>(fn: (t: Tokens) => T) =>
  () => { const t = useTokens(); return useMemo(() => StyleSheet.create(fn(t)), [t]); };
```

### 6.3 L3 插槽（V1 只开放这几个）

| 插槽 | 位置 | 默认 | glass V1 |
| --- | --- | --- | --- |
| `ShelfContinueCard` | 书架顶部继续学习卡 | 原型 `.cont` 渐变卡 | 不覆盖（用 Token 改渐变和圆角） |
| `ReviewHero` | 复习页顶部三个数字 + 盒子图 | 原型 `.rvhero` | 不覆盖 |
| `ThreadBackground` | 听讲 thread 底部留白 / 渐隐 | 无 | 覆盖：底部 150dp 留白给悬浮输入区 |

插槽组件的 props 也是 VM 数据，规则同 §5。

## 7. glass 皮肤逐页要点

页面布局和 paper 一样（03 里每页的区域图就是两套皮肤共用的），glass 只在下面这些地方用 iOS 习惯做法：

| 页面 | glass 的做法 |
| --- | --- |
| 全局 | 页面底 `#F2F2F7`；列表是 inset 圆角分组；Tab 栏悬浮毛玻璃；顶栏透明，内容滚到下面时顶栏变毛玻璃 |
| 书架 / 复习 / 笔记 / 我的（根页） | 大标题（34），右上操作是主色图标按钮（没有灰底圆）；书架「＋ 导入」仍在右下（悬浮胶囊按钮），位置不变 |
| 书的地图 | 章是圆角分组卡片，展开 / 收起有弹性动画；小节状态用圆形记号 |
| 听讲 | 顶栏：左「‹ 地图」、中标题、右分段控件「读书 \| 听讲」+ 更多；进度用胶囊步骤条（apple.html `.rail`）；岔路提示条是靛蓝胶囊；AI 讲解 17 号无底；用户消息蓝色气泡（iMessage）；快捷动作和输入框悬浮毛玻璃，底部渐隐 |
| 读书 | 书页是 24 圆角白卡；讲过的段落左侧细线用主色 35%；当前段主色；问答便签是黄色胶囊；段落菜单是 iOS 编辑菜单样式 |
| 原文预览 / 各种浮层 | 悬浮 sheet（左右下 8dp、40 圆角、毛玻璃），按钮竖排全宽，主按钮在上 |
| 本节小结 | 勾选项是圆形勾选框的圆角卡片 |
| 复习闪卡 | 卡片 22 圆角大阴影，点按翻面用 3D 翻转（reduce motion 时淡入）；评分按钮是三个圆角大按钮，颜色仍是忘了红 / 模糊橙 / 记得绿 |
| 我的 | iOS 设置页风格：分组 + 右侧灰色值 + chevron；开关绿色 |
| 对话框 | iOS alert：标题居中、按钮横排细线分隔（两个以上按钮竖排） |

## 8. 质量门槛（自动检查）

1. **对比度测试** `__tests__/ui/contrast.test.ts`：对每个皮肤 × 每个 scheme，检查这些组合 ≥ 4.5（正文）或 ≥ 3（≥ 18dp 粗体 / 图标）：ink/bg、ink/surface、ink2/surface、paperInk/paper、onAccent/accent、accent/surface、detour/detourBg、stuck/stuckBg、ok/surface、bad/badBg、derive/deriveBg、example/exampleBg、pin/pinBg、ink/highlight。半透明色先和下层底色混合再算。
2. **Token 完整性**：类型保证；再加测试遍历所有 key 不为空。
3. **组件契约测试**：对每个皮肤，用同一组 props 渲染每个组件，断言不抛错、可访问性字段存在。
4. **页面快照**：每个页面用 03 里的「示例状态」在 2 皮肤 × 2 scheme 下渲染（react-test-renderer），只断言不抛错和关键文案存在（不做像素快照）。
5. **Lint**：`src/ui/screens/**` 禁止颜色字面量（`react-native/no-color-literals`）、禁止 `fontSize:`/`borderRadius:` 数字字面量（自定义 `no-restricted-syntax` 规则），禁止 import `@ui/skins/*`。

## 9. 皮肤对照页（SkinGallery，仅开发）

`__DEV__` 下在「我的 → 关于」长按版本号进入。内容：
- 顶部切换：皮肤、浅深色、系统字号倍率（1.0 / 1.3 / 2.0 模拟）。
- 所有 kit 组件的各个状态。
- 每个页面的示例状态（用 03 的示例 VM 渲染，不连数据库）。

负责人用它在手机上直接比较两套皮肤，验收 UI。

## 10. 新增一个皮肤的步骤（以后用）

1. 复制 `skins/glass/` 为 `skins/<id>/`，改 `tokens.ts`（light + dark 都要给全）。
2. 决定要覆盖哪些组件，其余删掉用 base。
3. 在 `skins/index.ts` 注册；对比度和契约测试自动覆盖新皮肤。
4. 在 SkinGallery 里逐页检查，对照 §2 的表确认没有改动"必须一样"的部分。
