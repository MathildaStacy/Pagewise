import Renderer, { act } from 'react-test-renderer';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { ContainerProvider } from '@app/ContainerProvider';
import { AppNavProvider, type AppNav } from '@features/nav';
import { useShelfVM } from '@features/library/useLibraryVM';
import {
  deleteBook,
  reparseBook,
  pickImportDraft,
} from '@app/usecases/importBooks';
import { BookManagementSheet } from '@ui/screens/BookManagementSheet';
import { Button, SkinProvider } from '@ui/kit';

jest.mock('@app/usecases/importBooks', () => ({
  ...jest.requireActual('@app/usecases/importBooks'),
  deleteBook: jest.fn(),
  reparseBook: jest.fn(),
  pickImportDraft: jest.fn(),
}));
let c: Container;
let renderer: Renderer.ReactTestRenderer;
let vm: ReturnType<typeof useShelfVM>;
const nav: AppNav = {
  open: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  enterDemo: jest.fn(),
  exitDemo: jest.fn(),
};
beforeEach(async () => {
  c = await createTestDemoContainer();
  c.mode = 'device';
  jest.clearAllMocks();
  jest.mocked(deleteBook).mockResolvedValue({ filesRemoved: true });
  jest.mocked(reparseBook).mockResolvedValue();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  await c.close();
});
async function mount() {
  function Probe() {
    vm = useShelfVM();
    return null;
  }
  await act(async () => {
    renderer = Renderer.create(
      <ContainerProvider value={c}>
        <AppNavProvider value={nav}>
          <Probe />
        </AppNavProvider>
      </ContainerProvider>,
    );
  });
}
it('opens book management, requires deletion confirmation, and permits cancelling', async () => {
  await mount();
  await act(async () => vm.intents.openBookActions('aima'));
  expect(vm.state.overlay).toMatchObject({
    kind: 'bookActions',
    title: expect.any(String),
  });
  await act(async () => vm.intents.requestDelete());
  expect(vm.state.overlay?.kind).toBe('delete');
  expect(deleteBook).not.toHaveBeenCalled();
  await act(async () => vm.intents.closeOverlay());
  expect(deleteBook).not.toHaveBeenCalled();
  await act(async () => vm.intents.openBookActions('aima'));
  await act(async () => vm.intents.requestDelete());
  await act(async () => {
    await vm.intents.confirmDelete();
  });
  expect(deleteBook).toHaveBeenCalledWith(c, 'aima');
  expect(vm.state.toast).toBe('书籍已删除，可以重新导入');
  expect(vm.state.overlay).toBeNull();
});
it('offers reparse on duplicate selection and sends the selected OCR option after confirmation', async () => {
  await c.secrets.set('mineru.token', 'test-token');
  jest
    .mocked(pickImportDraft)
    .mockResolvedValue({ kind: 'duplicate', bookId: 'aima' });
  await mount();
  await act(async () => vm.intents.openImport());
  await act(async () => vm.intents.pickOther());
  expect(vm.state.overlay).toMatchObject({
    kind: 'bookActions',
    duplicate: true,
  });
  expect(nav.open).not.toHaveBeenCalled();
  await act(async () => vm.intents.requestReparse());
  expect(vm.state.overlay).toMatchObject({ kind: 'reparse', ocr: true });
  expect(reparseBook).not.toHaveBeenCalled();
  await act(async () => vm.intents.setReparseOcr(false));
  await act(async () => {
    await vm.intents.confirmReparse();
  });
  expect(reparseBook).toHaveBeenCalledWith(c, 'aima', { ocr: false });
  expect(nav.open).toHaveBeenCalledWith({
    name: 'ParseProgress',
    bookId: 'aima',
  });
});
it('blocks duplicate delete taps and keeps the confirmation visible on failure without exposing paths', async () => {
  let reject!: (error: Error) => void;
  jest.mocked(deleteBook).mockReturnValue(
    new Promise((_, no) => {
      reject = no;
    }),
  );
  await mount();
  await act(async () => vm.intents.openBookActions('aima'));
  await act(async () => vm.intents.requestDelete());
  let pending!: Promise<void>;
  await act(async () => {
    pending = vm.intents.confirmDelete();
  });
  await act(async () => {
    await vm.intents.confirmDelete();
    vm.intents.closeOverlay();
  });
  expect(deleteBook).toHaveBeenCalledTimes(1);
  expect(vm.state.overlay).toMatchObject({ kind: 'delete', busy: true });
  await act(async () => {
    reject(new Error('/private/full/path ENOENT'));
    await pending;
  });
  expect(vm.state.overlay).toMatchObject({
    kind: 'delete',
    busy: false,
    error: '删除没有完成，请重试。',
  });
});
it('shows missing token guidance before reparse and a short inline error for failed intake', async () => {
  await mount();
  await act(async () => vm.intents.openBookActions('aima'));
  await act(async () => vm.intents.requestReparse());
  await act(async () => {
    await vm.intents.confirmReparse();
  });
  expect(reparseBook).not.toHaveBeenCalled();
  expect(vm.state.overlay).toMatchObject({
    kind: 'reparse',
    needsToken: true,
    busy: false,
  });
  await act(async () => vm.intents.closeOverlay());
  jest
    .mocked(pickImportDraft)
    .mockRejectedValue(
      new Error(`/data/user/${'%E4%B9%A6'.repeat(100)} ENAMETOOLONG`),
    );
  await act(async () => vm.intents.openImport());
  await act(async () => vm.intents.pickOther());
  expect(vm.state.overlay).toMatchObject({
    kind: 'import',
    busy: false,
    error: '文件名过长，请缩短文件名后重新选择。',
  });
  expect(vm.state.toast).toBeNull();
});
it.each(['paper', 'glass', 'meta', 'google', 'win11'] as const)(
  '%s renders management actions in both schemes',
  async skin => {
    await mount();
    await act(async () => vm.intents.openBookActions('aima'));
    const state = vm.state,
      intents = vm.intents;
    await act(async () => renderer.unmount());
    for (const scheme of ['light', 'dark'] as const) {
      await act(async () => {
        renderer = Renderer.create(
          <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
            <BookManagementSheet state={state} intents={intents} />
          </SkinProvider>,
        );
      });
      expect(
        renderer.root.findAllByType(Button).map(b => b.props.children),
      ).toEqual(['打开书籍', '重新解析', '删除书籍', '取消']);
      await act(async () => renderer.unmount());
    }
  },
);
