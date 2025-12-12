/* Copyright (c) 2025 Jema Technology.
 * Distributed under the license specified in the root directory of this project.
 */
/**
 * WASM Instrument Plugin Template
 * 
 * This is a template for creating synthesizer/instrument plugins for AnkhWaveStudio.
 * Compile with Emscripten:
 * 
 * emcc instrument_template.c -o my_synth.wasm \
 *   -s WASM=1 \
 *   -s EXPORTED_FUNCTIONS='["_init","_process","_dispose","_reset","_getParameterCount","_getParameter","_setParameter","_noteOn","_noteOff","_controlChange","_pitchBend","_malloc","_free"]' \
 *   -s ALLOW_MEMORY_GROWTH=1 \
 *   -O3 \
 *   -lm
 */

#include <stdlib.h>
#include <string.h>
#include <math.h>

// ============================================================================
// Configuration
// ============================================================================

#define MAX_VOICES 16
#define NUM_CHANNELS 2
#define NUM_PARAMETERS 8
#define PI 3.14159265358979323846f
#define TWO_PI (2.0f * PI)

// ============================================================================
// Waveform Types
// ============================================================================

typedef enum {
    WAVE_SINE = 0,
    WAVE_SQUARE,
    WAVE_SAW,
    WAVE_TRIANGLE,
    WAVE_NOISE
} WaveformType;

// ============================================================================
// Voice Structure
// ============================================================================

typedef struct {
    int active;
    int note;
    float velocity;
    float phase;
    float phaseIncrement;
    
    // Envelope
    float envelope;
    int envStage; // 0=off, 1=attack, 2=decay, 3=sustain, 4=release
    float envTarget;
    
    // Filter
    float filterState[2]; // 2-pole filter
    
    // Modulation
    float lfoPhase;
} Voice;

// ============================================================================
// Plugin State
// ============================================================================

static float sampleRate = 44100.0f;
static int bufferSize = 128;

// Voices
static Voice voices[MAX_VOICES];

// Parameters
static float params[NUM_PARAMETERS] = {
    0.0f,   // 0: Waveform (0-4)
    0.01f,  // 1: Attack (0.001-2)
    0.1f,   // 2: Decay (0.001-2)
    0.7f,   // 3: Sustain (0-1)
    0.3f,   // 4: Release (0.001-5)
    5000.0f,// 5: Filter Cutoff (20-20000)
    0.3f,   // 6: Filter Resonance (0-1)
    0.0f    // 7: Detune (-1 to 1 semitones)
};

// Global state
static float masterVolume = 0.8f;
static float pitchBendValue = 0.0f; // -1 to 1, representing -2 to +2 semitones
static float modWheel = 0.0f;

// ============================================================================
// Helper Functions
// ============================================================================

