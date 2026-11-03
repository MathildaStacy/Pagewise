import { useEffect, useRef, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import type { RichDoc } from './contracts';
import { Button } from './proxy';
import { copyableText } from './richText';

export function CopyTextButton({
  doc,
  label,
}: {
  doc: RichDoc;
  label: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Button
      variant="text"
      label={feedback ?? label}
      onPress={() => {
        try {
          Clipboard.setString(copyableText(doc));
          setFeedback('已复制');
        } catch {
          setFeedback('复制失败，请重试');
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setFeedback(null), 2000);
      }}
    />
  );
}
