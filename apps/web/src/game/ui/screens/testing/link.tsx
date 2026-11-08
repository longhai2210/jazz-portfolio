/**
 * Stand-in for `next/link` in jsdom, which has no Next router and cannot navigate. It renders the
 * anchor, runs the `onClick` it was given, then records where the router would go:
 *
 *   jest.mock('next/link', () =>
 *     jest.requireActual<typeof import('./screens/testing/link')>('./screens/testing/link'),
 *   );
 *
 * Clear `navigations` between tests. Test-only.
 */
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

/** Every href a click navigated to, in order. */
export const navigations: string[] = [];

type FakeLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  readonly href: string;
  readonly children?: ReactNode;
};

export default function FakeLink({ href, onClick, children, ...rest }: FakeLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    navigations.push(href);
  }
  return (
    <a href={href} {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}
