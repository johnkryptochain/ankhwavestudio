// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * PeakController - Envelope follower for automation control
 * Based on original AnkhWaveStudio PeakController plugin
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp, calculateRMS, calculatePeak } from '../utils/AudioMath';

/**
 * PeakController effect - envelope follower that outputs control signal
 */
export class PeakController extends BaseEffect {
  // Analysis
  private analyser: AnalyserNode;
  private analyserBuffer: Float32Array;
  
  // Envelope state
  private currentEnvelope: number = 0;
  private peakEnvelope: number = 0;
  
  // Output control value (0-1)
  private outputValue: number = 0;
  
  // Mute output option
  private muteOutput: boolean = false;
  private muteGain: GainNode;
  
  // Callbacks for automation
  private automationCallbacks: ((value: number) => void)[] = [];
  
  // Processing interval
  private processingInterval: number | null = null;
  private lastProcessTime: number = 0;

  constructor(audioContext: AudioContext, id: string, name: string = 'PeakController') {
    super(audioContext, id, name, 'peakcontroller');
    
    // Create analyser
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.analyserBuffer = new Float32Array(this.analyser.fftSize);
    
    // Create mute gain
    this.muteGain = audioContext.createGain();
    
    this.initializeEffect();
    this.setupRouting();
    this.startProcessing();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    this.params = {
      attack: 0.01,      // Attack time in seconds
      release: 0.1,      // Release time in seconds
      threshold: 0,      // Threshold in dB (-60 to 0)
      amount: 1,         // Output amount/depth (0-1)
      tilt: 0,           // Tilt: -1 = bass, 0 = flat, 1 = treble
      muteOutput: 0,     // Mute audio output (0 or 1)
      invert: 0,         // Invert output (0 or 1)
      absolute: 1        // Use absolute value (0 or 1)
    };
    
    this.applyAllParameters();
  }

