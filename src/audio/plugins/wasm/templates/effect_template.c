/* Copyright (c) 2025 Jema Technology.
 * Distributed under the license specified in the root directory of this project.
 */
/**
 * WASM Effect Plugin Template
 * 
 * This is a template for creating audio effect plugins for AnkhWaveStudio.
 * Compile with Emscripten:
 * 
 * emcc effect_template.c -o my_effect.wasm \
 *   -s WASM=1 \
 *   -s EXPORTED_FUNCTIONS='["_init","_process","_dispose","_reset","_getParameterCount","_getParameter","_setParameter","_getLatency","_malloc","_free"]' \
 *   -s ALLOW_MEMORY_GROWTH=1 \
 *   -O3
 */

#include <stdlib.h>
#include <string.h>
#include <math.h>

// ============================================================================
// Configuration
// ============================================================================

#define MAX_BUFFER_SIZE 4096
#define NUM_CHANNELS 2
#define NUM_PARAMETERS 4

// ============================================================================
// Plugin State
// ============================================================================

static float sampleRate = 44100.0f;
static int bufferSize = 128;

// Parameters
static float params[NUM_PARAMETERS] = {
    1.0f,   // 0: Gain (0-2)
    0.5f,   // 1: Mix (0-1)
    1000.0f,// 2: Cutoff (20-20000)
    0.5f    // 3: Resonance (0-1)
};

// Internal state
static float* delayBuffer = NULL;
static int delayWritePos = 0;
static int delayLength = 0;

// Filter state
static float filterState[2] = {0.0f, 0.0f}; // Per channel

// ============================================================================
// Helper Functions
// ============================================================================

static inline float clamp(float value, float min, float max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

static inline float lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

// Simple one-pole lowpass filter
static inline float lowpass(float input, float* state, float cutoff) {
    float rc = 1.0f / (2.0f * 3.14159265f * cutoff);
    float dt = 1.0f / sampleRate;
    float alpha = dt / (rc + dt);
    *state = lerp(*state, input, alpha);
    return *state;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Initialize the plugin
 */
void init(float sr, int bs) {
    sampleRate = sr;
    bufferSize = bs;
    
    // Allocate delay buffer (1 second max)
    delayLength = (int)sampleRate;
    delayBuffer = (float*)malloc(delayLength * NUM_CHANNELS * sizeof(float));
    if (delayBuffer) {
        memset(delayBuffer, 0, delayLength * NUM_CHANNELS * sizeof(float));
    }
    
    delayWritePos = 0;
    filterState[0] = 0.0f;
    filterState[1] = 0.0f;
}

/**
 * Process audio
 * Input/output are interleaved stereo (L0, R0, L1, R1, ...)
 */
void process(float* input, float* output, int numSamples) {
    float gain = params[0];
    float mix = params[1];
    float cutoff = params[2];
    // float resonance = params[3]; // Not used in this simple example
    
    for (int i = 0; i < numSamples; i++) {
        for (int ch = 0; ch < NUM_CHANNELS; ch++) {
            int idx = i * NUM_CHANNELS + ch;
            float in = input[idx];
            
            // Apply lowpass filter
            float filtered = lowpass(in, &filterState[ch], cutoff);
            
            // Mix dry/wet
            float processed = lerp(in, filtered, mix);
            
            // Apply gain
            output[idx] = processed * gain;
        }
    }
}

/**
 * Process audio with separate channel buffers
 * Alternative processing function for non-interleaved audio
 */
void processBlock(float* input, float* output, int numSamples, int numChannels) {
    float gain = params[0];
    float mix = params[1];
    float cutoff = params[2];
    
    for (int ch = 0; ch < numChannels && ch < NUM_CHANNELS; ch++) {
        float* inCh = input + ch * numSamples;
        float* outCh = output + ch * numSamples;
        
        for (int i = 0; i < numSamples; i++) {
            float in = inCh[i];
            float filtered = lowpass(in, &filterState[ch], cutoff);
            float processed = lerp(in, filtered, mix);
            outCh[i] = processed * gain;
        }
    }
}

/**
 * Reset plugin state
 */
void reset() {
    if (delayBuffer) {
        memset(delayBuffer, 0, delayLength * NUM_CHANNELS * sizeof(float));
    }
    delayWritePos = 0;
    filterState[0] = 0.0f;
    filterState[1] = 0.0f;
}

/**
 * Clean up resources
 */
void dispose() {
    if (delayBuffer) {
        free(delayBuffer);
        delayBuffer = NULL;
    }
}

// ============================================================================
// Parameter Functions
// ============================================================================

/**
 * Get number of parameters
 */
int getParameterCount() {
    return NUM_PARAMETERS;
}

/**
 * Get parameter value
 */
float getParameter(int index) {
    if (index >= 0 && index < NUM_PARAMETERS) {
        return params[index];
    }
    return 0.0f;
}

/**
 * Set parameter value
 */
void setParameter(int index, float value) {
    if (index >= 0 && index < NUM_PARAMETERS) {
        // Clamp to valid ranges
        switch (index) {
            case 0: // Gain
                params[0] = clamp(value, 0.0f, 2.0f);
                break;
            case 1: // Mix
                params[1] = clamp(value, 0.0f, 1.0f);
                break;
            case 2: // Cutoff
                params[2] = clamp(value, 20.0f, 20000.0f);
                break;
            case 3: // Resonance
                params[3] = clamp(value, 0.0f, 1.0f);
                break;
        }
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get plugin latency in samples
 */
int getLatency() {
    return 0; // This effect has no latency
}

/**
 * Get sample rate
 */
float getSampleRate() {
    return sampleRate;
}