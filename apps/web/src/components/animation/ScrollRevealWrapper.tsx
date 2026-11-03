'use client';

import ScrollReveal from './ScrollReveal';
import type { ComponentProps } from 'react';

export default function ScrollRevealWrapper(props: ComponentProps<typeof ScrollReveal>) {
  return <ScrollReveal {...props} />;
}
