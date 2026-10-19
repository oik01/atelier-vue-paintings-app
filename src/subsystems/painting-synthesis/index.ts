// src/subsystems/painting-synthesis/index.ts
// Subsystem 2 (painting-synthesis) Public Barrel Export — Conforms to C_root & C_sub

export {
  generatePaintingsForRoom,
  mulberry32,
  hashRoomToSeed,
  derivePigmentStopsForStyle,
  FINE_ART_PIGMENT_LIBRARY,
} from './harmonyPaletteGenerator';
export type { ArchivalPigmentEntry } from './harmonyPaletteGenerator';

export {
  renderPaintingToCanvas,
  renderPaintingThumbnailDataUrl,
  clearPaintingThumbnailCache,
  getThumbnailCacheSize,
  getThumbnailCacheStats,
  MAX_THUMBNAIL_CACHE_ENTRIES,
  encodeDeterministicPngDataUrl,
  noise2D,
  fbm2D,
} from './proceduralArtRenderers';
export type { RenderPaintingOptions } from './proceduralArtRenderers';

export {
  exportHighResPrintMaster,
  triggerBrowserDownload,
  resolveOrientedPrintDimensions,
} from './highResPrintExporter';
export type { OrientedPrintDimensions } from './highResPrintExporter';
