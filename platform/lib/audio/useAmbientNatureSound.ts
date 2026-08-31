"use client";

// =====================================================================
// useAmbientNatureSound()
// Synthesizes a calm, endless "rain" soundscape entirely with the Web
// Audio API — no audio file to bundle or fetch, so it works offline
// and adds zero network weight. Brown noise (deeper/softer than white
// noise) run through a gentle low-pass filter approximates steady
// rainfall; a slow LFO on the filter cutoff adds the subtle "swell"
// real rain has instead of sounding like a flat hiss.
// =====================================================================
import { useEffect, useRef, useState } from "react";

const DEFAULT_VOLUME = 0.18; // deliberately quiet — background texture, not a track

export function useAmbientNatureSound() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const graphRef = useRef<{
    source: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    lfo: OscillatorNode;
    gain: GainNode;
  } | null>(null);

  function ensureContext(): AudioContext {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }

  function buildBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const durationSeconds = 4; // short loop, seamless enough for background texture
    const buffer = ctx.createBuffer(1, ctx.sampleRate * durationSeconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastValue = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // Brownian (integrated) noise — softer, lower-frequency than white noise
      lastValue = (lastValue + 0.02 * white) / 1.02;
      data[i] = lastValue * 3.5; // compensate for the integration's amplitude loss
    }
    return buffer;
  }

  function start() {
    const ctx = ensureContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (graphRef.current) return; // already playing

    const source = ctx.createBufferSource();
    source.buffer = buildBrownNoiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    filter.Q.value = 0.7;

    // Slow LFO drifting the cutoff to mimic rain intensity ebbing/swelling
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08; // ~12s cycle
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    lfo.start();

    graphRef.current = { source, filter, lfo, gain };
    setIsPlaying(true);
  }

  function stop() {
    if (!graphRef.current) return;
    const { source, lfo, gain } = graphRef.current;
    const ctx = audioCtxRef.current;
    if (ctx) {
      // Quick fade-out avoids an audible click on stop.
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => {
        source.stop();
        lfo.stop();
      }, 150);
    }
    graphRef.current = null;
    setIsPlaying(false);
  }

  function toggle() {
    if (isPlaying) stop();
    else start();
  }

  function setVolume(v: number) {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    if (graphRef.current) graphRef.current.gain.gain.value = clamped;
  }

  useEffect(() => {
    return () => {
      stop();
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isPlaying, toggle, volume, setVolume };
}
