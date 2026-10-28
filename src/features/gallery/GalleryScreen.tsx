import { useState } from 'react';
import { SkinGalleryView } from '@ui/screens/SkinGalleryView';
import { useAppearanceVM } from '@features/appearance/useAppearanceVM';
import type { GalleryState, GalleryIntents } from './types';
import { previewPageUri } from './preview';

export function GalleryScreen({
  appearance,
  fontScale,
  onScale,
}: {
  appearance(): void;
  fontScale: number;
  onScale(value: number): void;
}) {
  const vm = useAppearanceVM(() => {});
  const [local, setLocal] = useState<
    Omit<GalleryState, keyof typeof vm.state | 'fontScale' | 'previewPageUri'>
  >({
    mode: 'listen',
    overlay: null,
    composer: '',
    field: '切换样式后，内容还在',
    switchOn: true,
    checked: true,
    step: 1,
    flipped: false,
    guideOpen: false,
    foldOpen: false,
    picked: null,
    proposal: 'pending',
    toast: null,
  });
  const patch = (value: Partial<typeof local>) =>
    setLocal(state => ({ ...state, ...value }));
  const intents: GalleryIntents = {
    ...vm.intents,
    appearance,
    setScale: value => onScale(Number(value)),
    setMode: mode => patch({ mode }),
    openOverlay: overlay => patch({ overlay }),
    closeOverlay: () => patch({ overlay: null }),
    setComposer: composer => patch({ composer }),
    setField: field => patch({ field }),
    setSwitch: switchOn => patch({ switchOn }),
    toggleChecked: () => patch({ checked: !local.checked }),
    jumpStep: step => patch({ step }),
    flip: () => patch({ flipped: !local.flipped }),
    toggleGuide: () => patch({ guideOpen: !local.guideOpen }),
    toggleFold: () => patch({ foldOpen: !local.foldOpen }),
    pick: picked => patch({ picked }),
    propose: key =>
      patch({ proposal: key === 'accept' ? 'accepted' : 'dismissed' }),
    notify: toast => patch({ toast }),
  };
  return (
    <SkinGalleryView
      state={{ ...vm.state, ...local, fontScale, previewPageUri }}
      intents={intents}
    />
  );
}
