import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlPanel } from '@/components/ui/ControlPanel';
import { SceneStoreProvider } from '@/lib/store';
import { DEFAULT_PARTS } from '@/lib/defaultParts';

function renderPanel() {
  const user = userEvent.setup();
  render(
    <SceneStoreProvider>
      <ControlPanel />
    </SceneStoreProvider>,
  );
  return { user };
}

const pressed = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

describe('<ControlPanel>', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists every part and starts with nothing selected', () => {
    renderPanel();
    for (const p of DEFAULT_PARTS) expect(screen.getByRole('button', { name: p.name })).toBeInTheDocument();
    expect(screen.getByText('No part selected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to API' })).toBeDisabled();
  });

  it('selecting a part shows its transform readout and material controls', async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Arm' }));

    expect(screen.getByRole('button', { name: 'Arm' })).toHaveAttribute('aria-pressed', 'true');
    const props = screen.getByTestId('properties');
    expect(within(props).getByRole('heading', { name: 'Arm' })).toBeInTheDocument();
    expect(screen.getByTestId('readout-position')).toHaveTextContent('0.10, 2.20, 0.00');
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('editing a material value updates the readout and enables Save', async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Arm' }));
    const [metalness] = screen.getAllByRole('slider');
    fireEvent.change(metalness, { target: { value: '0.9' } });

    expect(screen.getByText('0.90')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to API' })).toBeEnabled();
  });

  it('W / E / R switch transform mode and Escape deselects', async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Tool Head' }));

    await user.keyboard('e');
    expect(pressed('Rotate')).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('r');
    expect(pressed('Scale')).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('w');
    expect(pressed('Move')).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Escape}');
    expect(screen.getByText('No part selected.')).toBeInTheDocument();
  });

  it('does not hijack browser shortcuts like Ctrl+R', async () => {
    const { user } = renderPanel();
    await user.keyboard('{Control>}r{/Control}');
    expect(pressed('Move')).toHaveAttribute('aria-pressed', 'true');
    expect(pressed('Scale')).toHaveAttribute('aria-pressed', 'false');
  });

  it('ignores shortcuts while typing in an input', async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Arm' }));
    const slider = screen.getAllByRole('slider')[0];
    slider.focus();
    await user.keyboard('e');
    expect(pressed('Move')).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves to the API and shows "Saved"', async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ parts: JSON.parse(String(init.body)).parts, updatedAt: 'now' }))),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { user } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Arm' }));
    fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '0.2' } });
    await user.click(screen.getByRole('button', { name: 'Save to API' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled());
    expect(fetchMock).toHaveBeenCalledWith('/api/parts', expect.objectContaining({ method: 'PUT' }));
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent.parts.find((p: { id: string }) => p.id === 'arm').roughness).toBe(0.2);
  });

  it('shows an error and keeps Save enabled when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))));
    const { user } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Arm' }));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '0.5' } });
    await user.click(screen.getByRole('button', { name: 'Save to API' }));

    expect(await screen.findByText('Save failed — try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to API' })).toBeEnabled();
  });

  it('Reset restores defaults and deselects', async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Arm' }));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '0.9' } });
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByText('No part selected.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Arm' }));
    expect(screen.getByText('0.30')).toBeInTheDocument();
  });

  it('toggles the live heatmap', async () => {
    const { user } = renderPanel();
    const toggle = screen.getByRole('checkbox', { name: 'Live sensor heatmap' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
  });
});
