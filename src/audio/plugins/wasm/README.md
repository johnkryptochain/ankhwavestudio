<!--
 Copyright (c) 2025 Jema Technology.
 Distributed under the license specified in the root directory of this project.
-->
# WASM Audio Plugin Development

This directory contains documentation and templates for creating WebAssembly audio plugins for AnkhWaveStudio Web.

## Overview

AnkhWaveStudio Web uses WebAssembly (WASM) plugins as an alternative to native VST/LADSPA/LV2 plugins. These plugins can be written in C, C++, Rust, or any language that compiles to WebAssembly.

## Plugin Types

1. **Instruments** - Generate audio from MIDI input
2. **Effects** - Process audio (filters, delays, reverbs, etc.)
3. **Analyzers** - Analyze audio (spectrum, level meters, etc.)
4. **Utilities** - MIDI processing, routing, etc.

## Required Exports

Your WASM module must export the following functions:

### Core Functions (Required)

```c
// Initialize the plugin
// sampleRate: Audio sample rate (e.g., 44100, 48000)
// bufferSize: Number of samples per processing block (e.g., 128, 256)
void init(float sampleRate, int bufferSize);

// Process audio
// inputPtr: Pointer to input buffer (interleaved stereo float32)
// outputPtr: Pointer to output buffer (interleaved stereo float32)
// numSamples: Number of samples to process
void process(float* inputPtr, float* outputPtr, int numSamples);
```

### Optional Functions

```c
// Clean up resources
void dispose();

// Reset plugin state (e.g., clear delay buffers)
void reset();

// Get number of parameters
int getParameterCount();

// Get parameter value by index
float getParameter(int index);

// Set parameter value by index
void setParameter(int index, float value);

// Get plugin latency in samples
int getLatency();

// For instruments: MIDI note on
void noteOn(int note, int velocity, int channel);

// For instruments: MIDI note off
void noteOff(int note, int channel);

// MIDI control change
void controlChange(int cc, int value, int channel);

// Pitch bend
void pitchBend(int value, int channel);

// Memory allocation (if not using WASI)
void* malloc(int size);
void free(void* ptr);
```

## Building Plugins

### Using Emscripten (C/C++)

```bash
# Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Compile your plugin
emcc plugin.c -o plugin.wasm \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_init","_process","_setParameter","_getParameter","_dispose"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -O3
```

### Using Rust

```bash
# Install wasm-pack
cargo install wasm-pack

# Create a new project
cargo new --lib my-plugin
cd my-plugin

# Add to Cargo.toml:
# [lib]
# crate-type = ["cdylib"]
# 
# [dependencies]
# wasm-bindgen = "0.2"

# Build
wasm-pack build --target web
```

## Plugin Manifest

Every plugin needs a `manifest.json` file:

```json
{
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A description of your plugin",
  "type": "effect",
  "category": "Filter",
  "tags": ["filter", "lowpass", "resonant"],
  "wasmUrl": "./my-plugin.wasm",
  "audioInputs": 1,
  "audioOutputs": 1,
  "midiInput": false,
  "midiOutput": false,
  "hasCustomUI": false,
  "parameters": [
    {
      "id": "cutoff",
      "name": "Cutoff Frequency",
      "min": 20,
      "max": 20000,
      "default": 1000,
      "unit": "Hz",
      "type": "logarithmic"
    },
    {
      "id": "resonance",
      "name": "Resonance",
      "min": 0,
      "max": 1,
      "default": 0.5
    }
  ],
  "presets": [
    {
      "name": "Default",
      "params": {
        "cutoff": 1000,
        "resonance": 0.5
      }
    }
  ]
}
```

## Example: Simple Gain Plugin (C)

```c
// gain.c
#include <stdint.h>

static float sampleRate = 44100.0f;
static int blockSize = 128;
static float gain = 1.0f;

void init(float sr, int bs) {
    sampleRate = sr;
    blockSize = bs;
}

void process(float* input, float* output, int numSamples) {
    for (int i = 0; i < numSamples * 2; i++) {  // stereo
        output[i] = input[i] * gain;
    }
}

int getParameterCount() {
    return 1;
}

float getParameter(int index) {
    if (index == 0) return gain;
    return 0.0f;
}

void setParameter(int index, float value) {
    if (index == 0) {
        gain = value;
    }
}

void dispose() {
    // Nothing to clean up
}
```

## Example: Simple Synth Plugin (C)

