import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { KitProps, RichInline, Tone } from '../contracts';
import { useSkin, useTokens } from '../context';
import { Icon } from '../Icon';
import { makeStyles } from '../makeStyles';
import * as Kit from '../proxy';

const BookTypography = createContext(false);

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

export function RichView({ doc, onCite, onFigure }: KitProps['RichView']) {
  const s = useStyles();
  const book = useContext(BookTypography);
  return (
    <View
      style={s.rich}
      accessibilityRole="none"
      accessibilityLabel="讲解内容"
      accessibilityState={{}}
    >
      {doc.map((block, index) => {
        switch (block.t) {
          case 'p':
            return (
              <Text key={index} style={book ? s.bookText : s.aiText}>
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
                    <Text style={book ? s.bookText : s.aiText}>
                      {block.ordered ? `${itemIndex + 1}.` : '•'}
                    </Text>
                    <Text style={[book ? s.bookText : s.aiText, s.grow]}>
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
                onPress={() => onFigure?.(block.ref)}
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
                <Text style={book ? s.bookText : s.aiText}>
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
  const content = svg ? (
    <SvgXml
      xml={svg}
      width={width ?? '100%'}
      height={height ?? t.type.aiBody.lineHeight * 2}
      color={t.color.ink}
      accessibilityRole="image"
      accessibilityLabel={tex}
    />
  ) : (
    <Text selectable style={s.mathText}>
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

export function FigureView({ uri, caption, onPress }: KitProps['FigureView']) {
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={s.figure}
      accessibilityRole="button"
      accessibilityLabel={`${caption}，查看大图`}
      accessibilityState={{}}
    >
      <Image
        source={{ uri }}
        resizeMode="contain"
        style={s.figureImage}
        accessibilityLabel={caption}
      />
      <Text style={s.bookCaption}>{caption}</Text>
    </Pressable>
  );
}

export function UserBubble({ text, quote, detour }: KitProps['UserBubble']) {
  const s = useStyles();
  const t = useTokens();
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
      <Text style={s.userText}>{text}</Text>
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
  const t = useTokens();
  return (
    <View
      style={s.tools}
      accessibilityRole="none"
      accessibilityLabel="工具执行步骤"
      accessibilityState={{ busy: lines.some(line => line.running) }}
    >
      {lines.map((line, index) => (
        <View key={index} style={s.inline}>
          {line.running ? (
            <ActivityIndicator
              size="small"
              color={detour ? t.color.detour : t.color.accent}
            />
          ) : (
            <Icon
              name="check"
              size={14}
              color={detour ? t.color.detour : t.color.ink2}
            />
          )}
          <Text style={[s.caption, s.grow]}>{line.text}</Text>
        </View>
      ))}
    </View>
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
      <Text style={[s.caption, { color: t.color.accentInk }]}>
        {label} · {step}
      </Text>
      <Text style={s.headline}>{title}</Text>
      <Text style={s.caption}>{pages}</Text>
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
      <View style={s.inline}>
        <Icon name="bookOpen" size={16} />
        <Text style={s.caption}>{label}</Text>
      </View>
      {doc ? (
        <BookTypography.Provider value>
          <Kit.RichView doc={doc} />
        </BookTypography.Provider>
      ) : (
        <Text style={s.bookText}>{text}</Text>
      )}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.source, pressed && { opacity: 0.8 }]}
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
        s.card,
        {
          backgroundColor:
            kind === 'derive' ? t.color.deriveBg : t.color.exampleBg,
          borderColor: kind === 'derive' ? t.color.deriveBg : t.color.exampleBg,
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
        style={s.cardHeader}
      >
        <Icon
          name={kind === 'derive' ? 'derive' : 'spark'}
          size={16}
          color={color}
        />
        <Text style={[s.caption, { color }]}>{label}</Text>
        <Icon name={expanded ? 'arrowDown' : 'chev'} size={14} color={color} />
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

export function CheckCard({ children, text }: KitProps['CheckCard']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.card}
      accessibilityRole="none"
      accessibilityLabel="检查一下"
      accessibilityState={{}}
    >
      <Text style={[s.caption, { color: t.color.accentInk }]}>检查一下</Text>
      {children ?? <Text style={s.body}>{text}</Text>}
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
  return (
    <View style={s.actions}>
      {items.map(item => (
        <Kit.Button
          key={item.key}
          variant={item.primary ? 'primary' : 'secondary'}
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
  return (
    <View
      style={s.card}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{}}
    >
      <Text style={s.headline}>{title}</Text>
      {lines.map((line, index) => (
        <Text key={index} style={s.body}>
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
  return (
    <View
      style={s.fold}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{ expanded }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${title}，${count}`}
        accessibilityState={{ expanded }}
        style={s.foldHeader}
      >
        <Icon name="check" color={t.color.ok} size={18} />
        <Text style={[s.body, s.grow]}>{title}</Text>
        <Text style={s.caption}>{count}</Text>
        <Icon name={expanded ? 'arrowDown' : 'chev'} size={16} />
      </Pressable>
      {expanded ? <View style={s.foldBody}>{children}</View> : null}
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
  return (
    <View
      style={s.card}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{}}
    >
      <Text style={[s.caption, { color: t.color.accentInk }]}>{title}</Text>
      <Text style={s.headline}>{question}</Text>
      {options.map((option, index) => {
        const color =
          option.state === 'right'
            ? t.color.ok
            : option.state === 'wrong'
            ? t.color.bad
            : t.color.line;
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
                borderColor: color,
                backgroundColor:
                  option.state === 'right'
                    ? t.color.okBg
                    : option.state === 'wrong'
                    ? t.color.badBg
                    : t.color.surface,
              },
              option.state === 'muted' && { opacity: 0.6 },
              pressed && { backgroundColor: t.color.pressed },
            ]}
          >
            <Text style={s.body}>
              {String.fromCharCode(65 + index)}. {option.label}
            </Text>
            {option.state === 'right' || option.state === 'wrong' ? (
              <Icon
                name={option.state === 'right' ? 'check' : 'close'}
                color={color}
              />
            ) : null}
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
      style={[s.card, s.proposal]}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{}}
    >
      <Text style={[s.headline, { color: t.color.accentInk }]}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      {state === 'pending' ? (
        <Actions items={actions} onAction={onAction} />
      ) : (
        <Text style={s.caption}>
          {resultText ?? (state === 'accepted' ? '已记下' : '已忽略')}
        </Text>
      )}
    </View>
  );
}

export function DoneCard({ title, text, onPress }: KitProps['DoneCard']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.card}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{}}
    >
      <View style={s.inline}>
        <Icon name="check" color={t.color.ok} />
        <Text style={s.headline}>{title}</Text>
      </View>
      <Text style={s.body}>{text}</Text>
      {onPress ? (
        <Kit.Button variant="primary" label="查看本节小结" onPress={onPress} />
      ) : null}
    </View>
  );
}

export function SysDivider({ text, tone }: KitProps['SysDivider']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.divider}
      accessibilityRole="text"
      accessibilityLabel={text}
      accessibilityState={{}}
    >
      <View style={s.line} />
      <Text style={[s.caption, tone === 'detour' && { color: t.color.detour }]}>
        {text}
      </Text>
      <View style={s.line} />
    </View>
  );
}

export function Typing({ label = '正在生成' }: KitProps['Typing']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.inline}
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator size="small" color={t.color.accent} />
      <Text style={s.caption}>{label}</Text>
    </View>
  );
}

export function PageOrig({
  uri,
  width,
  height,
  blocks,
  onBlock,
}: KitProps['PageOrig']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={[s.page, { aspectRatio: width / height }]}
      accessibilityRole="none"
      accessibilityLabel="原版书页"
      accessibilityState={{}}
    >
      <Image
        source={{ uri }}
        resizeMode="contain"
        style={s.pageImage}
        accessibilityLabel="原版书页图片"
      />
      {blocks.map(block => {
        const backgroundColor =
          block.state === 'highlight' || block.state === 'flash'
            ? t.color.highlight
            : block.state === 'selected'
            ? t.color.accentBg
            : undefined;
        return (
          <Pressable
            key={block.ref}
            onPress={() => onBlock?.(block.ref)}
            disabled={!onBlock}
            accessibilityRole="button"
            accessibilityLabel={`内容块 b${block.ref}${
              block.pin ? '，有问答便签' : ''
            }`}
            accessibilityState={{
              disabled: !onBlock,
              selected: block.state === 'selected' || block.state === 'current',
            }}
            style={[
              s.pageBlock,
              block.state === 'current' && s.pageCurrent,
              block.state === 'done' && s.pageDone,
              {
                left: `${block.x0 * 100}%`,
                top: `${block.y0 * 100}%`,
                width: `${(block.x1 - block.x0) * 100}%`,
                height: `${(block.y1 - block.y0) * 100}%`,
                borderLeftColor:
                  block.state === 'current' ? t.color.accent : t.color.stepCur,
              },
            ]}
          >
            {backgroundColor ? (
              <View
                pointerEvents="none"
                style={[s.pageHighlight, { backgroundColor }]}
              />
            ) : null}
            {block.pin ? (
              <View style={s.pagePin}>
                <Icon name="pin" size={14} color={t.color.pin} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
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
    (current || done) && {
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
      }${text ?? '原文段落'}`}
      accessibilityState={{ selected: !!current }}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={style}
      accessibilityRole="none"
      accessibilityLabel={text ?? '原文段落'}
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

export function ReadEnd({ label, onPress }: KitProps['ReadEnd']) {
  const s = useStyles();
  return (
    <View
      style={s.readEnd}
      accessibilityRole="none"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      <Kit.Button
        variant="primary"
        label={label}
        icon="check"
        onPress={onPress}
      />
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
  mathDisplay: {
    minWidth: '100%',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  chipTarget: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  cite: {
    ...t.type.micro,
    ...t.type.num,
    borderRadius: t.shape.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  figure: {
    padding: 8,
    borderWidth: 1,
    borderColor: t.color.line,
    borderRadius: t.shape.md,
    backgroundColor: t.color.paper,
    gap: 6,
  },
  figureImage: { width: '100%', height: 180 },
  user: {
    alignSelf: 'flex-end',
    maxWidth: '84%',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: t.shape.lg,
    borderBottomRightRadius: t.shape.xs,
    gap: 4,
  },
  userText: { ...t.type.body, color: t.color.onAccent },
  userQuote: {
    ...t.type.caption,
    color: t.color.onAccent,
    borderLeftWidth: 2,
    borderLeftColor: t.color.onAccent,
    paddingLeft: 6,
  },
  detourMessage: {
    borderLeftWidth: 3,
    borderLeftColor: t.color.detour,
    paddingLeft: 10,
  },
  proposal: { borderStyle: 'dashed', borderColor: t.color.accent },
  message: { gap: 8 },
  tools: { gap: 4 },
  stepHeader: { gap: 4, paddingTop: 8 },
  source: {
    backgroundColor: t.color.paper,
    borderWidth: 1,
    borderColor: t.color.line,
    borderRadius: t.shape.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: t.shape.lg,
    borderWidth: 1,
    borderColor: t.color.line,
    backgroundColor: t.color.surface,
    gap: 8,
  },
  cardHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  fold: {
    backgroundColor: t.color.surface,
    borderRadius: t.shape.lg,
    borderWidth: 1,
    borderColor: t.color.line,
    overflow: 'hidden',
  },
  foldHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  foldBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: t.color.line,
    gap: 10,
  },
  option: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: t.shape.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: t.shape.xs,
    minHeight: 48,
  },
  pin: {
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.pinBg,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  readEnd: { paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center' },
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
