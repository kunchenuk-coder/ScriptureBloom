/**
 * Highly robust background music & custom ambient soundscape utility.
 * Supporting standard classical MP3 playback with a browser-synthesized ambient chime fallback.
 * It also includes a fully procedural, CORS-free nature soundscape mixer (sea waves, pitter-patter rain,
 * fire crackles, crickets/frogs, forest birds, and rustling forest wind) built via the Web Audio API.
 */

export type AmbientNoiseType = 'waves' | 'rain' | 'fireplace' | 'crickets' | 'birds' | 'wind';

export interface AmbientNoise {
  id: AmbientNoiseType;
  name: string;
  icon: string;
  isActive: boolean;
  volume: number; // Scale: 0 to 1
}

class AudioService {
  private audio: HTMLAudioElement | null = null;
  private synthInterval: any = null;
  private fadeInterval: any = null;
  private audioContext: AudioContext | null = null;
  private isSynthPlaying: boolean = false;
  private currentVolume: number = 0.15; // "轻柔的音量" (Gentle volume)
  private isEnabled: boolean = true; // User preference for system audio/piano

  // Ambient noises data structure
  private noises: AmbientNoise[] = [
    { id: 'waves', name: '海浪轻轻', icon: 'Waves', isActive: false, volume: 0.4 },
    { id: 'rain', name: '雨淅淅沥沥', icon: 'CloudRain', isActive: false, volume: 0.4 },
    { id: 'fireplace', name: '火炉柴火', icon: 'Flame', isActive: false, volume: 0.4 },
    { id: 'crickets', name: '蛐蛐青蛙', icon: 'Sparkles', isActive: false, volume: 0.3 },
    { id: 'birds', name: '森林鸟鸣', icon: 'Twitter', isActive: false, volume: 0.3 },
    { id: 'wind', name: '树林风声', icon: 'Wind', isActive: false, volume: 0.4 },
  ];

  // Active state holders for procedurally synthesized nodes to prevent multiple triggers
  private noiseMasterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Active procedural wave/wind source buffers to allow active stopping
  private activeSources: { [key in AmbientNoiseType]?: any } = {};
  
  // Schedulers for random microevents (droplets, sparks, tweets)
  private activeTimers: { [key: string]: any } = {};

  // List of highly reliable classical/contemplative royalty-free and public domain audio sources
  // All electronic or upbeat tempos are completely removed. We use Satie's Gymnopedies.
  private audioSources = [
    'https://upload.wikimedia.org/wikipedia/commons/2/25/Gymnop%C3%A9die_No._1.mp3', // Satie's acoustic piano Gymnopédie No. 1 (very slow, quiet, reverby)
    'https://archive.org/download/GymnopdieNo.1-8314/GymnopedieNo.1.mp3', // Alternate acoustic piano recording of Gymnopedie No. 1
  ];
  private currentSourceIndex = 0;

  constructor() {
    // Read persisted user preference if there is any
    const savedPref = localStorage.getItem('bg_music_enabled');
    if (savedPref !== null) {
      this.isEnabled = savedPref === 'true';
    }

    // Load custom volumes and active states from local storage
    const savedNoises = localStorage.getItem('ambient_noises_config');
    if (savedNoises) {
      try {
        const parsed = JSON.parse(savedNoises);
        this.noises = this.noises.map(orig => {
          const matched = parsed.find((p: any) => p.id === orig.id);
          return matched ? { ...orig, isActive: !!matched.isActive, volume: Math.max(0, Math.min(1, matched.volume)) } : orig;
        });
      } catch (e) {
        console.warn("Error parsing ambient noise config, keeping defaults:", e);
      }
    }
  }

  public getAmbientNoises(): AmbientNoise[] {
    return [...this.noises];
  }

  /**
   * Toggle a specific ambient white noise on or off
   */
  public toggleAmbientNoise(id: AmbientNoiseType): AmbientNoise[] {
    this.noises = this.noises.map(n => {
      if (n.id === id) {
        const nextActive = !n.isActive;
        // Trigger start/stop side effect
        this.handleNoiseStateChange(id, nextActive, n.volume);
        return { ...n, isActive: nextActive };
      }
      return n;
    });
    this.saveNoisesConfig();
    return [...this.noises];
  }

