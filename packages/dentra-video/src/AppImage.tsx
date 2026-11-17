import React from 'react';
import FastImage, { type FastImageProps } from 'react-native-fast-image';

type ImageSource = Exclude<FastImageProps['source'], unknown[] | undefined>;

/** Respect cache headers, including no-store on private profile and patient photos. */
function withCacheHeaders(source: ImageSource): ImageSource {
  return typeof source === 'number' ? source : { cache: 'web', ...source };
}

export function AppImage({
  source,
  objectFit = 'cover',
  transition = false,
  recyclingKey,
  ...props
}: FastImageProps) {
  const preparedSource = Array.isArray(source)
    ? source.map(withCacheHeaders)
    : source && withCacheHeaders(source);
  const image =
    source && typeof source === 'object' && !Array.isArray(source)
      ? source
      : undefined;

  return (
    <FastImage
      {...props}
      source={preparedSource}
      objectFit={objectFit}
      transition={transition}
      recyclingKey={recyclingKey ?? image?.uri}
    />
  );
}
