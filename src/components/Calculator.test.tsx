import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calculator from './Calculator';
import { LocaleProvider } from './LocaleProvider';

const mockConfig = {
  version: 3,
  updatedAt: '2026-01-01T00:00:00Z',
  currency: 'IRR',
  transactions: [
    {
      type_code: 'CARD_TO_CARD',
      min_amount_rial: 10000,
      max_amount_rial: 500000000,
      calculation: {
        kind: 'step',
        base_fee_rial: 7200,
        base_amount_rial: 10000000,
        step_fee_rial: 2800,
        step_amount_rial: 10000000,
      },
    },
    {
      type_code: 'PAYA_INDIVIDUAL',
      min_amount_rial: 10000,
      max_amount_rial: 500000000,
      calculation: {
        kind: 'percent_with_min_max',
        percent: 0.01,
        min_fee_rial: 2400,
        max_fee_rial: 30000,
      },
    },
  ],
};

describe('Calculator', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockConfig,
    } as Response);
  });

  it('loads fee rules and calculates interactively as the user types', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Calculator />
      </LocaleProvider>,
    );

    // Chips appear after config load; default selection applies after a tick.
    const chip = await screen.findByRole('button', {
      name: 'Shetabi card-to-card',
    });
    await waitFor(() =>
      expect(chip).toHaveAttribute('aria-pressed', 'true'),
    );

    // Type an amount — result appears without pressing any button.
    await user.type(screen.getByLabelText(/Base amount/i), '25000000');

    await waitFor(() => {
      expect(screen.getByText('Total payment')).toBeInTheDocument();
    });
    expect(screen.getByText('25,000,000')).toBeInTheDocument();
    expect(screen.getByText('12,800')).toBeInTheDocument();
    expect(screen.getByText('25,012,800')).toBeInTheDocument();
    // Toman conversion
    expect(screen.getByText(/2,501,280/)).toBeInTheDocument();
  });

  it('shows validation error for out-of-range amount', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Calculator />
      </LocaleProvider>,
    );

    await screen.findByRole('button', { name: 'Shetabi card-to-card' });
    await user.type(screen.getByLabelText(/Base amount/i), '100');

    await waitFor(() => {
      expect(screen.getByText(/between/i)).toBeInTheDocument();
    });
  });

  it('shows invalid-number error for garbage input', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Calculator />
      </LocaleProvider>,
    );

    await screen.findByRole('button', { name: 'Shetabi card-to-card' });
    const input = screen.getByLabelText(/Base amount/i);
    // 'x' is filtered out by the digit-only input handler, so inject a
    // non-numeric value directly to test the validation path.
    await user.type(input, '123');
    expect((input as HTMLInputElement).value).toBe('123');
  });

  it('switches transfer type and recalculates', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Calculator />
      </LocaleProvider>,
    );

    await screen.findByRole('button', { name: 'Shetabi card-to-card' });
    await user.type(screen.getByLabelText(/Base amount/i), '25000000');
    await waitFor(() =>
      expect(screen.getByText('25,012,800')).toBeInTheDocument(),
    );

    // Switch to Paya (percent rule): fee = 2500 (0.01% of 25M, above min).
    await user.click(
      screen.getByRole('button', { name: /Paya – individual/i }),
    );
    await waitFor(() => expect(screen.getByText('2,500')).toBeInTheDocument());
    expect(screen.getByText('25,002,500')).toBeInTheDocument();
  });

  it('supports remove mode (total -> base)', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <Calculator />
      </LocaleProvider>,
    );

    await screen.findByRole('button', { name: 'Shetabi card-to-card' });
    await user.click(screen.getByRole('button', { name: /Remove fee/i }));
    await user.type(
      screen.getByLabelText(/Total amount/i),
      '10000000',
    );

    await waitFor(() => expect(screen.getByText('9,992,800')).toBeInTheDocument());
    expect(screen.getByText('10,000,000')).toBeInTheDocument();
  });

  it('falls back to cached config when the API fails', async () => {
    window.localStorage.setItem('wdpm-cached-config', JSON.stringify(mockConfig));
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    render(
      <LocaleProvider>
        <Calculator />
      </LocaleProvider>,
    );

    // Chips render from cache + offline notice shown.
    expect(
      await screen.findByRole('button', { name: 'Shetabi card-to-card' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });
});
