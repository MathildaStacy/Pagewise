import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { KitProps, RichInline, Tone } from '../contracts';
import { useSkin, useTokens } from '../context';
import { Icon } from '../Icon';
import { makeStyles } from '../makeStyles';
import * as Kit from '../proxy';
import { useMathRenderer, type FormulaRender } from '../MathProvider';

const BookTypography = createContext(false);
const StudyTypography = createContext<
  'source' | 'aux' | 'check' | 'fold' | null
>(null);

function studyType(
  t: ReturnType<typeof useTokens>,
  size: number,
  lineHeight: number,
  fontWeight: '400' | '500' | '600' | '700' = '400',
) {
  const scale = t.type.body.fontSize / (t.layout.groupedLists ? 17 : 14);
  return {
    ...t.type.body,
    fontSize: size * scale,
    lineHeight: lineHeight * scale,
    fontWeight,
  };
}

function Inline({
  nodes,
  onCite,
}: {
  nodes: RichInline[];
  onCite?: KitProps['RichView']['onCite'];
}) {
  const t = useTokens();
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.t) {
          case 'text':
            return <Text key={index}>{node.v}</Text>;
          case 'b':
            return (
              <Text
                key={index}
                style={{ fontWeight: t.type.headline.fontWeight }}
              >
                <Inline nodes={node.c} onCite={onCite} />
              </Text>
            );
          case 'math':
            return <Kit.MathView key={index} tex={node.tex} />;
          case 'cite':
            return (
              <Kit.CiteChip
                key={index}
                label={node.label ?? `b${node.ref}`}
                tone={node.detour ? 'detour' : 'main'}
                verified={node.verified}
                onPress={() => onCite?.(node.ref)}
              />
            );
          case 'unverified':
            return (
              <Text key={index} style={[t.type.micro, { color: t.color.ink2 }]}>
                （未核实）
              </Text>
            );
        }
      })}
    </>
  );
}