static inline float clamp(float value, float min, float max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

static inline float noteToFrequency(int note) {
    return 440.0f * powf(2.0f, (note - 69) / 12.0f);
}

static inline float frequencyToPhaseIncrement(float freq) {
    return freq / sampleRate;
}

// Polyblep for anti-aliased waveforms
static inline float polyblep(float t, float dt) {
    if (t < dt) {
        t /= dt;
        return t + t - t * t - 1.0f;
    } else if (t > 1.0f - dt) {
        t = (t - 1.0f) / dt;
        return t * t + t + t + 1.0f;
    }
    return 0.0f;
}

// Simple noise generator
static unsigned int noiseState = 12345;
static inline float noise() {
    noiseState = noiseState * 1103515245 + 12345;
    return ((noiseState >> 16) & 0x7FFF) / 16383.5f - 1.0f;
}

// ============================================================================
// Oscillator
// ============================================================================

static float generateOscillator(Voice* v, WaveformType waveform) {
    float t = v->phase;
    float dt = v->phaseIncrement;
    float sample = 0.0f;
    
    switch (waveform) {
        case WAVE_SINE:
            sample = sinf(t * TWO_PI);
            break;
            
        case WAVE_SQUARE:
            sample = t < 0.5f ? 1.0f : -1.0f;
            sample -= polyblep(t, dt);
            sample += polyblep(fmodf(t + 0.5f, 1.0f), dt);
            break;
            
        case WAVE_SAW:
            sample = 2.0f * t - 1.0f;
            sample -= polyblep(t, dt);
            break;
            
        case WAVE_TRIANGLE:
            sample = 4.0f * fabsf(t - 0.5f) - 1.0f;
            break;
            
        case WAVE_NOISE:
            sample = noise();
            break;
    }
    
    // Advance phase
    v->phase += dt;
    if (v->phase >= 1.0f) {
        v->phase -= 1.0f;
    }
    
    return sample;
}

// ============================================================================
// Envelope
// ============================================================================

static void updateEnvelope(Voice* v) {
    float attack = params[1];
    float decay = params[2];
    float sustain = params[3];
    float release = params[4];
    
    float rate;
    
    switch (v->envStage) {
        case 1: // Attack
            rate = 1.0f / (attack * sampleRate);
            v->envelope += rate;
            if (v->envelope >= 1.0f) {
                v->envelope = 1.0f;
                v->envStage = 2;
            }
            break;
            
        case 2: // Decay
            rate = (1.0f - sustain) / (decay * sampleRate);
            v->envelope -= rate;
            if (v->envelope <= sustain) {
                v->envelope = sustain;
                v->envStage = 3;
            }
            break;
            
        case 3: // Sustain
            // Hold at sustain level
            break;
            
        case 4: // Release
            rate = v->envelope / (release * sampleRate);
            v->envelope -= rate;
            if (v->envelope <= 0.001f) {
                v->envelope = 0.0f;
                v->envStage = 0;
                v->active = 0;
            }
            break;
    }
}

// ============================================================================
// Filter (State Variable Filter)
// ============================================================================

static float processFilter(Voice* v, float input) {
    float cutoff = params[5];
    float resonance = params[6];
    
    // Modulate cutoff with envelope
    float envMod = v->envelope * 0.5f;
    cutoff = cutoff * (1.0f + envMod);
    cutoff = clamp(cutoff, 20.0f, 20000.0f);
    
    // Calculate filter coefficients
    float f = 2.0f * sinf(PI * cutoff / sampleRate);
    float q = 1.0f - resonance * 0.9f;
    
    // State variable filter
    float low = v->filterState[1] + f * v->filterState[0];
    float high = input - low - q * v->filterState[0];
    float band = f * high + v->filterState[0];
    
    v->filterState[0] = band;
    v->filterState[1] = low;
    
    return low; // Lowpass output
}

// ============================================================================
// Core Functions
// ============================================================================

void init(float sr, int bs) {
    sampleRate = sr;
    bufferSize = bs;
    
    // Initialize voices
    for (int i = 0; i < MAX_VOICES; i++) {
        voices[i].active = 0;
        voices[i].note = 0;
        voices[i].velocity = 0.0f;
        voices[i].phase = 0.0f;
        voices[i].phaseIncrement = 0.0f;
        voices[i].envelope = 0.0f;
        voices[i].envStage = 0;
        voices[i].filterState[0] = 0.0f;
        voices[i].filterState[1] = 0.0f;
        voices[i].lfoPhase = 0.0f;
    }
}

void process(float* input, float* output, int numSamples) {
    WaveformType waveform = (WaveformType)(int)params[0];
    float detune = params[7];
    
    // Clear output buffer
    memset(output, 0, numSamples * NUM_CHANNELS * sizeof(float));
    
    for (int i = 0; i < numSamples; i++) {
        float sample = 0.0f;
        
        for (int v = 0; v < MAX_VOICES; v++) {
            if (!voices[v].active) continue;
            
            // Update pitch with pitch bend and detune
            float freq = noteToFrequency(voices[v].note);
            float bendSemitones = pitchBendValue * 2.0f; // +/- 2 semitones
            float totalDetune = bendSemitones + detune;
            freq *= powf(2.0f, totalDetune / 12.0f);
            voices[v].phaseIncrement = frequencyToPhaseIncrement(freq);
            
            // Generate oscillator
            float osc = generateOscillator(&voices[v], waveform);
            
            // Apply filter
            float filtered = processFilter(&voices[v], osc);
            
            // Apply envelope
            float voiced = filtered * voices[v].envelope * voices[v].velocity;
            
            // Update envelope
            updateEnvelope(&voices[v]);
            
            sample += voiced;
        }
        
        // Apply master volume
        sample *= masterVolume;
        
        // Soft clip
        sample = tanhf(sample);
        
        // Output stereo
        output[i * NUM_CHANNELS] = sample;
        output[i * NUM_CHANNELS + 1] = sample;
    }
}

void reset() {
    for (int i = 0; i < MAX_VOICES; i++) {
        voices[i].active = 0;
        voices[i].envelope = 0.0f;
        voices[i].envStage = 0;
        voices[i].filterState[0] = 0.0f;
        voices[i].filterState[1] = 0.0f;
    }
    pitchBendValue = 0.0f;
    modWheel = 0.0f;
}

void dispose() {
    // Nothing to free in this simple implementation
}

// ============================================================================
// MIDI Functions
// ============================================================================

void noteOn(int note, int velocity, int channel) {
    if (velocity == 0) {
        noteOff(note, channel);
        return;
    }
    
    // Find free voice or steal oldest
    int voiceIndex = -1;
    float oldestTime = 0.0f;
    int oldestIndex = 0;
    
    for (int i = 0; i < MAX_VOICES; i++) {
        if (!voices[i].active) {
            voiceIndex = i;
            break;
        }
        // Track oldest for voice stealing
        if (voices[i].envelope < oldestTime || i == 0) {
            oldestTime = voices[i].envelope;
            oldestIndex = i;
        }
    }
    
    // Steal oldest voice if no free voice
    if (voiceIndex == -1) {
        voiceIndex = oldestIndex;
    }
    
    // Initialize voice
    Voice* v = &voices[voiceIndex];
    v->active = 1;
    v->note = note;
    v->velocity = velocity / 127.0f;
    v->phase = 0.0f;
    v->phaseIncrement = frequencyToPhaseIncrement(noteToFrequency(note));
    v->envelope = 0.0f;
    v->envStage = 1; // Attack
    v->filterState[0] = 0.0f;
    v->filterState[1] = 0.0f;
}

void noteOff(int note, int channel) {
    for (int i = 0; i < MAX_VOICES; i++) {
        if (voices[i].active && voices[i].note == note && voices[i].envStage != 4) {
            voices[i].envStage = 4; // Release
        }
    }
}

void controlChange(int cc, int value, int channel) {
    float normalizedValue = value / 127.0f;
    
    switch (cc) {
        case 1: // Mod wheel
            modWheel = normalizedValue;
            break;
        case 7: // Volume
            masterVolume = normalizedValue;
            break;
        case 74: // Filter cutoff (commonly used)
            params[5] = 20.0f + normalizedValue * 19980.0f;
            break;
        case 71: // Filter resonance
            params[6] = normalizedValue;
            break;
        case 123: // All notes off
            reset();
            break;
    }
}

void pitchBend(int value, int channel) {
    // value is 0-16383, center is 8192
    pitchBendValue = (value - 8192) / 8192.0f;
}

// ============================================================================
// Parameter Functions
// ============================================================================

int getParameterCount() {
    return NUM_PARAMETERS;
}

float getParameter(int index) {
    if (index >= 0 && index < NUM_PARAMETERS) {
        return params[index];
    }
    return 0.0f;
}

void setParameter(int index, float value) {
    if (index >= 0 && index < NUM_PARAMETERS) {
        switch (index) {
            case 0: // Waveform
                params[0] = clamp(value, 0.0f, 4.0f);
                break;
            case 1: // Attack
                params[1] = clamp(value, 0.001f, 2.0f);
                break;
            case 2: // Decay
                params[2] = clamp(value, 0.001f, 2.0f);
                break;
            case 3: // Sustain
                params[3] = clamp(value, 0.0f, 1.0f);
                break;
            case 4: // Release
                params[4] = clamp(value, 0.001f, 5.0f);
                break;
            case 5: // Filter Cutoff
                params[5] = clamp(value, 20.0f, 20000.0f);
                break;
            case 6: // Filter Resonance
                params[6] = clamp(value, 0.0f, 1.0f);
                break;
            case 7: // Detune
                params[7] = clamp(value, -1.0f, 1.0f);
                break;
        }
    }
}

int getLatency() {
    return 0;
}