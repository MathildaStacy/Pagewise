import { View } from 'react-native';
import { makeStyles } from './makeStyles';
import { Toast } from './proxy';
import type { ToastProps } from './contracts';

export function ToastHost({ toast }: { toast: ToastProps | null }) {
  const styles = useStyles();
  if (!toast) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={styles.host}
    >
      <Toast {...toast} />
    </View>
  );
}

const useStyles = makeStyles(t => ({
  host: {
    position: 'absolute',
    left: t.space.pageX,
    right: t.space.pageX,
    top: t.brand ? undefined : t.space.gap,
    bottom: t.brand ? 100 : undefined,
  },
}));
