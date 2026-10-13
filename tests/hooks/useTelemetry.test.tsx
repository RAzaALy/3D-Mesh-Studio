import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTelemetry } from '@/hooks/useTelemetry';

const payload = (timestamp: number) => ({ size: 2, values: [0, 0.25, 0.5, 1], timestamp });
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** let the awaited fetch/json promises inside the hook settle */
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

describe('useTelemetry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fetches immediately, stores the payload in a ref, then polls on the interval', async () => {
    fetchMock.mockImplementation(() => ok(payload(1)));
    const { result } = renderHook(() => useTelemetry(true, 2, 500));

    await act(() => vi.advanceTimersByTimeAsync(0));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/telemetry?size=2');
    expect(result.current.current?.values).toEqual([0, 0.25, 0.5, 1]);

    await act(() => vi.advanceTimersByTimeAsync(500));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores responses older than the one it already has', async () => {
    fetchMock.mockImplementationOnce(() => ok(payload(200))).mockImplementationOnce(() => ok(payload(100)));
    const { result } = renderHook(() => useTelemetry(true, 2, 500));

    await act(() => vi.advanceTimersByTimeAsync(0));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(500));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.current?.timestamp).toBe(200);
  });

  it('keeps polling after a failed request', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline'))).mockImplementation(() => ok(payload(1)));
    renderHook(() => useTelemetry(true, 2, 500));

    await act(() => vi.advanceTimersByTimeAsync(0));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(500));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
  });

  it('pauses while the tab is hidden and resumes when visible', async () => {
    fetchMock.mockImplementation(() => ok(payload(1)));
    renderHook(() => useTelemetry(true, 2, 500));
    await act(() => vi.advanceTimersByTimeAsync(0));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    await act(() => vi.advanceTimersByTimeAsync(0));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does nothing when disabled and aborts in-flight requests on unmount', async () => {
    renderHook(() => useTelemetry(false));
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(fetchMock).not.toHaveBeenCalled();

    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise(() => {}); // never resolves
    });
    const { unmount } = renderHook(() => useTelemetry(true));
    await act(() => vi.advanceTimersByTimeAsync(0));
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
