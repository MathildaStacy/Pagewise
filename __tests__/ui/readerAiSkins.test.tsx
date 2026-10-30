import Renderer, { act } from 'react-test-renderer';
import { AiOptionsControl } from '@ui/screens/AiOptionsControl';
import { ConversationList } from '@ui/screens/ConversationList';
import { SettingsSelect } from '@ui/screens/MeAIView';
import { Row, SkinProvider, Switch, type SkinId } from '@ui/kit';
import type { AiOptionsState } from '@features/settings/types';

const options: AiOptionsState = {
  config: {
    providerId: 'one',
    model: 'reasoning-model',
    effort: 'low',
    search: false,
  },
  selected: 'one',
  models: [
    {
      key: 'one',
      providerId: 'one',
      model: 'reasoning-model',
      label: '服务一 · 推理模型',
    },
    {
      key: 'two',
      providerId: 'two',
      model: 'other-model',
      label: '服务二 · 多模态模型',
    },
  ],
  efforts: [
    { key: 'low', label: '低' },
    { key: 'high', label: '高' },
  ],
  search: { ok: true, reason: '' },
};
const variants = (
  ['paper', 'glass', 'meta', 'google', 'win11'] as SkinId[]
).flatMap(skinId =>
  (['light', 'dark'] as const).map(scheme => ({ skinId, scheme })),
);
let renderer: Renderer.ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
it.each(variants)(
  'keeps conversation navigation and model controls usable in $skinId/$scheme',
  async ({ skinId, scheme }) => {
    const onOpen = jest.fn(),
      onChange = jest.fn();
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider
          skinId={skinId}
          scheme={scheme}
          fontScale={1.3}
          reduceMotion
        >
          <ConversationList
            items={[
              {
                id: 42,
                bookId: 'book',
                sectionId: '1.2',
                title: '独立对话',
                subtitle: '英文书 · 1.2 Code · 3 条消息',
              },
            ]}
            onOpen={onOpen}
          />
          <AiOptionsControl state={options} onChange={onChange} inline />
        </SkinProvider>,
      );
    });
    const conversation = renderer.root
      .findAllByType(Row)
      .find(node => node.props.title === '独立对话')!;
    expect(conversation.props.subtitle).toContain('英文书 · 1.2 Code');
    await act(async () => conversation.props.onPress());
    expect(onOpen).toHaveBeenCalledWith(42);
    const selects = renderer.root.findAllByType(SettingsSelect);
    await act(async () =>
      selects.find(node => node.props.label === '模型')!.props.onChange('two'),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      providerId: 'two',
      model: 'other-model',
    });
    await act(async () =>
      selects
        .find(node => node.props.label === '推理强度')!
        .props.onChange('high'),
    );
    expect(onChange).toHaveBeenLastCalledWith({ effort: 'high' });
    await act(async () =>
      renderer.root.findByType(Switch).props.onChange(true),
    );
    expect(onChange).toHaveBeenLastCalledWith({ search: true });
    await act(async () =>
      renderer.update(
        <SkinProvider skinId={skinId} scheme={scheme} reduceMotion>
          <AiOptionsControl
            state={{
              ...options,
              efforts: [],
              search: { ok: false, reason: '此模型不支持搜索' },
            }}
            onChange={onChange}
            inline
          />
        </SkinProvider>,
      ),
    );
    expect(renderer.root.findByType(Switch).props.disabled).toBe(true);
    expect(
      renderer.root.findAllByType(SettingsSelect).map(node => node.props.label),
    ).toEqual(['模型']);
  },
);
