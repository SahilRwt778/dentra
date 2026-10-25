import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../common/theme/theme';

/** Tooth outline from the Dentra prototype. */
export function ToothIcon({
  size = 24,
  color = colors.primary,
  fill = 'none',
  dashed = false,
}: {
  size?: number;
  color?: string;
  fill?: string;
  dashed?: boolean;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? '2 2' : undefined}
      accessible={false}
    >
      <Path d="M7.5 3.5c-2.6 0-4 2-4 4.6 0 2.3.9 3.6 1.5 5.4.6 1.9.7 3.4 1.2 5.2.4 1.5 1 2.3 1.9 2.3 1.4 0 1.5-2 1.9-3.8.3-1.5.9-2.6 2-2.6s1.7 1.1 2 2.6c.4 1.8.5 3.8 1.9 3.8.9 0 1.5-.8 1.9-2.3.5-1.8.6-3.3 1.2-5.2.6-1.8 1.5-3.1 1.5-5.4 0-2.6-1.4-4.6-4-4.6-1.9 0-2.9 1.1-4.5 1.1S9.4 3.5 7.5 3.5Z" />
    </Svg>
  );
}
