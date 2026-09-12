import type { RefreshProfile } from "./types";

/**
 * OLED cannot do real electrophoretic physics. This module imitates the
 * *feel* of e-ink refresh waveforms (GC16-style clear flash, soft DU,
 * residual ghosting) with timed overlays.
 */

export type WaveformMode = RefreshProfile;

export interface WaveformTarget {
  flash: HTMLElement;
  ghost?: HTMLElement | null;
}

const WAVEFORM_MS: Record<WaveformMode, number> = {
  paper: 0,
  kindle: 95,
  eink: 220,
  ghosting: 180,
};

export function waveformDuration(mode: WaveformMode): number {
  return WAVEFORM_MS[mode] ?? 0;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function restartAnimation(el: HTMLElement) {
  // Force CSS animation restart when turning pages quickly
  el.classList.remove("on");
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  el.offsetWidth;
  el.classList.add("on");
}

/**
 * Run a page-turn waveform imitation on the flash/ghost overlays.
 * Call this *before* navigating the reader so the clear flash covers
 * the old page, then settle onto the new page.
 */
export async function runWaveform(
  target: WaveformTarget,
  mode: WaveformMode,
): Promise<void> {
  const ms = waveformDuration(mode);
  if (ms <= 0) return;

  const { flash, ghost } = target;
  flash.dataset.mode = mode;
  flash.dataset.phase = "start";

  if (mode === "ghosting" && ghost) {
    ghost.classList.add("on");
    ghost.dataset.mode = "ghosting";
  }

  restartAnimation(flash);

  if (mode === "eink") {
    // GC16-ish: white clear → black invert → settle
    flash.dataset.phase = "white";
    await wait(55);
    flash.dataset.phase = "black";
    await wait(70);
    flash.dataset.phase = "settle";
    await wait(95);
  } else if (mode === "kindle") {
    flash.dataset.phase = "soft";
    await wait(ms);
  } else if (mode === "ghosting") {
    flash.dataset.phase = "ghost";
    await wait(ms);
  }

  flash.classList.remove("on");
  flash.removeAttribute("data-phase");
  ghost?.classList.remove("on");
}
