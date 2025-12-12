// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Project Import Utilities
 * Export all import-related functionality
 */

export { AnkhWaveStudioProjectParser, isAnkhWaveStudioProjectFile, getAnkhWaveStudioProjectInfo } from './AnkhWaveProjectParser';
export { ProjectConverter, convertAnkhWaveStudioProject } from './ProjectConverter';
export type { ConversionResult } from './ProjectConverter';
export {
  SampleExtractor,
  SampleStorage,
  extractAndStoreSamples
} from './SampleExtractor';
export type { ExtractedSample, SampleExtractionResult } from './SampleExtractor';

// Note: Types from ankhWaveProject.ts should be imported directly from '../../types/ankhWaveProject'
// to avoid conflicts with midiImport.ts types (AnkhWaveStudioNote, AnkhWaveStudioPattern, AnkhWaveStudioTrack)

/**
 * Import an AnkhWaveStudio project file
 * Main entry point for project import
 */
import { AnkhWaveStudioProjectParser } from './AnkhWaveProjectParser';
import { ProjectConverter } from './ProjectConverter';
import { extractAndStoreSamples } from './SampleExtractor';
import type { ProjectData } from '../../types/song';
import type { AnkhWaveStudioImportWarning } from '../../types/ankhWaveProject';

export interface ImportResult {
  project: ProjectData;
  warnings: AnkhWaveStudioImportWarning[];
  unsupportedInstruments: string[];
  unsupportedEffects: string[];
  missingSamples: string[];
  embeddedSamplesCount: number;
}

/**
 * Import an AnkhWaveStudio project file (.mmp or .mmpz)
 */
export async function importAnkhWaveStudioProject(file: File): Promise<ImportResult> {
  // Parse the project file
  const parser = new AnkhWaveStudioProjectParser();
  const parseResult = await parser.parse(file);

  // Extract and store samples
  const sampleResult = await extractAndStoreSamples(parseResult.project);

  // Convert to AnkhWaveStudio Web format
  const converter = new ProjectConverter();
  const conversionResult = converter.convert(parseResult.project, file.name);

  // Combine warnings
  const allWarnings = [
    ...parseResult.warnings,
    ...conversionResult.warnings,
  ];

  // Add warnings for missing samples
  for (const missingSample of sampleResult.missingSamples) {
    allWarnings.push({
      type: 'sample',
      message: `Sample file not found: ${missingSample}`,
      details: 'The sample was referenced but not embedded in the project file.',
    });
  }

  return {
    project: conversionResult.project,
    warnings: allWarnings,
    unsupportedInstruments: conversionResult.unsupportedInstruments,
    unsupportedEffects: conversionResult.unsupportedEffects,
    missingSamples: sampleResult.missingSamples,
    embeddedSamplesCount: sampleResult.embeddedCount,
  };
}