  /**
   * Set specific noise volume
   */
  public setAmbientNoiseVolume(id: AmbientNoiseType, volume: number): AmbientNoise[] {
    const vol = Math.max(0, Math.min(1, volume));
    this.noises = this.noises.map(n => {
      if (n.id === id) {
        this.handleNoiseVolumeChange(id, vol);
        return { ...n, volume: vol };
      }
      return n;
    });
    this.saveNoisesConfig();
    return [...this.noises];
  }

  private saveNoisesConfig() {
    localStorage.setItem('ambient_noises_config', JSON.stringify(this.noises));
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    localStorage.setItem('bg_music_enabled', String(enabled));
    if (!enabled) {
      this.pause();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public setVolume(volume: number) {
    this.currentVolume = volume;
    if (this.audio) {
      this.audio.volume = volume;
    }
  }

  public async play(): Promise<boolean> {
    this.initAudioContext();
    
    // Ensure any previously configured ambient noises start playing
    this.startActiveAmbientNoises();

    if (!this.isEnabled) return false;

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    // Try playing standard audio tracks
    try {
      this.stopSynth();
      if (!this.audio) {
        this.audio = new Audio(this.audioSources[this.currentSourceIndex]);
        this.audio.loop = true;
        this.audio.volume = 0;

        // Add error handling to cycle through sources
        this.audio.onerror = () => {
          console.warn(`Audio source failed: ${this.audioSources[this.currentSourceIndex]}. Trying alternative.`);
          this.cycleSourceAndPlay();
        };
      } else {
        this.audio.src = this.audioSources[this.currentSourceIndex];
        this.audio.volume = 0;
      }

      await this.audio.play();

      // Gradual fade-in over ~1 second
      const targetVol = this.currentVolume;
      let currentVol = 0;
      this.fadeInterval = setInterval(() => {
        if (this.audio) {
          currentVol += Math.min(0.01, targetVol / 20);
          if (currentVol >= targetVol) {
            this.audio.volume = targetVol;
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
          } else {
            this.audio.volume = currentVol;
          }
        } else {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
      }, 50);

      return true;
    } catch (err) {
      console.warn("HTML5 audio playback blocked or failed, starting procedural ambient synth pad fallback:", err);
      // Fallback: Start synthesizing extremely peaceful browser-native relaxation pad
      this.startSynth();
      return true;
    }
  }

  private cycleSourceAndPlay() {
    this.currentSourceIndex = (this.currentSourceIndex + 1) % this.audioSources.length;
    if (this.audio) {
      this.audio.src = this.audioSources[this.currentSourceIndex];
      this.audio.volume = 0;
      this.audio.play().then(() => {
        // Simple fade-in after fallback cycle
        const targetVol = this.currentVolume;
        let currentVol = 0;
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = setInterval(() => {
          if (this.audio) {
            currentVol += Math.min(0.01, targetVol / 20);
            if (currentVol >= targetVol) {
              this.audio.volume = targetVol;
              clearInterval(this.fadeInterval);
              this.fadeInterval = null;
            } else {
              this.audio.volume = currentVol;
            }
          } else {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
          }
        }, 50);
      }).catch(e => {
        console.warn("Fallback HTML5 source failed too. Initializing synth pad:", e);
        this.startSynth();
      });
    }
  }

  public pause() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.volume = 0;
    }
    this.stopSynth();
    this.stopAllAmbientNoises();
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(e => console.warn('AudioContext failed to resume:', e));
    }
    if (!this.noiseMasterGain) {
      this.noiseMasterGain = this.audioContext.createGain();
      this.noiseMasterGain.gain.setValueAtTime(0.7, this.audioContext.currentTime); // Standard relative scale
      this.noiseMasterGain.connect(this.audioContext.destination);
    }
  }