export function RichView({
  doc,
  typography,
  onCite,
  onFigure,
}: KitProps['RichView']) {
  const s = useStyles();
  const book = useContext(BookTypography);
  const study = useContext(StudyTypography);
  const textStyle =
    typography === 'dialogQuote'
      ? s.dialogQuoteText
      : typography === 'sheetQuote'
      ? s.sheetQuoteText
      : study === 'source'
      ? s.sourceText
      : study === 'aux'
      ? s.auxText
      : study === 'check'
      ? s.studyBody
      : study === 'fold'
      ? s.foldText
      : book
      ? s.bookText
      : s.aiText;
  return (
    <View
      style={[s.rich, study === 'aux' && s.auxRich]}
      accessibilityRole="none"
      accessibilityLabel="讲解内容"
      accessibilityState={{}}
    >
      {doc.map((block, index) => {
        switch (block.t) {
          case 'p':
            return (
              <Text key={index} style={textStyle}>
                <Inline nodes={block.c} onCite={onCite} />
              </Text>
            );
          case 'math':
            return <Kit.MathView key={index} tex={block.tex} display />;
          case 'code':
            return (
              <ScrollView key={index} horizontal style={s.code}>
                <Text selectable style={s.codeText}>
                  {block.text}
                </Text>
              </ScrollView>
            );
          case 'list':
            return (
              <View key={index} style={s.list}>
                {block.items.map((items, itemIndex) => (
                  <View key={itemIndex} style={s.listItem}>
                    <Text style={textStyle}>
                      {block.ordered ? `${itemIndex + 1}.` : '•'}
                    </Text>
                    <Text style={[textStyle, s.grow]}>
                      <Inline nodes={items} onCite={onCite} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'quote':
            return (
              <Kit.SourceCard
                key={index}
                label={block.label ?? `原文 · b${block.ref}`}
                text={block.text ?? '该引用未核实'}
                onPress={
                  block.verified && onCite ? () => onCite(block.ref) : undefined
                }
              />
            );
          case 'figure':
            return block.uri && block.verified ? (
              <Kit.FigureView
                key={index}
                uri={block.uri}
                caption={block.text ?? block.label ?? `图 b${block.ref}`}
                onPress={onFigure ? () => onFigure(block.ref) : undefined}
              />
            ) : (
              <Kit.Note key={index} tone="neutral">
                该图片未核实
              </Kit.Note>
            );
          case 'aux':
            return (
              <Kit.AuxBlock key={index} kind={block.kind} open={block.open}>
                <Kit.RichView
                  doc={block.body}
                  onCite={onCite}
                  onFigure={onFigure}
                />
              </Kit.AuxBlock>
            );
          case 'check':
            return (
              <Kit.CheckCard key={index}>
                <Text style={s.studyBody}>
                  <Inline nodes={block.c} onCite={onCite} />
                </Text>
              </Kit.CheckCard>
            );
        }
      })}
    </View>
  );
}

export function MathView({
  tex,
  display,
  svg,
  width,
  height,
}: KitProps['MathView']) {
  const s = useStyles();
  const t = useTokens();
  const renderer = useMathRenderer();
  const book = useContext(BookTypography);
  const { fontScale } = useWindowDimensions();
  const [rendered, setRendered] = useState<{
    tex: string;
    display: boolean;
    renderer: typeof renderer;
    value: FormulaRender;
  } | null>(null);
  useEffect(() => {
    if (svg || !renderer) return;
    let active = true;
    const deadline = setTimeout(() => {
      active = false;
      setRendered(null);
    }, 3000);
    renderer
      .render(tex, !!display)
      .then(value => {
        if (active) {
          clearTimeout(deadline);
          setRendered({ tex, display: !!display, renderer, value });
        }
      })
      .catch(() => {
        if (active) {
          clearTimeout(deadline);
          setRendered(null);
        }
      });
    return () => {
      active = false;
      clearTimeout(deadline);
    };
  }, [tex, display, svg, renderer]);
  const result =
    rendered?.tex === tex &&
    rendered.display === !!display &&
    rendered.renderer === renderer
      ? rendered.value
      : null;
  const ex =
    (book ? t.type.bookBody.fontSize : t.type.aiBody.fontSize) *
    fontScale *
    0.5;
  const xml = svg ?? result?.svg;
  const content = xml ? (
    <SvgXml
      xml={xml}
      width={width ?? (result ? result.width * ex : '100%')}
      height={
        height ?? (result ? result.height * ex : t.type.aiBody.lineHeight * 2)
      }
      style={
        !display && result
          ? {
              transform: [
                { translateY: (result.height - result.baseline) * ex },
              ],
            }
          : undefined
      }
      color={t.color.ink}
      accessibilityRole="image"
      accessibilityLabel={tex}
    />
  ) : (
    <Text selectable style={s.mathFallback}>
      {tex}
    </Text>
  );
  return display ? (
    <ScrollView
      horizontal
      contentContainerStyle={s.mathDisplay}
      accessibilityRole="text"
      accessibilityLabel={`公式 ${tex}`}
      accessibilityState={{}}
    >
      {content}
    </ScrollView>
  ) : (
    <Text
      accessibilityRole="text"
      accessibilityLabel={`公式 ${tex}`}
      accessibilityState={{}}
      style={s.mathText}
    >
      {content}
    </Text>
  );
}

export function CiteChip({
  label,
  tone,
  onPress,
  verified = true,
}: KitProps['CiteChip']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={!verified}
      accessibilityRole="link"
      accessibilityLabel={`${label}${verified ? '' : '，未核实'}`}
      accessibilityState={{ disabled: !verified }}
      style={({ pressed }) => [s.chipTarget, pressed && { opacity: 0.7 }]}
    >
      <Text
        style={[
          s.cite,
          {
            backgroundColor:
              tone === 'detour' ? t.color.detourBg : t.color.accentBg,
            color: tone === 'detour' ? t.color.detour : t.color.accentInk,
          },
        ]}
      >
        {label}
        {verified ? '' : ' · 未核实'}
      </Text>
    </Pressable>
  );
}

function FigureImage({ uri, caption }: KitProps['FigureView']) {
  const s = useStyles();
  const [aspectRatio, setAspectRatio] = useState(1);
  return (
    <Image
      source={{ uri }}
      resizeMode="contain"
      onLoad={event => {
        const { width, height } = event.nativeEvent.source;
        if (width > 0 && height > 0) setAspectRatio(width / height);
      }}
      style={[s.figureImage, StyleSheet.create({ root: { aspectRatio } }).root]}
      accessibilityLabel={caption}
    />
  );
}

export function FigureView({ uri, caption, onPress }: KitProps['FigureView']) {
  const s = useStyles();
  const content = (
    <>
      <FigureImage key={uri} uri={uri} caption={caption} />
      <Text style={s.bookCaption}>{caption}</Text>
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      style={s.figure}
      accessibilityRole="button"
      accessibilityLabel={`${caption}，查看大图`}
      accessibilityState={{}}
    >
      {content}
    </Pressable>
  ) : (
    <View style={s.figure}>{content}</View>
  );
}

export function UserBubble({ text, quote, detour }: KitProps['UserBubble']) {
  const s = useStyles();
  const t = useTokens();
  const nested = useContext(StudyTypography) === 'fold';
  return (
    <View
      style={[
        s.user,
        { backgroundColor: detour ? t.color.detour : t.color.accent },
      ]}
      accessibilityRole="text"
      accessibilityLabel={[quote, text].filter(Boolean).join('，')}
      accessibilityState={{}}
    >
      {quote ? <Text style={s.userQuote}>{quote}</Text> : null}
      <Text style={[s.userText, nested && s.foldUserText]}>{text}</Text>
    </View>
  );
}

export function AiMessage({
  streaming,
  detour,
  ...rich
}: KitProps['AiMessage']) {
  const s = useStyles();
  return (
    <View
      style={[s.message, detour && s.detourMessage]}
      accessibilityRole="none"
      accessibilityLabel={detour ? '岔路讲解' : '讲解'}
      accessibilityState={{ busy: !!streaming }}
    >
      <Kit.RichView {...rich} />
      {streaming ? <Kit.Typing label="正在生成讲解" /> : null}
    </View>
  );
}

export function ToolSteps({ lines, detour }: KitProps['ToolSteps']) {
  const s = useStyles();
  return (
    <View
      style={s.tools}
      accessibilityRole="none"
      accessibilityLabel="工具执行步骤"
      accessibilityState={{ busy: lines.some(line => line.running) }}
    >
      {lines.map((line, index) => (
        <ToolLine key={index} line={line} detour={detour} />
      ))}
    </View>
  );
}

function ToolLine({
  line,
  detour,
}: {
  line: KitProps['ToolSteps']['lines'][number];
  detour?: boolean;
}) {
  const s = useStyles();
  const { tokens: t, reduceMotion } = useSkin();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    opacity.setValue(1);
    if (!line.running || !t.layout.groupedLists || reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [line.running, opacity, reduceMotion, t.layout.groupedLists]);
  return (
    <Animated.View style={[s.toolLine, { opacity }]}>
      {t.layout.groupedLists ? (
        <Icon
          name="book"
          size={16}
          color={detour ? t.color.detour : t.color.ink2}
        />
      ) : (
        <View
          style={[s.toolDot, detour && { backgroundColor: t.color.detour }]}
        />
      )}
      <Text
        style={[
          s.toolText,
          s.grow,
          !t.layout.groupedLists && line.running && { color: t.color.ink3 },
        ]}
      >
        {line.text}
      </Text>
    </Animated.View>
  );
}

export function StepHeader({
  step,
  label,
  title,
  pages,
}: KitProps['StepHeader']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.stepHeader}
      accessibilityRole="header"
      accessibilityLabel={`${label}，第 ${step} 步，${title}，${pages}`}
      accessibilityState={{}}
    >
      {t.layout.groupedLists ? (
        <Text style={s.stepNumber}>第 {step} 步</Text>
      ) : null}
      <Text style={[s.stepTitle, s.grow]}>{title}</Text>
      <Text style={s.stepPages}>{pages}</Text>
    </View>
  );
}

export function SourceCard({
  label,
  doc,
  text,
  onPress,
}: KitProps['SourceCard']) {
  const s = useStyles();
  const body = (
    <>
      <View style={s.studyLabel}>
        <Icon name="book" size={15} />
        <Text style={s.studyLabelText}>{label}</Text>
      </View>
      {doc ? (
        <BookTypography.Provider value>
          <StudyTypography.Provider value="source">
            <Kit.RichView doc={doc} />
          </StudyTypography.Provider>
        </BookTypography.Provider>
      ) : (
        <Text style={s.sourceText}>{text}</Text>
      )}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.source,
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}，打开原文`}
      accessibilityState={{}}
    >
      {body}
    </Pressable>
  ) : (
    <View
      style={s.source}
      accessibilityRole="none"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      {body}
    </View>
  );
}

export function AuxBlock({
  kind,
  children,
  open = true,
}: KitProps['AuxBlock']) {
  const s = useStyles();
  const t = useTokens();
  const [expanded, setExpanded] = useState(open);
  const color = kind === 'derive' ? t.color.derive : t.color.example;
  useEffect(() => setExpanded(open), [open]);
  const label = kind === 'derive' ? '补充推导' : 'AI 举例';
  return (
    <View
      style={[
        s.aux,
        {
          backgroundColor:
            kind === 'derive' ? t.color.deriveBg : t.color.exampleBg,
        },
      ]}
      accessibilityRole="none"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? '收起' : '展开'}${label}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        hitSlop={12}
        style={s.studyLabel}
      >
        <Icon
          name={kind === 'derive' ? 'derive' : 'spark'}
          size={15}
          color={color}
        />
        <Text style={[s.studyLabelText, { color }]}>{label}</Text>
      </Pressable>
      {expanded ? (
        <StudyTypography.Provider value="aux">
          {children}
        </StudyTypography.Provider>
      ) : null}
    </View>
  );
}

export function CheckCard({ children, text }: KitProps['CheckCard']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.studyCard}
      accessibilityRole="none"
      accessibilityLabel="检查一下"
      accessibilityState={{}}
    >
      <View style={s.studyLabel}>
        {t.layout.groupedLists ? (
          <Icon name="help" size={15} color={t.color.accent} />
        ) : null}
        <Text style={[s.studyLabelText, { color: t.color.accent }]}>
          检查一下
        </Text>
      </View>
      <StudyTypography.Provider value="check">
        {children ?? <Text style={s.studyBody}>{text}</Text>}
      </StudyTypography.Provider>
    </View>
  );
}

function Actions({
  items,
  onAction,
}: {
  items: { key: string; label: string; primary?: boolean }[];
  onAction(key: string): void;
}) {
  const s = useStyles();
  const t = useTokens();
  if (!items.length) return null;
  return (
    <View style={s.actions}>
      {items.map(item => (
        <Kit.Button
          key={item.key}
          size="sm"
          variant={
            item.primary
              ? 'primary'
              : t.layout.groupedLists
              ? 'secondary'
              : 'ghost'
          }
          label={item.label}
          onPress={() => onAction(item.key)}
        />
      ))}
    </View>
  );
}

export function ResumeCard({
  title,
  lines,
  actions,
  onAction,
}: KitProps['ResumeCard']) {
  const s = useStyles();
  const t = useTokens();
  const displayTitle = t.layout.groupedLists
    ? title.replace(/^续学(?=\s*·)/, '接着上次')
    : title.replace(/^接着上次(?=\s*·)/, '续学');
  return (
    <View
      style={s.studyCard}
      accessibilityRole="none"
      accessibilityLabel={displayTitle}
      accessibilityState={{}}
    >
      <View style={s.studyLabel}>
        {t.layout.groupedLists ? (
          <Icon name="clock" size={15} color={t.color.accent} />
        ) : null}
        <Text style={s.resumeLabel}>{displayTitle}</Text>
      </View>
      {lines.map((line, index) => (
        <Text key={index} style={s.resumeBody}>
          {line}
        </Text>
      ))}
      <Actions items={actions} onAction={onAction} />
    </View>
  );
}

export function FoldCard({
  title,
  count,
  expanded,
  onToggle,
  children,
}: KitProps['FoldCard']) {
  const s = useStyles();
  const t = useTokens();
  const history = !count;
  return (
    <View
      style={history ? s.history : s.fold}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{ expanded }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={history ? title : `${title}，${count}`}
        accessibilityState={{ expanded }}
        hitSlop={history ? 10 : undefined}
        style={({ pressed }) => [
          history ? s.historyHeader : s.foldHeader,
          pressed && { opacity: 0.6 },
        ]}
      >
        {!history ? (
          <View style={s.foldCheck}>
            <Icon
              name="check"
              color={t.layout.groupedLists ? t.color.onAccent : t.color.ok}
              size={14}
            />
          </View>
        ) : null}
        <Text
          numberOfLines={1}
          style={history ? s.historyLabel : [s.foldTitle, s.grow]}
        >
          {title}
        </Text>
        {!history ? <Text style={s.foldCount}>{count}</Text> : null}
        <View
          style={{
            transform: [
              {
                rotate: history
                  ? expanded
                    ? '270deg'
                    : '90deg'
                  : expanded
                  ? '90deg'
                  : '0deg',
              },
            ],
          }}
        >
          <Icon name="chev" size={history ? 14 : 16} color={t.color.ink3} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={history ? s.historyBody : s.foldBody}>
          <StudyTypography.Provider value={history ? null : 'fold'}>
            {children}
          </StudyTypography.Provider>
        </View>
      ) : null}
    </View>
  );
}

export function QuizCard({
  title,
  question,
  options,
  locked,
  onPick,
}: KitProps['QuizCard']) {
  const s = useStyles();
  const t = useTokens();
  const displayTitle = title
    .replace(
      /^(检查一下|考考你)/,
      t.layout.groupedLists ? '考考你' : '检查一下',
    )
    .replace(
      /第\s*(\d+)\s*[步段]/g,
      `第 $1 ${t.layout.groupedLists ? '步' : '段'}`,
    );
  return (
    <View
      style={s.studyCard}
      accessibilityRole="none"
      accessibilityLabel={displayTitle}
      accessibilityState={{}}
    >
      <View style={s.studyLabel}>
        {t.layout.groupedLists ? (
          <Icon name="help" size={15} color={t.color.accent} />
        ) : null}
        <Text style={[s.studyLabelText, s.quizLabel]}>{displayTitle}</Text>
      </View>
      <Text style={s.quizQuestion}>{question}</Text>
      {options.map((option, index) => {
        const color =
          option.state === 'right'
            ? t.color.ok
            : option.state === 'wrong'
            ? t.color.bad
            : t.color.ink2;
        return (
          <Pressable
            key={index}
            disabled={locked}
            onPress={() => onPick(index)}
            accessibilityRole="button"
            accessibilityLabel={`${String.fromCharCode(65 + index)}：${
              option.label
            }${
              option.state === 'right'
                ? '，正确'
                : option.state === 'wrong'
                ? '，错误'
                : ''
            }`}
            accessibilityState={{
              disabled: locked,
              selected: option.state === 'right' || option.state === 'wrong',
            }}
            style={({ pressed }) => [
              s.option,
              {
                borderColor:
                  option.state === 'right' || option.state === 'wrong'
                    ? color
                    : t.color.line,
                backgroundColor:
                  option.state === 'right'
                    ? t.color.okBg
                    : option.state === 'wrong'
                    ? t.color.badBg
                    : t.layout.groupedLists
                    ? t.color.surfaceFill
                    : t.color.surface,
              },
              option.state === 'muted' &&
                t.layout.groupedLists && { opacity: 0.5 },
              pressed && !locked && { transform: [{ scale: 0.985 }] },
            ]}
          >
            {t.layout.groupedLists ? (
              <View
                style={[
                  s.optionBadge,
                  (option.state === 'right' || option.state === 'wrong') && {
                    backgroundColor: color,
                  },
                ]}
              >
                {option.state === 'right' || option.state === 'wrong' ? (
                  <Icon
                    name={option.state === 'right' ? 'check' : 'close'}
                    color={t.color.onAccent}
                    size={14}
                  />
                ) : (
                  <Text style={s.optionLetter}>
                    {String.fromCharCode(65 + index)}
                  </Text>
                )}
              </View>
            ) : null}
            <Text style={[s.optionText, s.grow]}>
              {t.layout.groupedLists
                ? ''
                : `${String.fromCharCode(65 + index)}. `}
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProposalCard({
  title,
  body,
  state,
  resultText,
  actions,
  onAction,
}: KitProps['ProposalCard']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={[s.studyCard, s.proposal]}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{}}
    >
      <View style={s.studyLabel}>
        {t.layout.groupedLists ? (
          <Icon name="flag" size={15} color={t.color.stuckInk} />
        ) : null}
        <Text style={[s.studyLabelText, s.proposalLabel]}>{title}</Text>
      </View>
      <Text style={s.proposalBody}>{body}</Text>
      {state === 'pending' ? (
        <Actions
          items={actions.map((action, index) => ({
            ...action,
            primary: index === 0,
          }))}
          onAction={onAction}
        />
      ) : (
        <Text style={s.proposalResult}>
          {resultText ?? (state === 'accepted' ? '已记下' : '已忽略')}
        </Text>
      )}
    </View>
  );
}

export function DoneCard({ title, text, onPress }: KitProps['DoneCard']) {
  const s = useStyles();
  const t = useTokens();
  const displayTitle =
    t.layout.groupedLists && /^(这一节|本节)(讲|学)完了$/.test(title)
      ? '本节讲完了'
      : title;
  const content = (
    <>
      <View style={s.studyLabel}>
        <Icon name="check" color={t.color.okInk} size={15} />
        <Text style={[s.studyLabelText, { color: t.color.okInk }]}>
          {displayTitle}
        </Text>
      </View>
      <Text style={s.studyBody}>{text}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [s.studyCard, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={`${displayTitle}，查看本节小结`}
        accessibilityState={{}}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View
      style={s.studyCard}
      accessibilityRole="none"
      accessibilityLabel={displayTitle}
      accessibilityState={{}}
    >
      {content}
    </View>
  );
}

export function SysDivider({ text, tone }: KitProps['SysDivider']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={[
        s.divider,
        t.layout.groupedLists &&
          tone === 'detour' && { backgroundColor: t.color.detourBg },
      ]}
      accessibilityRole="text"
      accessibilityLabel={text}
      accessibilityState={{}}
    >
      {!t.layout.groupedLists ? (
        <View style={[s.line, tone === 'detour' && s.detourDividerLine]} />
      ) : null}
      <Text
        style={[s.dividerText, tone === 'detour' && { color: t.color.detour }]}
      >
        {text}
      </Text>
      {!t.layout.groupedLists ? (
        <View style={[s.line, tone === 'detour' && s.detourDividerLine]} />
      ) : null}
    </View>
  );
}

export function Typing({ label = '正在生成' }: KitProps['Typing']) {
  const s = useStyles();
  return (
    <View
      style={s.typing}
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      {[0, 1, 2].map(index => (
        <TypingDot key={index} index={index} />
      ))}
    </View>
  );
}

function TypingDot({ index }: { index: number }) {
  const s = useStyles();
  const { reduceMotion } = useSkin();
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    opacity.setValue(0.3);
    if (reduceMotion) return;
    const animation = Animated.sequence([
      Animated.delay(index * 180),
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 440,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 440,
            useNativeDriver: true,
          }),
          Animated.delay(220),
        ]),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [index, opacity, reduceMotion]);
  return <Animated.View style={[s.typingDot, { opacity }]} />;
}

export { PageOrig } from './PageOrig';

function accessibleDocText(doc: KitProps['RichView']['doc']): string {
  const inline = (nodes: RichInline[]): string =>
    nodes
      .map(node => {
        switch (node.t) {
          case 'text':
            return node.v;
          case 'b':
            return inline(node.c);
          case 'math':
            return node.tex;
          case 'cite':
            return node.label ?? `引用 ${node.ref}`;
          case 'unverified':
            return '未核实';
        }
      })
      .join('');
  return doc
    .map(block => {
      switch (block.t) {
        case 'p':
        case 'check':
          return inline(block.c);
        case 'math':
          return block.tex;
        case 'code':
          return block.text;
        case 'list':
          return block.items.map(inline).join('，');
        case 'aux':
          return accessibleDocText(block.body);
        case 'quote':
        case 'figure':
          return block.text ?? block.label ?? `图 ${block.ref}`;
      }
    })
    .filter(Boolean)
    .join('，');
}

export function BlockView({
  doc,
  text,
  current,
  done,
  highlighted,
  onPress,
  children,
}: KitProps['BlockView']) {
  const s = useStyles();
  const t = useTokens();
  const content = (
    <>
      {t.layout.groupedLists && (current || done) ? (
        <View
          pointerEvents="none"
          style={
            StyleSheet.create({
              mark: {
                position: 'absolute',
                left: -3,
                top: 8,
                bottom: 8,
                width: 3,
                borderRadius: 2,
                backgroundColor: t.color.accent,
                opacity: current ? 1 : 0.35,
              },
            }).mark
          }
        />
      ) : null}
      {doc ? (
        <BookTypography.Provider value>
          <Kit.RichView doc={doc} />
        </BookTypography.Provider>
      ) : text ? (
        <Text style={s.bookText}>{text}</Text>
      ) : null}
      {children}
    </>
  );
  const style = [
    s.block,
    highlighted && { backgroundColor: t.color.highlight },
    (current || done) &&
      !t.layout.groupedLists && {
        borderLeftWidth: current ? 3 : 2,
        borderLeftColor: current ? t.color.accent : t.color.stepCur,
      },
  ];
  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        ...style,
        pressed && { backgroundColor: t.color.accentBg },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${
        current ? '当前段落，' : done ? '讲过的段落，' : ''
      }${(text ?? (doc ? accessibleDocText(doc) : '')) || '原文段落'}`}
      accessibilityState={{ selected: !!current }}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={style}
      accessibilityRole="none"
      accessibilityLabel={
        (text ?? (doc ? accessibleDocText(doc) : '')) || '原文段落'
      }
      accessibilityState={{ selected: !!current }}
    >
      {content}
    </View>
  );
}

