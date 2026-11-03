/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ScrollToTop from '@/components/common/ScrollToTop';

describe('component test setup', () => {
  it('renders ScrollToTop once the page has scrolled', () => {
    render(<ScrollToTop />);
    expect(screen.queryByRole('button', { name: 'Scroll to top' })).not.toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', { value: 600, configurable: true });
    fireEvent.scroll(window);

    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeVisible();
  });
});
