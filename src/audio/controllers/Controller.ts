// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Base Controller Class
 * Represents a modulation source in the audio engine
 */

export abstract class Controller {
  protected id: string;
  protected enabled: boolean = true;
  protected sampleRate: number = 44100;

  constructor(id: string, sampleRate: number) {
    this.id = id;
    this.sampleRate = sampleRate;
  }

  public getId(): string {
    return this.id;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  /**
   * Get the current value of the controller
   * @param time Current audio time
   * @returns A value typically between 0 and 1 (or -1 and 1)
   */
  public abstract getValue(time: number): number;

  /**
   * Process a block of audio (for optimization)
   * @param startTime Start time of the block
   * @param blockSize Number of samples
   * @returns Float32Array of values
   */
  public getValues(startTime: number, blockSize: number): Float32Array {
    const values = new Float32Array(blockSize);
    const dt = 1 / this.sampleRate;
    for (let i = 0; i < blockSize; i++) {
      values[i] = this.getValue(startTime + i * dt);
    }
    return values;
  }
}