  /**
   * Helper to lazy-generate a standard 2-second white noise buffer used across multiple filters
   */
  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    this.initAudioContext();
    const sampleRate = this.audioContext!.sampleRate;
    const bufferSize = 2 * sampleRate;
    const buffer = this.audioContext!.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return this.noiseBuffer;
  }

  /**
   * Play any ambient noise marked active
   */
  private startActiveAmbientNoises() {
    this.initAudioContext();
    this.noises.forEach(n => {
      if (n.isActive && !this.activeSources[n.id] && !this.activeTimers[n.id + '_active']) {
        this.handleNoiseStateChange(n.id, true, n.volume);
      }
    });
  }

  private stopAllAmbientNoises() {
    this.noises.forEach(n => {
      this.handleNoiseStateChange(n.id, false, 0);
    });
  }

  /**
   * Handle changes to volume of active synthesizer routes in real-time
   */
  private handleNoiseVolumeChange(id: AmbientNoiseType, volume: number) {
    const gainNode = this.activeSources[id + '_gain'];
    if (gainNode) {
      this.initAudioContext();
      gainNode.gain.setValueAtTime(volume, this.audioContext!.currentTime);
    }
  }

  /**
   * Dynamic synthesis routing on toggle
   */
  private handleNoiseStateChange(id: AmbientNoiseType, active: boolean, volume: number) {
    this.initAudioContext();
    const ctx = this.audioContext!;

    // 1. If turning off, clean up nodes and intervals
    if (!active) {
      // Clear timers
      if (this.activeTimers[id]) {
        clearInterval(this.activeTimers[id]);
        delete this.activeTimers[id];
      }
      this.activeTimers[id + '_active'] = false;

      // Stop source buffers
      const source = this.activeSources[id];
      if (source) {
        try { source.stop(); } catch (e) {}
        delete this.activeSources[id];
      }
      
      const gainNode = this.activeSources[id + '_gain'];
      if (gainNode) {
        try { gainNode.disconnect(); } catch (e) {}
        delete this.activeSources[id + '_gain'];
      }

      const lfo = this.activeSources[id + '_lfo'];
      if (lfo) {
        try { lfo.stop(); } catch (e) {}
        delete this.activeSources[id + '_lfo'];
      }
      return;
    }

    // 2. If turning on and already running, do nothing
    if (this.activeSources[id] || this.activeTimers[id]) {
      return;
    }

    this.activeTimers[id + '_active'] = true;

    // Create target gain node for actual volume control
    const targetGain = ctx.createGain();
    targetGain.gain.setValueAtTime(volume, ctx.currentTime);
    targetGain.connect(this.noiseMasterGain!);
    this.activeSources[id + '_gain'] = targetGain;

    // Direct routing based on type
    switch (id) {
      case 'waves': {
        // --- 1. Gentle Waves Synthesis ---
        // White noise base with a heavy, oceanish bandpass filter
        const source = ctx.createBufferSource();
        source.buffer = this.getNoiseBuffer();
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        filter.Q.setValueAtTime(1.5, ctx.currentTime);

        // Slow tide dynamic sweep: slow sweep on the gain
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.08, ctx.currentTime); // Sweeps every ~12 seconds
        
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.28, ctx.currentTime); // Sweep amplitude

        // Baseline shift so waves don't silence entirely
        const baselineGain = ctx.createGain();
        baselineGain.gain.setValueAtTime(0.35, ctx.currentTime);

        lfo.connect(lfoGain);
        
        source.connect(filter);
        filter.connect(baselineGain);
        
        // Modulate with wave LFO
        lfoGain.connect(baselineGain.gain);
        baselineGain.connect(targetGain);

        source.start();
        lfo.start();

        this.activeSources['waves'] = source;
        this.activeSources['waves_lfo'] = lfo;
        break;
      }

      case 'rain': {
        // --- 2. Pitter-Patter Contemplative Rain ---
        // Base steady rush: highpassed noise
        const source = ctx.createBufferSource();
        source.buffer = this.getNoiseBuffer();
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, ctx.currentTime);
        filter.Q.setValueAtTime(0.5, ctx.currentTime);

        const steadyGain = ctx.createGain();
        steadyGain.gain.setValueAtTime(0.45, ctx.currentTime);

        source.connect(filter);
        filter.connect(steadyGain);
        steadyGain.connect(targetGain);

        source.start();
        this.activeSources['rain'] = source;

        // Custom raindrop splatter scheduler: randomly trigger high-frequency clicks
        const triggerRaindrop = () => {
          if (!this.activeTimers['rain_active']) return;
          if (Math.random() > 0.45) return; // 45% trigger chance to sound scattering

          const osc = ctx.createOscillator();
          const dropGain = ctx.createGain();
          
          osc.type = 'sine';
          // Warm woody nature ticks
          osc.frequency.setValueAtTime(1800 + Math.random() * 2400, ctx.currentTime);

          dropGain.gain.setValueAtTime(0, ctx.currentTime);
          dropGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.005);
          dropGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

          osc.connect(dropGain);
          dropGain.connect(targetGain);

          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        };

        this.activeTimers['rain'] = setInterval(triggerRaindrop, 110);
        break;
      }

      case 'fireplace': {
        // --- 3. Crackling Fireplace Flame ---
        // Low cozy combustion rumble: lowpassed noise
        const roar = ctx.createBufferSource();
        roar.buffer = this.getNoiseBuffer();
        roar.loop = true;

        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(120, ctx.currentTime);

        const roarGain = ctx.createGain();
        roarGain.gain.setValueAtTime(0.55, ctx.currentTime);

        roar.connect(rumbleFilter);
        rumbleFilter.connect(roarGain);
        roarGain.connect(targetGain);

        roar.start();
        this.activeSources['fireplace'] = roar;

        // Fire cracking and wood popping scheduler
        const triggerCrack = () => {
          if (!this.activeTimers['fireplace_active']) return;
          const r = Math.random();
          
          // Crackle sound (high pitch click)
          if (r > 0.75) {
            const osc = ctx.createOscillator();
            const crackGain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(900 + Math.random() * 1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.02);

            crackGain.gain.setValueAtTime(0, ctx.currentTime);
            crackGain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.002);
            crackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

            osc.connect(crackGain);
            crackGain.connect(targetGain);

            osc.start();
            osc.stop(ctx.currentTime + 0.030);
          }
          
          // Deep hollow log pop (lower pitch spark bursting)
          if (r < 0.12) {
            const osc = ctx.createOscillator();
            const popGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150 + Math.random() * 180, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);

            popGain.gain.setValueAtTime(0, ctx.currentTime);
            popGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.005);
            popGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

            osc.connect(popGain);
            popGain.connect(targetGain);

            osc.start();
            osc.stop(ctx.currentTime + 0.07);
          }
        };

        this.activeTimers['fireplace'] = setInterval(triggerCrack, 160);
        break;
      }

      case 'crickets': {
        // --- 4. Cozy Autumn Crickets & Frogs (Highly Realistic Physical Modeling Synthesis) ---
        // Blends pure frequency insect wing friction chime, microscopic dry scrapes, 
        // and granular larynx vocal sac croak pulses for lifelike realism.
        const triggerInsects = () => {
          if (!this.activeTimers['crickets_active']) return;

          const now = ctx.currentTime;
          const r = Math.random();

          // 1. Organic Cricket Wing Friction (Glassy Resonance + Microdry Scrapes)
          if (r > 0.22) {
            const chirpCenter = 4400 + Math.random() * 300;
            // A trill of 4-5 rapid strokes (wing friction bursts)
            const strokeCount = 4 + Math.floor(Math.random() * 2);
            for (let i = 0; i < strokeCount; i++) {
              const startOffset = now + i * 0.07;
              
              // High frequency sine oscillator represents the pure insect chime frequency
              const osc = ctx.createOscillator();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(chirpCenter, startOffset);
              // Slight organic pitch slide
              osc.frequency.linearRampToValueAtTime(chirpCenter + 80, startOffset + 0.04);

              // Filtered dry noise to add physical scratchy wing friction texture
              const noiseSource = ctx.createBufferSource();
              noiseSource.buffer = this.getNoiseBuffer();
              
              const noiseFilter = ctx.createBiquadFilter();
              noiseFilter.type = 'bandpass';
              noiseFilter.frequency.setValueAtTime(chirpCenter, startOffset);
              noiseFilter.Q.setValueAtTime(22, startOffset);

              const strokeGain = ctx.createGain();
              strokeGain.gain.setValueAtTime(0, startOffset);
              strokeGain.gain.linearRampToValueAtTime(0.022, startOffset + 0.01);
              strokeGain.gain.exponentialRampToValueAtTime(0.0005, startOffset + 0.05);

              const noiseGain = ctx.createGain();
              noiseGain.gain.setValueAtTime(0.005, startOffset);
              noiseGain.gain.exponentialRampToValueAtTime(0.0001, startOffset + 0.05);

              // Connect pure tone and physical wing friction noise
              osc.connect(strokeGain);
              
              noiseSource.connect(noiseFilter);
              noiseFilter.connect(noiseGain);
              noiseGain.connect(strokeGain);
              
              strokeGain.connect(targetGain);

              osc.start(startOffset);
              osc.stop(startOffset + 0.055);

              noiseSource.start(startOffset);
              noiseSource.stop(startOffset + 0.055);
            }
          }

          // 2. Granular Pond Frogs (Larynx Vocal Sac Pulse Train)
          if (r < 0.52) {
            const frogStart = now + 0.4 + Math.random() * 0.4;
            const baseFreq = 82 + Math.random() * 14; // Deep pond frog base tone
            const pulseRate = 0.012; // 12ms pulses representing elastic voice cords
            const pulseCount = 12 + Math.floor(Math.random() * 6); // Overlapping sound wave bundle

            for (let i = 0; i < pulseCount; i++) {
              const pulseStart = frogStart + i * pulseRate;
              
              const osc = ctx.createOscillator();
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(baseFreq - (i * 0.75), pulseStart);

              // Formant bandpass mimics vocal sac resonance
              const formantFilter = ctx.createBiquadFilter();
              formantFilter.type = 'bandpass';
              formantFilter.frequency.setValueAtTime(450, pulseStart);
              formantFilter.Q.setValueAtTime(4.2, pulseStart);

              // Safe warmth low-pass to clean up synthetic highs
              const lpFilter = ctx.createBiquadFilter();
              lpFilter.type = 'lowpass';
              lpFilter.frequency.setValueAtTime(750, pulseStart);

              const pulseGain = ctx.createGain();
              pulseGain.gain.setValueAtTime(0, pulseStart);
              pulseGain.gain.linearRampToValueAtTime(0.038, pulseStart + 0.003);
              pulseGain.gain.exponentialRampToValueAtTime(0.0001, pulseStart + 0.015);

              osc.connect(formantFilter);
              formantFilter.connect(lpFilter);
              lpFilter.connect(pulseGain);
              pulseGain.connect(targetGain);

              osc.start(pulseStart);
              osc.stop(pulseStart + 0.018);
            }
          }
        };

        // Scheduled insect rhythm
        this.activeTimers['crickets'] = setInterval(triggerInsects, 1400);
        // Trigger once immediately
        setTimeout(triggerInsects, 50);
        break;
      }

      case 'birds': {
        // --- 5. Melodic Spiritual Forest Birds ---
        // Periodic gentle, natural melodic chirps in random patterns
        const triggerBirdChime = () => {
          if (!this.activeTimers['birds_active']) return;
          if (Math.random() > 0.6) return; // Keeps the forest sparse and tranquil

          const now = ctx.currentTime;
          const birdType = Math.floor(Math.random() * 3);

          if (birdType === 0) {
            // "Chirpy warbler": quick consecutive climbing notes
            const baseFreq = 2200 + Math.random() * 800;
            for (let i = 0; i < 3; i++) {
              const start = now + i * 0.15;
              const osc = ctx.createOscillator();
              const bGain = ctx.createGain();

              osc.type = 'sine';
              osc.frequency.setValueAtTime(baseFreq + (i * 300), start);
              osc.frequency.exponentialRampToValueAtTime(baseFreq + (i * 300) + 400, start + 0.08);

              bGain.gain.setValueAtTime(0, start);
              bGain.gain.linearRampToValueAtTime(0.07, start + 0.01);
              bGain.gain.exponentialRampToValueAtTime(0.001, start + 0.10);

              osc.connect(bGain);
              bGain.connect(targetGain);

              osc.start(start);
              osc.stop(start + 0.12);
            }
          } else if (birdType === 1) {
            // "Slow forest dove": soothing dual-note coo
            const doveFreq = 800 + Math.random() * 200;
            // Coo 1
            const osc1 = ctx.createOscillator();
            const bIndex1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(doveFreq, now);
            osc1.frequency.linearRampToValueAtTime(doveFreq - 50, now + 0.18);

            bIndex1.gain.setValueAtTime(0, now);
            bIndex1.gain.linearRampToValueAtTime(0.12, now + 0.04);
            bIndex1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc1.connect(bIndex1);
            bIndex1.connect(targetGain);
            osc1.start(now);
            osc1.stop(now + 0.25);

            // Coo 2 (slightly after, higher pitch)
            const osc2 = ctx.createOscillator();
            const bIndex2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(doveFreq + 100, now + 0.32);
            osc2.frequency.linearRampToValueAtTime(doveFreq + 20, now + 0.55);

            bIndex2.gain.setValueAtTime(0, now + 0.32);
            bIndex2.gain.linearRampToValueAtTime(0.1, now + 0.38);
            bIndex2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            osc2.connect(bIndex2);
            bIndex2.connect(targetGain);
            osc2.start(now + 0.32);
            osc2.stop(now + 0.65);
          } else {
            // "Trilling sparrow": rapid high frequency flutter
            const trillFreq = 3100 + Math.random() * 500;
            const trillSpeed = 0.04;
            for (let i = 0; i < 6; i++) {
              const start = now + i * trillSpeed;
              const osc = ctx.createOscillator();
              const bGain = ctx.createGain();

              osc.type = 'sine';
              osc.frequency.setValueAtTime(trillFreq + (Math.sin(i) * 200), start);

              bGain.gain.setValueAtTime(0, start);
              bGain.gain.linearRampToValueAtTime(0.05, start + 0.01);
              bGain.gain.exponentialRampToValueAtTime(0.001, start + trillSpeed);

              osc.connect(bGain);
              bGain.connect(targetGain);

              osc.start(start);
              osc.stop(start + trillSpeed + 0.01);
            }
          }
        };

        this.activeTimers['birds'] = setInterval(triggerBirdChime, 3800);
        // Spark first tweet immediately
        setTimeout(triggerBirdChime, 400);
        break;
      }

      case 'wind': {
        // --- 6. Tree leaves whispering wind ---
        // Bandpass filtered white noise with slow sweeping center frequencies and volumes
        const source = ctx.createBufferSource();
        source.buffer = this.getNoiseBuffer();
        source.loop = true;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(320, ctx.currentTime);
        bandpass.Q.setValueAtTime(1.0, ctx.currentTime);

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0.3, ctx.currentTime);

        // Slowly modulate bandpass frequency and volume using LFOs
        const freqLFO = ctx.createOscillator();
        freqLFO.frequency.setValueAtTime(0.05, ctx.currentTime); // very slow cycle (20s)
        const lfoFreqGain = ctx.createGain();
        lfoFreqGain.gain.setValueAtTime(110, ctx.currentTime); // Modulates center frequency between 210Hz and 430Hz

        const gainLFO = ctx.createOscillator();
        gainLFO.frequency.setValueAtTime(0.038, ctx.currentTime); // offset cycle speed to create organic drift
        const lfoGainGain = ctx.createGain();
        lfoGainGain.gain.setValueAtTime(0.24, ctx.currentTime);

        // Mix
        freqLFO.connect(lfoFreqGain);
        lfoFreqGain.connect(bandpass.frequency);

        gainLFO.connect(lfoGainGain);
        lfoGainGain.connect(windGain.gain);

        source.connect(bandpass);
        bandpass.connect(windGain);
        windGain.connect(targetGain);

        source.start();
        freqLFO.start();
        gainLFO.start();

        this.activeSources['wind'] = source;
        this.activeSources['wind_lfo_f'] = freqLFO;
        this.activeSources['wind_lfo_g'] = gainLFO;
        break;
      }
    }
  }

  /**
   * Procedural synthesis of incredibly gentle, sweet, warm, spiritual ambient piano notes.
   * Emulates a slow, sparse acoustic parlor piano with long sustain-pedal resonances.
   * Completely immune to CORS, offline-friendly, zero network dependencies.
   */
  private startSynth() {
    if (this.isSynthPlaying) return;
    this.isSynthPlaying = true;
    this.initAudioContext();

    try {
      // Simulates an acoustic piano key strike with hammer-velocity attack and long sustained release
      const playPianoKey = (freq: number, delay: number, duration: number) => {
        if (!this.audioContext || this.audioContext.state === 'suspended') return;

        const now = this.audioContext.currentTime;
        const triggerTime = now + delay;

        // Combine Sine (purity) and Triangle (organic string strike)
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        
        const gainNote = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, triggerTime);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, triggerTime); // Octave overtone

        // Lowpass filter makes the tone thick, warm, and celestial (takes away synthetic buzz)
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, triggerTime);
        // Emulate string dampening: slowly lower the filter frequency over the course of the note
        filter.frequency.exponentialRampToValueAtTime(150, triggerTime + duration);

        // Envelope simulator for genuine piano physical modeling:
        // 1. Zero initial volume
        gainNote.gain.setValueAtTime(0, triggerTime);
        // 2. High initial hammer strike (quick attack)
        gainNote.gain.linearRampToValueAtTime(this.currentVolume * 0.22, triggerTime + 0.05);
        // 3. Quick drop to soft release (emulates soundboard dynamic)
        gainNote.gain.setValueAtTime(this.currentVolume * 0.12, triggerTime + 0.15);
        // 4. Soft, warm decay down over 7-9 seconds (sustain pedal pressed)
        gainNote.gain.exponentialRampToValueAtTime(0.001, triggerTime + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        
        // Connect the overtone track slightly softer
        const osc2Gain = this.audioContext.createGain();
        osc2Gain.gain.setValueAtTime(0.2, triggerTime);
        osc2.disconnect(filter);
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);

        filter.connect(gainNote);
        gainNote.connect(this.audioContext.destination);

        osc1.start(triggerTime);
        osc1.stop(triggerTime + duration + 0.1);
        
        osc2.start(triggerTime);
        osc2.stop(triggerTime + duration + 0.1);
      };

      // Peaceful, relaxing major-seventh & ninth devotional intervals (C4, E4, G4, B4, D5)
      const scale = [261.63, 329.63, 392.00, 493.88, 587.33, 523.25];
      const triggerAmbience = () => {
        if (!this.isEnabled) return;
        
        // Pick individual soothing notes, playing them with absolute space (one after another)
        const root = scale[Math.floor(Math.random() * scale.length)];
        const third = scale[(Math.floor(Math.random() * scale.length) + 1) % scale.length];
        
        // Slow sparse single keys playing slowly side-by-side with 2-3s delay, like a sleepy piano
        playPianoKey(root / 2, 0, 7.5); // Warm deep bass drone key
        playPianoKey(third, 2.5, 6.0);  // Higher delicate melody key
        
        if (Math.random() > 0.4) {
          const fifth = scale[(Math.floor(Math.random() * scale.length) + 2) % scale.length];
          playPianoKey(fifth, 4.8, 5.0); // Slow lingering third note
        }
      };

      triggerAmbience();
      // Emulate ultra-slow contemplative cycles: a new sparse set of notes every 10 seconds
      this.synthInterval = setInterval(triggerAmbience, 9500);
    } catch (e) {
      console.error("Synthesizer initialization failed:", e);
    }
  }

  private stopSynth() {
    this.isSynthPlaying = false;
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }
}

export const globalAudioService = new AudioService();
