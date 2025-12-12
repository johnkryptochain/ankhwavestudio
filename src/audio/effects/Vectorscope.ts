// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Vectorscope - Stereo Phase Visualization
 * Displays stereo signal as X-Y Lissajous pattern
 * 
 * Features:
 * - X-Y display (Lissajous pattern)
 * - Stereo phase visualization
 * - Color options
 * - Persistence control
 */

import { BaseEffect, type EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * Vectorscope display mode
 */
export enum VectorscopeMode {
  Lissajous = 'lissajous',
  Polar = 'polar'
}

/**
 * Vectorscope color scheme
 */
export enum VectorscopeColorScheme {
  Green = 'green',
  Blue = 'blue',
  White = 'white',
  Rainbow = 'rainbow'
}

// ============================================================================
// Vectorscope Effect
// ============================================================================

export class Vectorscope extends BaseEffect {
  // Parameters
  private zoom: number = 1;
  private persistence: number = 0.5;
  private mode: VectorscopeMode = VectorscopeMode.Lissajous;
  private colorScheme: VectorscopeColorScheme = VectorscopeColorScheme.Green;
  private rotation: number = 45; // degrees
  
  // Audio analysis
  private analyserLeft: AnalyserNode;
  private analyserRight: AnalyserNode;
  private splitter: ChannelSplitterNode;
  
  // Data buffers
  private bufferSize: number = 2048;
  private leftData: Float32Array<ArrayBuffer>;
  private rightData: Float32Array<ArrayBuffer>;
  
  // Canvas for visualization
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrame: number | null = null;
  
  // History for persistence
  private historyBuffer: ImageData | null = null;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'Vectorscope', 'vectorscope');
    
    // Create channel splitter
    this.splitter = audioContext.createChannelSplitter(2);
    
    // Create analysers for left and right channels
    this.analyserLeft = audioContext.createAnalyser();
    this.analyserLeft.fftSize = this.bufferSize;
    this.analyserLeft.smoothingTimeConstant = 0;
    
    this.analyserRight = audioContext.createAnalyser();
    this.analyserRight.fftSize = this.bufferSize;
    this.analyserRight.smoothingTimeConstant = 0;
    
    // Create data buffers
    this.leftData = new Float32Array(this.bufferSize) as Float32Array<ArrayBuffer>;
    this.rightData = new Float32Array(this.bufferSize) as Float32Array<ArrayBuffer>;
    
    // Connect signal path
    this.inputNode.connect(this.splitter);
    this.splitter.connect(this.analyserLeft, 0);
    this.splitter.connect(this.analyserRight, 1);
    
    // Pass through to output (vectorscope is a visualization, not a processor)
    this.inputNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Initialize
    this.initializeEffect();
  }
  
  /**
   * Set canvas for visualization
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    if (this.ctx) {
      // Initialize history buffer
      this.historyBuffer = this.ctx.createImageData(canvas.width, canvas.height);
    }
    
    // Start animation
    this.startAnimation();
  }
  
  /**
   * Start animation loop
   */
  private startAnimation(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    const animate = () => {
      this.draw();
      this.animationFrame = requestAnimationFrame(animate);
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }
  
  /**
   * Stop animation loop
   */
  private stopAnimation(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
  
  /**
   * Draw vectorscope
   */
  private draw(): void {
    if (!this.canvas || !this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / 2 * 0.9 * this.zoom;
    
    // Get audio data
    this.analyserLeft.getFloatTimeDomainData(this.leftData);
    this.analyserRight.getFloatTimeDomainData(this.rightData);
    
    // Apply persistence (fade previous frame)
    if (this.persistence > 0 && this.historyBuffer) {
      const fadeAmount = 1 - this.persistence * 0.1;
      const imageData = this.ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] *= fadeAmount;     // R
        data[i + 1] *= fadeAmount; // G
        data[i + 2] *= fadeAmount; // B
      }
      
      this.ctx.putImageData(imageData, 0, 0);
    } else {
      // Clear canvas
      this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      this.ctx.fillRect(0, 0, width, height);
    }
    
    // Draw grid
    this.drawGrid(centerX, centerY, scale);
    
    // Draw signal
    this.drawSignal(centerX, centerY, scale);
  }
  
  /**
   * Draw grid
   */
  private drawGrid(centerX: number, centerY: number, scale: number): void {
    if (!this.ctx) return;
    
    this.ctx.strokeStyle = 'rgba(50, 50, 50, 0.5)';
    this.ctx.lineWidth = 1;
    
    // Draw circles
    for (let r = 0.25; r <= 1; r += 0.25) {
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, scale * r, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    // Draw axes
    const rotRad = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);
    
    // L axis
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - scale * cos, centerY - scale * sin);
    this.ctx.lineTo(centerX + scale * cos, centerY + scale * sin);
    this.ctx.stroke();
    
    // R axis
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - scale * sin, centerY + scale * cos);
    this.ctx.lineTo(centerX + scale * sin, centerY - scale * cos);
    this.ctx.stroke();
    
    // Labels
    this.ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
    this.ctx.font = '12px sans-serif';
    this.ctx.fillText('L', centerX - scale * cos - 15, centerY - scale * sin);
    this.ctx.fillText('R', centerX + scale * sin + 5, centerY - scale * cos);
    this.ctx.fillText('+', centerX, centerY - scale - 5);
    this.ctx.fillText('-', centerX, centerY + scale + 15);
  }
  
  /**
   * Draw signal
   */
  private drawSignal(centerX: number, centerY: number, scale: number): void {
    if (!this.ctx) return;
    
    const rotRad = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);
    
    // Set color based on scheme
    const color = this.getSignalColor();
    
    this.ctx.fillStyle = color;
    
    // Draw points
    for (let i = 0; i < this.bufferSize; i++) {
      const left = this.leftData[i];
      const right = this.rightData[i];
      
      // Calculate X-Y position
      let x: number, y: number;
      
      if (this.mode === VectorscopeMode.Lissajous) {
        // Standard Lissajous: L on one axis, R on other
        // Rotated 45 degrees so mono appears vertical
        x = (left - right) * cos - (left + right) * sin;
        y = (left - right) * sin + (left + right) * cos;
      } else {
        // Polar mode
        const mid = (left + right) / 2;
        const side = (left - right) / 2;
        x = side;
        y = mid;
      }
      
      // Scale and center
      const px = centerX + x * scale;
      const py = centerY - y * scale;
      
      // Draw point
      if (this.colorScheme === VectorscopeColorScheme.Rainbow) {
        // Color based on position
        const hue = (Math.atan2(y, x) * 180 / Math.PI + 180) % 360;
        this.ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.5)`;
      }
      
      this.ctx.fillRect(px, py, 2, 2);
    }
  }
  
  /**
   * Get signal color based on color scheme
   */
  private getSignalColor(): string {
    switch (this.colorScheme) {
      case VectorscopeColorScheme.Green:
        return 'rgba(0, 255, 0, 0.5)';
      case VectorscopeColorScheme.Blue:
        return 'rgba(0, 150, 255, 0.5)';
      case VectorscopeColorScheme.White:
        return 'rgba(255, 255, 255, 0.5)';
      case VectorscopeColorScheme.Rainbow:
        return 'rgba(255, 255, 255, 0.5)'; // Will be overridden per-point
      default:
        return 'rgba(0, 255, 0, 0.5)';
    }
  }
  
  /**
   * Get stereo correlation (-1 to 1)
   * -1 = out of phase, 0 = uncorrelated, 1 = mono
   */
  getCorrelation(): number {
    let sumLR = 0;
    let sumL2 = 0;
    let sumR2 = 0;
    
    for (let i = 0; i < this.bufferSize; i++) {
      const left = this.leftData[i];
      const right = this.rightData[i];
      sumLR += left * right;
      sumL2 += left * left;
      sumR2 += right * right;
    }
    
    const denominator = Math.sqrt(sumL2 * sumR2);
    if (denominator === 0) return 0;
    
    return sumLR / denominator;
  }
  
  /**
   * Get stereo width (0 to 1)
   */
  getStereoWidth(): number {
    let sumMid = 0;
    let sumSide = 0;
    
    for (let i = 0; i < this.bufferSize; i++) {
      const left = this.leftData[i];
      const right = this.rightData[i];
      const mid = (left + right) / 2;
      const side = (left - right) / 2;
      sumMid += mid * mid;
      sumSide += side * side;
    }
    
    const total = sumMid + sumSide;
    if (total === 0) return 0;
    
    return sumSide / total;
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'zoom':
        this.zoom = value;
        break;
      case 'persistence':
        this.persistence = value;
        break;
      case 'mode':
        this.mode = value === 0 ? VectorscopeMode.Lissajous : VectorscopeMode.Polar;
        break;
      case 'colorScheme':
        const schemes = Object.values(VectorscopeColorScheme);
        this.colorScheme = schemes[Math.floor(value)] || VectorscopeColorScheme.Green;
        break;
      case 'rotation':
        this.rotation = value;
        break;
    }
  }
  
  /**
   * Initialize effect
   */
  protected initializeEffect(): void {
    this.params['zoom'] = this.zoom;
    this.params['persistence'] = this.persistence;
    this.params['mode'] = 0;
    this.params['colorScheme'] = 0;
    this.params['rotation'] = this.rotation;
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Zoom', key: 'zoom', min: 0.5, max: 4, default: 1 },
      { name: 'Persistence', key: 'persistence', min: 0, max: 1, default: 0.5 },
      { name: 'Mode', key: 'mode', min: 0, max: 1, default: 0, step: 1, type: 'enum', enumValues: ['Lissajous', 'Polar'] },
      { name: 'Color Scheme', key: 'colorScheme', min: 0, max: 3, default: 0, step: 1, type: 'enum', enumValues: ['Green', 'Blue', 'White', 'Rainbow'] },
      { name: 'Rotation', key: 'rotation', min: 0, max: 90, default: 45, unit: '°' }
    ];
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    this.stopAnimation();
    this.splitter.disconnect();
    this.analyserLeft.disconnect();
    this.analyserRight.disconnect();
    
    super.dispose();
  }
}

// Factory function
export function createVectorscope(audioContext: AudioContext, id?: string): Vectorscope {
  return new Vectorscope(audioContext, id || `vectorscope-${Date.now()}`);
}