  private setupRouting(): void {
    // Input -> Analyser (for envelope detection)
    this.inputNode.connect(this.analyser);
    
    // Input -> Mute Gain -> Wet -> Output
    this.inputNode.connect(this.muteGain);
    this.muteGain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private applyAllParameters(): void {
    const t = this.audioContext.currentTime;
    
    // Apply mute
    this.muteOutput = this.params.muteOutput > 0.5;
    this.muteGain.gain.setTargetAtTime(this.muteOutput ? 0 : 1, t, 0.01);
  }

  private startProcessing(): void {
    // Process envelope at regular intervals
    const processEnvelope = () => {
      const now = performance.now();
      const deltaTime = (now - this.lastProcessTime) / 1000;
      this.lastProcessTime = now;
      
      if (deltaTime <= 0 || deltaTime > 1) {
        this.processingInterval = requestAnimationFrame(processEnvelope);
        return;
      }
      
      // Get time domain data
      this.analyser.getFloatTimeDomainData(this.analyserBuffer as Float32Array<ArrayBuffer>);
      
      // Calculate input level
      let inputLevel: number;
      if (this.params.absolute > 0.5) {
        inputLevel = calculatePeak(this.analyserBuffer);
      } else {
        inputLevel = calculateRMS(this.analyserBuffer);
      }
      
      // Apply tilt (simple high/low shelf approximation)
      // This is a simplified version - real implementation would use filters
      const tilt = this.params.tilt;
      if (tilt !== 0) {
        // Analyze frequency content
        const lowSum = this.analyserBuffer.slice(0, this.analyserBuffer.length / 4)
          .reduce((sum, v) => sum + Math.abs(v), 0);
        const highSum = this.analyserBuffer.slice(this.analyserBuffer.length * 3 / 4)
          .reduce((sum, v) => sum + Math.abs(v), 0);
        
        const lowLevel = lowSum / (this.analyserBuffer.length / 4);
        const highLevel = highSum / (this.analyserBuffer.length / 4);
        
        // Blend based on tilt
        if (tilt < 0) {
          inputLevel = inputLevel * (1 + tilt) + lowLevel * (-tilt);
        } else {
          inputLevel = inputLevel * (1 - tilt) + highLevel * tilt;
        }
      }
      
      // Apply threshold
      const thresholdLinear = Math.pow(10, this.params.threshold / 20);
      inputLevel = Math.max(0, inputLevel - thresholdLinear);
      
      // Apply envelope follower (attack/release)
      const attack = Math.max(0.001, this.params.attack);
      const release = Math.max(0.001, this.params.release);
      
      if (inputLevel > this.currentEnvelope) {
        // Attack
        const attackCoeff = 1 - Math.exp(-deltaTime / attack);
        this.currentEnvelope += (inputLevel - this.currentEnvelope) * attackCoeff;
      } else {
        // Release
        const releaseCoeff = 1 - Math.exp(-deltaTime / release);
        this.currentEnvelope += (inputLevel - this.currentEnvelope) * releaseCoeff;
      }
      
      // Track peak
      if (this.currentEnvelope > this.peakEnvelope) {
        this.peakEnvelope = this.currentEnvelope;
      } else {
        this.peakEnvelope *= 0.999; // Slow decay
      }
      
      // Calculate output value
      let output = clamp(this.currentEnvelope * this.params.amount, 0, 1);
      
      // Apply invert
      if (this.params.invert > 0.5) {
        output = 1 - output;
      }
      
      this.outputValue = output;
      
      // Notify automation callbacks
      for (const callback of this.automationCallbacks) {
        try {
          callback(this.outputValue);
        } catch (e) {
          console.error('PeakController automation callback error:', e);
        }
      }
      
      this.processingInterval = requestAnimationFrame(processEnvelope);
    };
    
    this.lastProcessTime = performance.now();
    this.processingInterval = requestAnimationFrame(processEnvelope);
  }

  private stopProcessing(): void {
    if (this.processingInterval !== null) {
      cancelAnimationFrame(this.processingInterval);
      this.processingInterval = null;
    }
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Attack', key: 'attack', min: 0.001, max: 1, default: 0.01, unit: 's', type: 'logarithmic' },
      { name: 'Release', key: 'release', min: 0.001, max: 2, default: 0.1, unit: 's', type: 'logarithmic' },
      { name: 'Threshold', key: 'threshold', min: -60, max: 0, default: 0, unit: 'dB', type: 'linear' },
      { name: 'Amount', key: 'amount', min: 0, max: 2, default: 1, type: 'linear' },
      { name: 'Tilt', key: 'tilt', min: -1, max: 1, default: 0, type: 'linear' },
      { name: 'Mute Output', key: 'muteOutput', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Invert', key: 'invert', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Absolute', key: 'absolute', min: 0, max: 1, default: 1, type: 'boolean' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    this.applyAllParameters();
  }

  /**
   * Get current output value (0-1)
   */
  getOutputValue(): number {
    return this.outputValue;
  }

  /**
   * Get current envelope level
   */
  getEnvelopeLevel(): number {
    return this.currentEnvelope;
  }

  /**
   * Get peak envelope level
   */
  getPeakLevel(): number {
    return this.peakEnvelope;
  }

  /**
   * Reset peak level
   */
  resetPeak(): void {
    this.peakEnvelope = 0;
  }

  /**
   * Register automation callback
   * Called whenever the output value changes
   */
  onAutomation(callback: (value: number) => void): () => void {
    this.automationCallbacks.push(callback);
    return () => {
      const index = this.automationCallbacks.indexOf(callback);
      if (index !== -1) {
        this.automationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Set attack time
   */
  setAttack(seconds: number): void {
    this.setParameter('attack', seconds);
  }

  /**
   * Set release time
   */
  setRelease(seconds: number): void {
    this.setParameter('release', seconds);
  }

  /**
   * Set threshold in dB
   */
  setThreshold(dB: number): void {
    this.setParameter('threshold', dB);
  }

  /**
   * Set output amount
   */
  setAmount(amount: number): void {
    this.setParameter('amount', amount);
  }

  /**
   * Set tilt (-1 = bass, 0 = flat, 1 = treble)
   */
  setTilt(tilt: number): void {
    this.setParameter('tilt', tilt);
  }

  /**
   * Set mute output
   */
  setMuteOutput(mute: boolean): void {
    this.setParameter('muteOutput', mute ? 1 : 0);
  }

  /**
   * Toggle mute output
   */
  toggleMuteOutput(): boolean {
    const newValue = this.params.muteOutput > 0.5 ? 0 : 1;
    this.setParameter('muteOutput', newValue);
    return newValue > 0.5;
  }

  /**
   * Set invert
   */
  setInvert(invert: boolean): void {
    this.setParameter('invert', invert ? 1 : 0);
  }

  private addDefaultPresets(): void {
    this.addPreset({
      name: 'Fast Response',
      params: { attack: 0.005, release: 0.05, threshold: -20, amount: 1, tilt: 0 }
    });
    
    this.addPreset({
      name: 'Slow Response',
      params: { attack: 0.1, release: 0.5, threshold: -30, amount: 1, tilt: 0 }
    });
    
    this.addPreset({
      name: 'Bass Follower',
      params: { attack: 0.02, release: 0.1, threshold: -20, amount: 1, tilt: -0.8 }
    });
    
    this.addPreset({
      name: 'Treble Follower',
      params: { attack: 0.005, release: 0.05, threshold: -20, amount: 1, tilt: 0.8 }
    });
    
    this.addPreset({
      name: 'Ducking',
      params: { attack: 0.01, release: 0.2, threshold: -20, amount: 1, invert: 1 }
    });
  }

  dispose(): void {
    this.stopProcessing();
    this.automationCallbacks = [];
    
    super.dispose();
    
    this.analyser.disconnect();
    this.muteGain.disconnect();
  }
}