```c
// synth.c
#include <math.h>
#include <stdint.h>

#define MAX_VOICES 16
#define PI 3.14159265358979323846f

typedef struct {
    int active;
    int note;
    float velocity;
    float phase;
    float envelope;
    float envStage; // 0=attack, 1=decay, 2=sustain, 3=release
} Voice;

static float sampleRate = 44100.0f;
static Voice voices[MAX_VOICES];

// Parameters
static float attack = 0.01f;
static float decay = 0.1f;
static float sustain = 0.7f;
static float release = 0.3f;
static int waveform = 0; // 0=sine, 1=square, 2=saw, 3=triangle

float noteToFreq(int note) {
    return 440.0f * powf(2.0f, (note - 69) / 12.0f);
}

void init(float sr, int bs) {
    sampleRate = sr;
    for (int i = 0; i < MAX_VOICES; i++) {
        voices[i].active = 0;
    }
}

void noteOn(int note, int velocity, int channel) {
    // Find free voice
    for (int i = 0; i < MAX_VOICES; i++) {
        if (!voices[i].active) {
            voices[i].active = 1;
            voices[i].note = note;
            voices[i].velocity = velocity / 127.0f;
            voices[i].phase = 0.0f;
            voices[i].envelope = 0.0f;
            voices[i].envStage = 0;
            return;
        }
    }
}

void noteOff(int note, int channel) {
    for (int i = 0; i < MAX_VOICES; i++) {
        if (voices[i].active && voices[i].note == note) {
            voices[i].envStage = 3; // Release
        }
    }
}

float generateSample(Voice* v) {
    float freq = noteToFreq(v->note);
    float phaseInc = freq / sampleRate;
    float sample = 0.0f;
    
    switch (waveform) {
        case 0: // Sine
            sample = sinf(v->phase * 2.0f * PI);
            break;
        case 1: // Square
            sample = v->phase < 0.5f ? 1.0f : -1.0f;
            break;
        case 2: // Saw
            sample = 2.0f * v->phase - 1.0f;
            break;
        case 3: // Triangle
            sample = 4.0f * fabsf(v->phase - 0.5f) - 1.0f;
            break;
    }
    
    v->phase += phaseInc;
    if (v->phase >= 1.0f) v->phase -= 1.0f;
    
    return sample * v->envelope * v->velocity;
}

void updateEnvelope(Voice* v) {
    float envInc;
    
    switch ((int)v->envStage) {
        case 0: // Attack
            envInc = 1.0f / (attack * sampleRate);
            v->envelope += envInc;
            if (v->envelope >= 1.0f) {
                v->envelope = 1.0f;
                v->envStage = 1;
            }
            break;
        case 1: // Decay
            envInc = (1.0f - sustain) / (decay * sampleRate);
            v->envelope -= envInc;
            if (v->envelope <= sustain) {
                v->envelope = sustain;
                v->envStage = 2;
            }
            break;
        case 2: // Sustain
            // Hold at sustain level
            break;
        case 3: // Release
            envInc = v->envelope / (release * sampleRate);
            v->envelope -= envInc;
            if (v->envelope <= 0.001f) {
                v->envelope = 0.0f;
                v->active = 0;
            }
            break;
    }
}

void process(float* input, float* output, int numSamples) {
    for (int i = 0; i < numSamples; i++) {
        float sample = 0.0f;
        
        for (int v = 0; v < MAX_VOICES; v++) {
            if (voices[v].active) {
                sample += generateSample(&voices[v]);
                updateEnvelope(&voices[v]);
            }
        }
        
        // Stereo output
        output[i * 2] = sample;
        output[i * 2 + 1] = sample;
    }
}

int getParameterCount() { return 5; }

float getParameter(int index) {
    switch (index) {
        case 0: return (float)waveform;
        case 1: return attack;
        case 2: return decay;
        case 3: return sustain;
        case 4: return release;
    }
    return 0.0f;
}

void setParameter(int index, float value) {
    switch (index) {
        case 0: waveform = (int)value; break;
        case 1: attack = value; break;
        case 2: decay = value; break;
        case 3: sustain = value; break;
        case 4: release = value; break;
    }
}

void dispose() {}
```

## Testing Your Plugin

1. Place your `.wasm` file and `manifest.json` in a web-accessible location
2. Open AnkhWaveStudio Web
3. Go to Plugin Browser
4. Click "Load from URL" or drag-drop your manifest.json
5. Test your plugin with audio/MIDI input

## Performance Tips

1. **Avoid allocations in process()** - Pre-allocate all buffers in init()
2. **Use SIMD** - Emscripten supports WASM SIMD for vectorized operations
3. **Minimize branching** - Use branchless algorithms where possible
4. **Use lookup tables** - Pre-compute expensive functions like sin/cos
5. **Profile your code** - Use browser dev tools to identify bottlenecks

## Debugging

1. **Console logging** - Export a log function and call it from WASM
2. **Memory inspection** - Use browser dev tools to inspect WASM memory
3. **Source maps** - Compile with `-g` flag for debug symbols

## Resources

- [WebAssembly Specification](https://webassembly.github.io/spec/)
- [Emscripten Documentation](https://emscripten.org/docs/)
- [Rust and WebAssembly](https://rustwasm.github.io/docs/book/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)