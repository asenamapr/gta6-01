// SOLARA BAY RADIO — three procedural stations, zero audio files.
// VICE FM rides a synthwave arpeggio over Am–F–C–G, NEON NIGHTS
// drifts on slow pads, HARBOR TALK is a filtered-noise murmur bed
// with sparse station-ID blips. The radio owns one gain node into
// the master bus; ducking rides that node, never the master, so
// engine hum and effects keep their level while music drops under
// overlays.
'use strict';

import { RADIO_GAIN } from './config.js';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Am – F – C – G. One bar per chord on VICE FM, two per chord on pads.
const PROGRESSION = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const STATIONS = [
  { name: 'VICE FM', bpm: 104, tracks: ['Midnight Overdrive', 'Coral Sunset Drive', 'Neon Tide', 'Palm Court Lights'] },
  { name: 'NEON NIGHTS', bpm: 64, tracks: ['Slow Water', 'Empty Boulevard', 'Last Ferry Home', 'Static Bloom'] },
  { name: 'HARBOR TALK', bpm: 0, tracks: ['The Night Desk', 'Dockside Call-In', 'Tide Tables', 'Overnight Freight'] },
];
const BARS_PER_TRACK = 8;

export function createRadio(ctx, master, opts) {
  const options = opts || {};
  const onDisplay = typeof options.onDisplay === 'function' ? options.onDisplay : null;
  const fallbackStation = Number.isInteger(options.defaultStation) ? options.defaultStation : 0;

  const radio = {
    _ctx: ctx, _master: master,
    _bus: null, _noise: null, _timer: null,
    _started: false, _ducked: false,
    _station: fallbackStation % STATIONS.length,
    _track: 0, _bar: 0, _step: 0,
    _nextTime: 0, _nextBlipIn: 7,

    info() {
      const st = STATIONS[this._station];
      return { station: this._station, name: st.name, track: st.tracks[this._track], label: st.name + ' — ' + st.tracks[this._track] };
    },
    stationIndex() { return this._station; },
    _show() { if (onDisplay) onDisplay(this.info()); },

    start() {
      if (this._started) return;
      this._started = true;
      this._bus = ctx.createGain();
      this._bus.gain.value = this._ducked ? 0.06 : RADIO_GAIN;
      this._bus.connect(master);
      if (ctx.state === 'suspended') ctx.resume();
      this._nextTime = ctx.currentTime + 0.1;
      if (this._station === 2) this._startBed();
      this._timer = setInterval(() => this._tick(), 40);
      this._show();
    },

    stop() {
      if (!this._started) return;
      this._started = false;
      clearInterval(this._timer);
      this._timer = null;
      this._stopBed();
      if (this._bus) { this._bus.disconnect(); this._bus = null; }
    },

    setDucked(ducked) {
      this._ducked = !!ducked;
      if (this._bus) this._bus.gain.setTargetAtTime(this._ducked ? 0.06 : RADIO_GAIN, ctx.currentTime, 0.08);
    },

    next() { this.setStation(this._station + 1); return this.info(); },

    setStation(index) {
      const next = ((index % STATIONS.length) + STATIONS.length) % STATIONS.length;
      if (next === this._station && this._started) return this.info();
      const wasTalk = this._station === 2;
      this._station = next;
      this._track = 0; this._bar = 0; this._step = 0;
      if (this._started) {
        this._nextTime = Math.max(this._nextTime, ctx.currentTime + 0.05);
        if (wasTalk) this._stopBed();
        if (next === 2) this._startBed();
      }
      this._show();
      return this.info();
    },

    // One short synth voice: osc -> gain envelope -> bus, with an
    // optional lowpass to keep the sawtooth arpeggio from biting.
    _voice(freq, when, dur, type, vol, cutoff) {
      const osc = ctx.createOscillator();
      osc.type = type; osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(vol, when + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      let head = osc;
      if (cutoff) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = cutoff;
        osc.connect(filter); head = filter;
      }
      head.connect(gain); gain.connect(this._bus);
      osc.start(when); osc.stop(when + dur + 0.05);
    },

    // A pad voice: slow attack, full chord length, gentle release.
    _pad(midis, when, dur) {
      for (const m of midis) {
        for (const detune of [-5, 5]) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle'; osc.frequency.value = midiToFreq(m); osc.detune.value = detune;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.linearRampToValueAtTime(0.05, when + 1.1);
          gain.gain.setValueAtTime(0.05, when + dur - 0.9);
          gain.gain.linearRampToValueAtTime(0.0001, when + dur);
          osc.connect(gain); gain.connect(this._bus);
          osc.start(when); osc.stop(when + dur + 0.05);
        }
      }
      this._voice(midiToFreq(midis[0] - 12), when, dur, 'sine', 0.05);
    },

    // HARBOR TALK bed: looped noise through a bandpass whose
    // frequency wanders on a slow LFO — a crowd murmur with no words
    // in it, so it never fights the game audio.
    _startBed() {
      if (this._noise || !this._bus) return;
      const len = Math.floor(ctx.sampleRate * 2);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.0;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass'; band.frequency.value = 750; band.Q.value = 1.1;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain); lfoGain.connect(band.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      src.connect(band); band.connect(gain); gain.connect(this._bus);
      src.start(); lfo.start();
      this._noise = { src, lfo, gain };
    },
    _stopBed() {
      if (!this._noise) return;
      try { this._noise.src.stop(); } catch (e) { /* already stopped */ }
      try { this._noise.lfo.stop(); } catch (e) { /* already stopped */ }
      this._noise.gain.disconnect();
      this._noise = null;
    },

    // Schedule one eighth-note step for the current station.
    _scheduleStep(when) {
      const st = STATIONS[this._station];
      if (this._station === 0) {
        const chord = PROGRESSION[this._bar % PROGRESSION.length];
        const eighth = 60 / st.bpm / 2;
        // Arpeggio cycles the chord tones, climbing an octave on the
        // back half of the bar; the root thumps on beats one and three.
        const tone = chord[[0, 1, 2, 1, 0, 1, 2, 2][this._step]];
        const up = this._step >= 4 ? 12 : 0;
        this._voice(midiToFreq(tone + up), when, eighth * 0.95, 'sawtooth', 0.11, 1700);
        if (this._step === 0) this._voice(midiToFreq(chord[0] - 12), when, eighth * 3.4, 'triangle', 0.16);
        if (this._step === 4) this._voice(midiToFreq(chord[0] - 12), when, eighth * 1.8, 'triangle', 0.1);
      } else if (this._station === 1 && this._step === 0) {
        // Pads land on the bar line; a chord lasts two bars.
        const chord = PROGRESSION[Math.floor(this._bar / 2) % PROGRESSION.length];
        this._pad(chord, when, (60 / st.bpm) * 4 * 2);
      }
      // HARBOR TALK has no steps: its blips are timed in _tick.
    },

    // Lookahead scheduler: keep ~0.18s of notes queued ahead of the
    // playhead, roll the track after 8 bars, fire talk blips.
    _tick() {
      if (!this._started || !this._bus) return;
      const st = STATIONS[this._station];
      if (this._station === 2) {
        this._nextBlipIn -= 0.04;
        if (this._nextBlipIn <= 0) {
          const when = ctx.currentTime + 0.1;
          this._voice(880, when, 0.1, 'sine', 0.09);
          this._voice(1318, when + 0.13, 0.16, 'sine', 0.09);
          this._nextBlipIn = 6 + Math.random() * 8;
        }
        return;
      }
      const eighth = 60 / st.bpm / 2;
      while (this._nextTime < ctx.currentTime + 0.18) {
        this._scheduleStep(this._nextTime);
        this._step++;
        this._nextTime += eighth;
        if (this._step >= 8) {
          this._step = 0;
          this._bar++;
          if (this._bar >= BARS_PER_TRACK) {
            this._bar = 0;
            this._track = (this._track + 1) % st.tracks.length;
            this._show();
          }
        }
      }
    },
  };

  return radio;
}
