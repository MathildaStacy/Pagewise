import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';

/** Overlays the placeholder only while the local image is available. */
export function CoverImage({ uri }: { uri?: string }) {
  const [failedUri, setFailedUri] = useState<string>();
  if (!uri || failedUri === uri) return null;
  return (
    <Image
      key={uri}
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      accessible={false}
      pointerEvents="none"
      onError={() => setFailedUri(uri)}
    />
  );
}
