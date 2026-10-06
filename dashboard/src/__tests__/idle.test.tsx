import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIdleSignOut } from '../lib/useIdleSignOut';

afterEach(() => {
  vi.useRealTimers();
});

describe('Automatische Abmeldung (WCAG 2.2.1)', () => {
  it('warnt vorher, lässt verlängern und meldet erst danach ab', () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const { result } = renderHook(() => useIdleSignOut(true, onIdle, 10_000, 4_000));

    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.deadline).toBeNull();

    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.deadline).not.toBeNull();
    expect(onIdle).not.toHaveBeenCalled();

    act(() => result.current.stay());
    expect(result.current.deadline).toBeNull();

    act(() => vi.advanceTimersByTime(9_000));
    expect(onIdle).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2_000));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('jede Eingabe setzt die Zeit zurück; ausgeschaltet passiert nichts', () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    renderHook(() => useIdleSignOut(true, onIdle, 10_000, 4_000));
    act(() => vi.advanceTimersByTime(8_000));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
    });
    act(() => vi.advanceTimersByTime(8_000));
    expect(onIdle).not.toHaveBeenCalled();

    const off = vi.fn();
    renderHook(() => useIdleSignOut(false, off, 1_000, 500));
    act(() => vi.advanceTimersByTime(5_000));
    expect(off).not.toHaveBeenCalled();
  });
});