export function PinChip({ label, onPress }: KitProps['PinChip']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={s.pin}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      <Icon name="pin" color={t.color.pin} size={16} />
      <Text style={[s.caption, { color: t.color.pin }]}>{label}</Text>
    </Pressable>
  );
}

export function GuideBar({
  title,
  body,
  expanded,
  onToggle,
}: KitProps['GuideBar']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.card}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{ expanded }}
    >
      <Pressable
        onPress={onToggle}
        style={s.cardHeader}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? '收起' : '展开'}${title}`}
        accessibilityState={{ expanded }}
      >
        <Icon name="bookOpen" color={t.color.accent} size={16} />
        <Text style={[s.label, s.grow, { color: t.color.accentInk }]}>
          {title}
        </Text>
        <Icon name={expanded ? 'arrowDown' : 'chev'} size={16} />
      </Pressable>
      {expanded && body ? <Text style={s.body}>{body}</Text> : null}
    </View>
  );
}

export function ReadEnd({ label, hint, onPress }: KitProps['ReadEnd']) {
  const s = useStyles();
  return (
    <View
      style={s.readEnd}
      accessibilityRole="none"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      <Kit.Button variant="primary" label={label} onPress={onPress} />
      {hint ? <Text style={s.readEndHint}>{hint}</Text> : null}
    </View>
  );
}

export function FlashCard({
  front,
  back,
  flipped,
  onFlip,
}: KitProps['FlashCard']) {
  const s = useStyles();
  const t = useTokens();
  const { reduceMotion: reduced } = useSkin();
  const progress = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) fade.setValue(0);
    const animation = Animated.timing(reduced ? fade : progress, {
      toValue: reduced ? 1 : flipped ? 1 : 0,
      duration: reduced ? t.motion.fast : t.motion.normal,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [flipped, progress, fade, reduced, t.motion.fast, t.motion.normal]);
  return (
    <Pressable
      onPress={onFlip}
      accessibilityRole="button"
      accessibilityLabel={`${flipped ? '答案' : '问题'}：${
        flipped ? back : front
      }，点按翻面`}
      accessibilityState={{ expanded: flipped }}
      style={s.flashTarget}
    >
      <Animated.View
        style={[
          s.flash,
          reduced
            ? { opacity: fade }
            : {
                transform: [
                  { perspective: 1000 },
                  {
                    rotateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                ],
              },
        ]}
      >
        <View
          style={
            !reduced && flipped
              ? { transform: [{ rotateY: '180deg' }] }
              : undefined
          }
        >
          <Text style={s.caption}>{flipped ? '答案' : '问题'}</Text>
          <Text style={s.flashText}>{flipped ? back : front}</Text>
          <Text style={s.caption}>点按翻面</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function RateBar({ onRate, disabled }: KitProps['RateBar']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.ratings}
      accessibilityRole="none"
      accessibilityLabel="回忆评分"
      accessibilityState={{ disabled: !!disabled }}
    >
      {(
        [
          { key: 'again', label: '忘了', color: t.color.badInk },
          { key: 'hard', label: '模糊', color: t.color.stuckInk },
          { key: 'good', label: '记得', color: t.color.ink },
        ] as const
      ).map(item => (
        <Pressable
          key={item.key}
          onPress={() => onRate(item.key)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ disabled: !!disabled }}
          style={({ pressed }) => [
            s.rating,
            pressed && { backgroundColor: t.color.pressed },
            disabled && { opacity: 0.45 },
          ]}
        >
          <Text style={[s.label, { color: item.color }]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function BoxChart({ boxes }: KitProps['BoxChart']) {
  const s = useStyles();
  const t = useTokens();
  const largest = Math.max(1, ...boxes);
  return (
    <View
      style={s.boxes}
      accessibilityRole="image"
      accessibilityLabel={`卡片盒子，${boxes
        .map((count, index) => `第 ${index + 1} 盒 ${count} 张`)
        .join('，')}`}
      accessibilityState={{}}
    >
      {boxes.map((count, index) => (
        <View key={index} style={s.boxColumn}>
          <View style={s.boxCell}>
            <View
              style={[
                s.boxFill,
                { height: `${(Math.max(0, count) / largest) * 100}%` },
              ]}
            />
            <Text style={[s.body, t.type.num]}>{count}</Text>
          </View>
          <Text style={s.caption}>{index + 1} 盒</Text>
        </View>
      ))}
    </View>
  );
}

function layerColor(t: ReturnType<typeof useTokens>, tone?: Tone) {
  switch (tone) {
    case 'detour':
      return t.color.detour;
    case 'stuck':
    case 'warn':
      return t.color.stuck;
    case 'ok':
      return t.color.ok;
    case 'bad':
      return t.color.bad;
    case 'derive':
      return t.color.derive;
    case 'example':
      return t.color.example;
    case 'pin':
      return t.color.pin;
    case 'muted':
      return t.color.ink3;
    default:
      return t.color.accent;
  }
}

export function StackBar({ layers }: KitProps['StackBar']) {
  const s = useStyles();
  const t = useTokens();
  const total = layers.reduce(
    (sum, layer) => sum + Math.max(0, layer.value),
    0,
  );
  return (
    <View
      style={s.stack}
      accessibilityRole="image"
      accessibilityLabel={`上下文分层，共 ${total} tokens`}
      accessibilityState={{}}
    >
      {layers.map((layer, index) => (
        <View
          key={index}
          style={{
            flex: Math.max(0, layer.value),
            backgroundColor: layerColor(t, layer.tone),
          }}
        />
      ))}
    </View>
  );
}

export function LayerRow({
  name,
  detail,
  tokens,
  cached,
  color,
}: KitProps['LayerRow']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.layer}
      accessibilityRole="text"
      accessibilityLabel={`${name}，${detail}，${tokens} tokens${
        cached ? '，可缓存' : ''
      }`}
      accessibilityState={{}}
    >
      <View
        style={[s.layerDot, { backgroundColor: color ?? t.color.accent }]}
      />
      <View style={s.grow}>
        <Text style={s.body}>{name}</Text>
        <Text style={s.caption}>{detail}</Text>
      </View>
      {cached ? <Icon name="check" size={14} color={t.color.ok} /> : null}
      <Text style={[s.caption, t.type.num]}>{tokens}</Text>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  rich: { gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { ...t.type.body, color: t.color.ink },
  label: { ...t.type.label, color: t.color.ink },
  headline: { ...t.type.headline, color: t.color.ink },
  caption: { ...t.type.caption, color: t.color.ink2 },
  aiText: { ...t.type.aiBody, color: t.color.ink },
  bookText: { ...t.type.bookBody, color: t.color.paperInk },
  dialogQuoteText: {
    ...studyType(t, 13, 23.4),
    fontFamily: t.type.serifFamily,
    color: t.color.ink2,
  },
  sheetQuoteText: {
    ...studyType(
      t,
      t.layout.groupedLists ? 15 : 13,
      t.layout.groupedLists ? 27 : 23.4,
    ),
    fontFamily: t.type.serifFamily,
    color: t.color.ink2,
  },
  bookCaption: {
    ...t.type.caption,
    fontFamily: t.type.serifFamily,
    color: t.color.ink2,
  },
  codeText: { ...t.type.body, ...t.type.num, color: t.color.ink },
  code: {
    padding: 10,
    backgroundColor: t.color.surfaceAlt,
    borderRadius: t.shape.sm,
  },
  list: { gap: 4 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 8,
  },
  mathText: { ...t.type.aiBody, ...t.type.num, color: t.color.ink },
  mathFallback: {
    ...t.type.aiBody,
    fontFamily: 'monospace',
    color: t.color.ink2,
  },
  mathDisplay: {
    minWidth: '100%',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  chipTarget: {
    minHeight: 21,
    minWidth: 19,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  cite: {
    ...t.type.micro,
    ...t.type.num,
    borderRadius: t.shape.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  figure: {
    paddingHorizontal: t.layout.groupedLists ? 0 : 8,
    paddingVertical: t.layout.groupedLists ? 4 : 8,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    borderRadius: t.shape.md,
    backgroundColor: t.layout.groupedLists ? 'transparent' : t.color.paper,
    gap: 6,
  },
  figureImage: { width: '100%' },
  user: {
    alignSelf: 'flex-end',
    maxWidth: t.layout.groupedLists ? '80%' : '84%',
    paddingVertical: 9,
    paddingHorizontal: t.layout.groupedLists ? 15 : 12,
    borderRadius: t.layout.groupedLists ? 21 : 16,
    borderBottomRightRadius: t.layout.groupedLists ? 21 : 4,
  },
  userText: {
    ...studyType(t, t.layout.groupedLists ? 16 : 15, 24),
    color: t.color.onAccent,
  },
  foldUserText: {
    ...studyType(t, 15, t.layout.groupedLists ? 22.5 : 24),
  },
  userQuote: {
    ...studyType(
      t,
      t.layout.groupedLists ? 13 : 12,
      t.layout.groupedLists ? 19.5 : 19.2,
    ),
    color: t.color.onAccent,
    borderLeftWidth: 2,
    borderLeftColor: t.color.onAccent,
    paddingLeft: t.layout.groupedLists ? 7 : 6,
    marginTop: t.layout.groupedLists ? 2 : 0,
    marginBottom: t.layout.groupedLists ? 5 : 4,
    opacity: 0.85,
  },
  detourMessage: {
    borderLeftWidth: 3,
    borderLeftColor: t.color.detour,
    paddingLeft: 10,
  },
  proposal: {
    borderStyle: 'dashed',
    borderWidth: t.layout.groupedLists ? 1.5 : 1,
    borderColor: t.color.proposalBorder,
    borderRadius: t.layout.groupedLists ? 20 : 12,
    paddingTop: t.layout.groupedLists ? 13 : 10,
    paddingBottom: t.layout.groupedLists ? 14 : 10,
    paddingHorizontal: t.layout.groupedLists ? 16 : 12,
    backgroundColor: t.layout.groupedLists ? t.color.stuckBg : t.color.surface,
  },
  proposalLabel: {
    color: t.layout.groupedLists ? t.color.stuckInk : t.color.accent,
  },
  proposalBody: {
    ...studyType(
      t,
      t.layout.groupedLists ? 16 : 13,
      t.layout.groupedLists ? 25.6 : 19.5,
    ),
    color: t.color.ink,
  },
  proposalResult: {
    ...studyType(
      t,
      t.layout.groupedLists ? 13 : 12,
      t.layout.groupedLists ? 18.85 : 18,
    ),
    marginTop: t.layout.groupedLists ? 10 : 8,
    color: t.color.ink2,
  },
  message: { gap: 8 },
  tools: { gap: 3 },
  toolLine: {
    flexDirection: 'row',
    alignItems: t.layout.groupedLists ? 'center' : 'flex-start',
    gap: 6,
  },
  toolDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: t.color.ink3,
  },
  toolText: {
    ...studyType(
      t,
      t.layout.groupedLists ? 13 : 12,
      t.layout.groupedLists ? 18.85 : 18,
    ),
    color: t.color.ink2,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: t.layout.groupedLists ? 14 : 0,
  },
  stepNumber: {
    ...studyType(t, 13, 18.85, '600'),
    ...t.type.num,
    color: t.color.accent,
    flexShrink: 0,
  },
  stepTitle: {
    ...studyType(
      t,
      t.layout.groupedLists ? 21 : 15,
      t.layout.groupedLists ? 27.3 : 22.5,
      t.layout.groupedLists ? '700' : '600',
    ),
    color: t.color.ink,
    letterSpacing: t.layout.groupedLists ? -0.21 : 0,
  },
  stepPages: {
    ...studyType(
      t,
      t.layout.groupedLists ? 13 : 12,
      t.layout.groupedLists ? 18.85 : 18,
    ),
    color: t.color.ink2,
    flexShrink: 0,
  },
  studyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: t.layout.groupedLists ? 5 : 4,
  },
  studyLabelText: {
    ...studyType(t, 12, t.layout.groupedLists ? 17.4 : 18, '600'),
    color: t.color.ink2,
    flexShrink: 1,
  },
  studyBody: {
    ...studyType(
      t,
      t.layout.groupedLists ? 16 : 14,
      t.layout.groupedLists ? 25.6 : 23.8,
    ),
    color: t.color.ink,
  },
  studyCard: {
    paddingTop: t.layout.groupedLists ? 13 : 12,
    paddingBottom: t.layout.groupedLists ? 14 : 12,
    paddingHorizontal: t.layout.groupedLists ? 16 : 14,
    borderRadius: t.layout.groupedLists ? 20 : 14,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    backgroundColor: t.color.surface,
  },
  resumeLabel: {
    ...studyType(
      t,
      12,
      t.layout.groupedLists ? 17.4 : 18,
      t.layout.groupedLists ? '600' : '400',
    ),
    color: t.layout.groupedLists ? t.color.accent : t.color.ink3,
    flexShrink: 1,
  },
  resumeBody: {
    ...studyType(
      t,
      t.layout.groupedLists ? 16 : 14,
      t.layout.groupedLists ? 25.6 : 23.8,
    ),
    color: t.color.ink,
    marginBottom: 6,
  },
  source: {
    backgroundColor: t.layout.groupedLists ? t.color.surface : t.color.paper,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    borderRadius: t.layout.groupedLists ? 20 : 12,
    paddingTop: t.layout.groupedLists ? 13 : 10,
    paddingBottom: t.layout.groupedLists ? 14 : 10,
    paddingHorizontal: t.layout.groupedLists ? 16 : 12,
  },
  sourceText: {
    ...studyType(
      t,
      t.layout.groupedLists ? 16 : 15,
      t.layout.groupedLists ? 28 : 27,
    ),
    fontFamily: t.type.serifFamily,
    color: t.color.paperInk,
  },
  aux: {
    borderRadius: t.layout.groupedLists ? 20 : 12,
    paddingTop: 12,
    paddingBottom: t.layout.groupedLists ? 13 : 12,
    paddingHorizontal: t.layout.groupedLists ? 16 : 14,
  },
  auxText: {
    ...studyType(t, 16, t.layout.groupedLists ? 25.92 : 28.48),
    color: t.color.ink,
  },
  auxRich: { gap: 8 },
  card: {
    paddingVertical: t.layout.groupedLists ? 13 : 12,
    paddingHorizontal: t.layout.groupedLists ? 16 : 14,
    borderRadius: t.layout.groupedLists ? 20 : 14,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    backgroundColor: t.color.surface,
    gap: 8,
  },
  cardHeader: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: t.layout.groupedLists ? 10 : 8,
  },
  fold: {
    backgroundColor: t.color.surface,
    borderRadius: t.layout.groupedLists ? 20 : 12,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    overflow: 'hidden',
  },
  foldHeader: {
    minHeight: t.layout.groupedLists ? 52 : 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
  foldCheck: {
    width: t.layout.groupedLists ? 22 : 18,
    height: t.layout.groupedLists ? 22 : 18,
    borderRadius: t.layout.groupedLists ? 11 : 9,
    backgroundColor: t.layout.groupedLists ? t.color.ok : undefined,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foldTitle: {
    ...studyType(
      t,
      t.layout.groupedLists ? 15 : 14,
      t.layout.groupedLists ? 21.75 : 21,
    ),
    color: t.color.ink,
  },
  foldCount: {
    ...studyType(
      t,
      t.layout.groupedLists ? 13 : 12,
      t.layout.groupedLists ? 18.85 : 18,
    ),
    color: t.color.ink2,
  },
  foldText: {
    ...studyType(t, 15, t.layout.groupedLists ? 24.75 : 26.7),
    color: t.color.ink,
  },
  foldBody: {
    paddingTop: 12,
    paddingHorizontal: t.layout.groupedLists ? 16 : 14,
    paddingBottom: t.layout.groupedLists ? 16 : 14,
    borderTopWidth: t.layout.groupedLists ? 0.5 : 1,
    borderTopColor: t.color.line,
    gap: 10,
  },
  history: { alignSelf: 'stretch' },
  historyHeader: {
    alignSelf: 'center',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: t.layout.groupedLists ? 6 : 4,
    paddingHorizontal: t.layout.groupedLists ? 14 : 12,
    borderRadius: t.layout.groupedLists ? 16 : 14,
    backgroundColor: t.color.surface,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
  },
  historyLabel: {
    ...studyType(
      t,
      t.layout.groupedLists ? 13 : 12,
      t.layout.groupedLists ? 18.85 : 18,
    ),
    color: t.color.ink2,
    flexShrink: 1,
  },
  historyBody: { marginTop: 12, gap: 12 },
  quizLabel: { color: t.color.accent },
  quizQuestion: {
    ...studyType(
      t,
      t.layout.groupedLists ? 16 : 15,
      t.layout.groupedLists ? 24.8 : 24,
      '600',
    ),
    color: t.color.ink,
    marginBottom: 10,
  },
  option: {
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderRadius: t.layout.groupedLists ? 16 : 10,
    paddingVertical: t.layout.groupedLists ? 11 : 9,
    paddingHorizontal: t.layout.groupedLists ? 14 : 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: t.layout.groupedLists ? 7 : 6,
  },
  optionText: {
    ...studyType(
      t,
      t.layout.groupedLists ? 15 : 14,
      t.layout.groupedLists ? 21.75 : 21,
    ),
    color: t.color.ink,
  },
  optionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetter: {
    ...studyType(t, 13, 18.85, '600'),
    ...t.type.num,
    color: t.color.ink2,
  },
  typing: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.color.ink3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: t.layout.groupedLists ? 'center' : 'stretch',
    maxWidth: '100%',
    borderRadius: t.layout.groupedLists ? 12 : 0,
    backgroundColor: t.layout.groupedLists ? t.color.surfaceFill : undefined,
    paddingVertical: t.layout.groupedLists ? 3 : 0,
    paddingHorizontal: t.layout.groupedLists ? 10 : 0,
    marginVertical: t.layout.groupedLists ? 4 : 0,
  },
  dividerText: {
    ...studyType(t, 12, t.layout.groupedLists ? 17.4 : 18),
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
    textAlign: t.layout.groupedLists ? 'center' : 'left',
    flexShrink: 1,
  },
  detourDividerLine: {
    backgroundColor: t.scheme === 'light' ? '#E3D8F3' : t.color.detourBg,
  },
  line: { height: 1, flex: 1, backgroundColor: t.color.line },
  pageHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.4,
  },
  pageBlock: { position: 'absolute' },
  pageCurrent: { borderLeftWidth: 3 },
  pageDone: { borderLeftWidth: 2 },
  page: {
    width: '100%',
    backgroundColor: t.color.paper,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.shape.xs,
  },
  pageImage: { position: 'absolute', width: '100%', height: '100%' },
  pagePin: {
    alignSelf: 'flex-end',
    backgroundColor: t.color.pinBg,
    borderRadius: t.shape.pill,
    padding: 4,
  },
  block: {
    paddingVertical: t.layout.groupedLists ? 3 : 2,
    paddingHorizontal: t.layout.groupedLists ? 10 : 4,
    borderRadius: t.layout.groupedLists ? 12 : 3,
    minHeight: 0,
  },
  pin: {
    minHeight: 0,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.pinBg,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  readEnd: {
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: t.layout.groupedLists ? 8 : 22,
    alignItems: 'center',
    gap: 8,
  },
  readEndHint: {
    ...t.type.caption,
    fontSize: t.type.caption.fontSize * (t.layout.groupedLists ? 12 / 13 : 1),
    lineHeight:
      t.type.caption.lineHeight * (t.layout.groupedLists ? 12 / 13 : 1),
    color: t.color.ink2,
    textAlign: 'center',
  },
  flashTarget: { minHeight: 300 },
  flash: {
    minHeight: 300,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: t.shape.xl,
    backgroundColor: t.color.surface,
    ...t.elevation.card,
    justifyContent: 'center',
  },
  flashText: { ...t.type.headline, color: t.color.ink, paddingVertical: 26 },
  ratings: { flexDirection: 'row', gap: 8 },
  rating: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: t.color.line,
    borderRadius: t.shape.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surface,
  },
  boxes: { flexDirection: 'row', gap: 6 },
  boxColumn: { flex: 1, gap: 4, alignItems: 'center' },
  boxCell: {
    minHeight: 48,
    alignSelf: 'stretch',
    backgroundColor: t.color.surfaceAlt,
    borderRadius: t.shape.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: t.color.stepCur,
  },
  stack: {
    height: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: t.shape.sm,
    backgroundColor: t.color.surfaceAlt,
  },
  layer: {
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  layerDot: { width: 10, height: 10, borderRadius: t.shape.xs },
}));
