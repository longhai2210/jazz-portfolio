/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import { LICKS } from '../../core/data/licks';
import { setFakeLocale } from '../lanes/testing/intl';
import LickBook from './LickBook';

jest.mock(
  'next-intl',
  () =>
    jest.requireActual<typeof import('../lanes/testing/intl')>('../lanes/testing/intl')
      .nextIntlMock,
);

function lickRow(id: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[data-lick="${id}"]`);
  if (!row) throw new Error(`no row for lick ${id}`);
  return row;
}

function dots(id: string): HTMLElement[] {
  return Array.from(lickRow(id).querySelectorAll<HTMLElement>('[data-step]'));
}

afterEach(() => {
  setFakeLocale('en');
});

describe('LickBook', () => {
  it('AC-DUEL-013.8: shows the 3 built-in licks as dot rhythms, filled on their steps and square on off-beats', () => {
    render(<LickBook />);

    const book = screen.getByRole('complementary', { name: 'Lick book' });
    const rows = within(book).getAllByRole('listitem');
    expect(rows.map((row) => row.dataset.lick)).toEqual(['duck', 'frog', 'windChime']);
    expect(rows.map((row) => row.querySelector('p span')?.textContent)).toEqual([
      'Duck',
      'Frog',
      'Wind chime',
    ]);

    const patterns = LICKS.map((lick) =>
      dots(lick.id)
        .map((dot) => (dot.dataset.on === 'true' ? 'x' : '.'))
        .join(' '),
    );
    // The rhythms of the spec's lick table.
    expect(patterns).toEqual(['. . x x . . x .', 'x . . x . x . .', '. x . . x . x x']);

    for (const lick of LICKS) {
      const row = dots(lick.id);
      expect(row).toHaveLength(8);
      row.forEach((dot, step) => {
        const offbeat = step % 2 === 1;
        expect(dot).toHaveAttribute('data-offbeat', String(offbeat));
        expect(dot.className).toContain(offbeat ? 'rounded-[2px]' : 'rounded-full');
        expect(dot.className).toContain(
          lick.steps.includes(step) ? 'bg-jazz-gold' : 'border-jazz-steel',
        );
      });
    }
    expect(book).toHaveTextContent(
      'Round squares mark off-beat positions. Positions 1 to 8 read left to right.',
    );
  });

  it('AC-DUEL-013.8: lights up only the lick just quoted, with a star and a "Just quoted" label', () => {
    const { rerender } = render(<LickBook justQuoted={null} />);
    expect(document.querySelectorAll('[data-lit="true"]')).toHaveLength(0);
    expect(screen.queryByText('Just quoted')).not.toBeInTheDocument();

    rerender(<LickBook justQuoted="frog" />);
    const frog = lickRow('frog');
    expect(frog).toHaveAttribute('data-lit', 'true');
    expect(frog.className).toContain('border-jazz-amber');
    expect(frog.className).toContain('bg-jazz-blue');
    expect(frog).toHaveTextContent('Frog ★');
    expect(within(frog).getByText('Just quoted')).toBeInTheDocument();
    for (const id of ['duck', 'windChime']) {
      expect(lickRow(id)).toHaveAttribute('data-lit', 'false');
      expect(lickRow(id)).not.toHaveTextContent('★');
    }
    expect(screen.getAllByText('Just quoted')).toHaveLength(1);

    rerender(<LickBook justQuoted={null} />);
    expect(frog).toHaveAttribute('data-lit', 'false');
    expect(screen.queryByText('Just quoted')).not.toBeInTheDocument();
  });

  it('AC-DUEL-013.8: names the licks in the player language', () => {
    setFakeLocale('vi');
    render(<LickBook justQuoted="duck" />);
    expect(screen.getByRole('complementary', { name: 'Sổ lick' })).toBeInTheDocument();
    expect(lickRow('duck')).toHaveTextContent('Vịt ★');
    expect(lickRow('duck')).toHaveTextContent('Vừa trích');
    expect(lickRow('frog')).toHaveTextContent('Ếch');
    expect(lickRow('windChime')).toHaveTextContent('Chuông gió');
  });
});
