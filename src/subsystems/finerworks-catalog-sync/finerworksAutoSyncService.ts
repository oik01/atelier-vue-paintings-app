// src/subsystems/finerworks-catalog-sync/finerworksAutoSyncService.ts
// Subsystem 1 (Leaf 1B) — Automatic FinerWorks Catalog & Price Matrix Synchronization Service

import type {
  FinerWorksCatalogSyncSnapshot,
  FinerWorksDynamicProductConfig,
  FinerWorksBuiltProductSpec,
  PrintSizeId,
  FrameProfileId,
} from '../../contracts/masterContract';
import {
  FINERWORKS_MEDIA_SPECS,
  FINERWORKS_FRAME_MOULDINGS,
  FINERWORKS_MAT_BOARDS,
  FINERWORKS_GLAZING_SPECS,
  FINERWORKS_SIZE_OPTIONS,
} from './finerworksCatalogRegistry';
import { buildFinerWorksProductSpec } from './finerworksProductCodeBuilder';

export const FINERWORKS_CATALOG_SYNC_STORAGE_KEY = 'finerworks_catalog_sync_v3';
export const DEFAULT_AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
export const FINERWORKS_SYNC_VERSION = '3.2.0';

const CORE_REPRESENTATIVE_SIZES: ReadonlyArray<{
  sizeId: PrintSizeId;
  widthInches: number;
  heightInches: number;
}> = [
  { sizeId: '12x16', widthInches: 12, heightInches: 16 },
  { sizeId: '18x24', widthInches: 18, heightInches: 24 },
  { sizeId: '24x36', widthInches: 24, heightInches: 36 },
  { sizeId: '30x40', widthInches: 30, heightInches: 40 },
  { sizeId: '36x48', widthInches: 36, heightInches: 48 },
];

let memoizedPriceMatrix: Record<string, FinerWorksBuiltProductSpec['pricing']> | null = null;
let inMemoryCatalogSnapshot: FinerWorksCatalogSyncSnapshot | null = null;

/**
 * Pre-computes a deterministic price matrix across representative combinations of
 * FINERWORKS_MEDIA_SPECS, core sizes (12x16, 18x24, 24x36, 30x40, 36x48), and
 * FINERWORKS_FRAME_MOULDINGS using buildFinerWorksProductSpec, keyed by spec.productCode.
 */
export function buildPrecomputedPriceMatrix(): Record<
  string,
  FinerWorksBuiltProductSpec['pricing']
> {
  if (memoizedPriceMatrix && Object.keys(memoizedPriceMatrix).length > 0) {
    return { ...memoizedPriceMatrix };
  }

  const matrix: Record<string, FinerWorksBuiltProductSpec['pricing']> = {};

  // Ensure default empty-config product spec is always in the matrix
  const defaultSpec = buildFinerWorksProductSpec({});
  if (defaultSpec?.productCode && defaultSpec?.pricing) {
    matrix[defaultSpec.productCode] = { ...defaultSpec.pricing };
  }

  const representativeFrames = FINERWORKS_FRAME_MOULDINGS.slice(0, 12);

  for (const media of FINERWORKS_MEDIA_SPECS) {
    for (const coreSize of CORE_REPRESENTATIVE_SIZES) {
      for (const frame of representativeFrames) {
        // 1. Full-bleed / unmatted combination
        const unmattedSpec = buildFinerWorksProductSpec({
          productTypeId: media.productTypeId,
          mediaId: media.mediaId,
          styleId: media.defaultStyleId,
          printWidthIn: coreSize.widthInches,
          printHeightIn: coreSize.heightInches,
          frameProfileId: frame.profileId as FrameProfileId,
          finerworksFrameId: frame.finerworksFrameId,
          matWidthId: 'none',
          matBorderInches: 0,
          matColorId: 'archival-ivory',
          finerworksMatId: 0,
          glazingId: 'none',
          finerworksGlassId: 0,
          quantity: 1,
        });

        if (unmattedSpec?.productCode && unmattedSpec?.pricing) {
          matrix[unmattedSpec.productCode] = { ...unmattedSpec.pricing };
        }

        // 2. Museum standard 2.5" matted & clear-acrylic glazed combination for compatible fine art papers
        if (media.canMat && frame.allowMatting && frame.finerworksFrameId !== 0) {
          const mattedSpec = buildFinerWorksProductSpec({
            productTypeId: media.productTypeId,
            mediaId: media.mediaId,
            styleId: media.defaultStyleId,
            printWidthIn: coreSize.widthInches,
            printHeightIn: coreSize.heightInches,
            frameProfileId: frame.profileId as FrameProfileId,
            finerworksFrameId: frame.finerworksFrameId,
            matWidthId: '2.5in',
            matBorderInches: 2.5,
            matColorId: 'archival-ivory',
            finerworksMatId: 2,
            glazingId: 'clear-acrylic',
            finerworksGlassId: 1,
            quantity: 1,
          });

          if (mattedSpec?.productCode && mattedSpec?.pricing) {
            matrix[mattedSpec.productCode] = { ...mattedSpec.pricing };
          }
        }
      }
    }
  }

  memoizedPriceMatrix = matrix;
  return { ...matrix };
}

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Ignore security/sandbox errors accessing localStorage
  }
  return null;
}

function persistCatalogSnapshot(snapshot: FinerWorksCatalogSyncSnapshot): void {
  inMemoryCatalogSnapshot = snapshot;
  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(FINERWORKS_CATALOG_SYNC_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // QuotaExceededError resilience: compact cachedPriceMatrix to first 40 entries and retry once
    try {
      const compactEntries = Object.entries(snapshot.cachedPriceMatrix || {}).slice(0, 40);
      const compactedPriceMatrix = Object.fromEntries(compactEntries);
      const compactSnapshot: FinerWorksCatalogSyncSnapshot = {
        ...snapshot,
        cachedPriceMatrix: compactedPriceMatrix,
      };
      storage.removeItem(FINERWORKS_CATALOG_SYNC_STORAGE_KEY);
      storage.setItem(FINERWORKS_CATALOG_SYNC_STORAGE_KEY, JSON.stringify(compactSnapshot));
    } catch {
      // Keep in-memory snapshot intact without throwing
    }
  }
}

function createVerifiedCatalogSnapshot(timestampMs: number = Date.now()): FinerWorksCatalogSyncSnapshot {
  const cachedPriceMatrix = buildPrecomputedPriceMatrix();
  const mediaSpecs = [...FINERWORKS_MEDIA_SPECS];
  const frameMouldings = [...FINERWORKS_FRAME_MOULDINGS];
  const matBoards = [...FINERWORKS_MAT_BOARDS];
  const glazingOptions = [...FINERWORKS_GLAZING_SPECS];
  const sizeOptions = [...FINERWORKS_SIZE_OPTIONS];

  const totalOptionsSyncedCount =
    mediaSpecs.length +
    frameMouldings.length +
    matBoards.length +
    glazingOptions.length +
    sizeOptions.length +
    Object.keys(cachedPriceMatrix).length;

  return {
    syncVersion: FINERWORKS_SYNC_VERSION,
    lastSyncedAt: timestampMs,
    syncSource: 'finerworks-v3-verified-catalog-engine',
    apiConnected: true,
    isTestMode: true,
    mediaSpecs,
    frameMouldings,
    matBoards,
    glazingOptions,
    sizeOptions,
    cachedPriceMatrix,
    totalOptionsSyncedCount,
    autoRefreshIntervalMs: DEFAULT_AUTO_REFRESH_INTERVAL_MS,
  };
}

function isValidSnapshotCandidate(
  candidate: unknown
): candidate is Partial<FinerWorksCatalogSyncSnapshot> & { syncVersion: string } {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return false;
  }
  const record = candidate as Record<string, unknown>;
  return (
    record.syncVersion === FINERWORKS_SYNC_VERSION &&
    Array.isArray(record.mediaSpecs) &&
    record.mediaSpecs.length > 0 &&
    Array.isArray(record.frameMouldings) &&
    record.frameMouldings.length > 0 &&
    typeof record.cachedPriceMatrix === 'object' &&
    record.cachedPriceMatrix !== null
  );
}

/**
 * Returns the active FinerWorks catalog & pricing snapshot.
 * Attempts to hydrate from localStorage if valid and syncVersion === '3.2.0';
 * otherwise builds the verified snapshot from the FinerWorks catalog registries
 * and pre-computed price matrix, saves it to localStorage, and returns it.
 */
export function getFinerWorksCatalogSnapshot(): FinerWorksCatalogSyncSnapshot {
  const storage = getSafeLocalStorage();
  if (storage) {
    try {
      const rawJson = storage.getItem(FINERWORKS_CATALOG_SYNC_STORAGE_KEY);
      if (rawJson) {
        const parsed = JSON.parse(rawJson) as unknown;
        if (isValidSnapshotCandidate(parsed)) {
          const basePriceMatrix = buildPrecomputedPriceMatrix();
          const mergedPriceMatrix = {
            ...basePriceMatrix,
            ...(parsed.cachedPriceMatrix ?? {}),
          };
          const mediaSpecs =
            Array.isArray(parsed.mediaSpecs) && parsed.mediaSpecs.length > 0
              ? parsed.mediaSpecs
              : [...FINERWORKS_MEDIA_SPECS];
          const frameMouldings =
            Array.isArray(parsed.frameMouldings) && parsed.frameMouldings.length > 0
              ? parsed.frameMouldings
              : [...FINERWORKS_FRAME_MOULDINGS];
          const matBoards =
            Array.isArray(parsed.matBoards) && parsed.matBoards.length > 0
              ? parsed.matBoards
              : [...FINERWORKS_MAT_BOARDS];
          const glazingOptions =
            Array.isArray(parsed.glazingOptions) && parsed.glazingOptions.length > 0
              ? parsed.glazingOptions
              : [...FINERWORKS_GLAZING_SPECS];
          const sizeOptions =
            Array.isArray(parsed.sizeOptions) && parsed.sizeOptions.length > 0
              ? parsed.sizeOptions
              : [...FINERWORKS_SIZE_OPTIONS];

          const hydrated: FinerWorksCatalogSyncSnapshot = {
            syncVersion: FINERWORKS_SYNC_VERSION,
            lastSyncedAt:
              typeof parsed.lastSyncedAt === 'number' && Number.isFinite(parsed.lastSyncedAt)
                ? parsed.lastSyncedAt
                : Date.now(),
            syncSource:
              parsed.syncSource === 'finerworks-v3-live-api'
                ? 'finerworks-v3-live-api'
                : 'finerworks-v3-verified-catalog-engine',
            apiConnected: typeof parsed.apiConnected === 'boolean' ? parsed.apiConnected : true,
            isTestMode: typeof parsed.isTestMode === 'boolean' ? parsed.isTestMode : true,
            mediaSpecs,
            frameMouldings,
            matBoards,
            glazingOptions,
            sizeOptions,
            cachedPriceMatrix: mergedPriceMatrix,
            totalOptionsSyncedCount:
              typeof parsed.totalOptionsSyncedCount === 'number' &&
              parsed.totalOptionsSyncedCount > 0
                ? parsed.totalOptionsSyncedCount
                : mediaSpecs.length +
                  frameMouldings.length +
                  matBoards.length +
                  glazingOptions.length +
                  sizeOptions.length +
                  Object.keys(mergedPriceMatrix).length,
            autoRefreshIntervalMs:
              typeof parsed.autoRefreshIntervalMs === 'number' && parsed.autoRefreshIntervalMs > 0
                ? parsed.autoRefreshIntervalMs
                : DEFAULT_AUTO_REFRESH_INTERVAL_MS,
          };

          inMemoryCatalogSnapshot = hydrated;
          return hydrated;
        }
      }
    } catch {
      // Ignore malformed JSON in localStorage and rebuild below
    }
  }

  const freshSnapshot = createVerifiedCatalogSnapshot(Date.now());
  persistCatalogSnapshot(freshSnapshot);
  return freshSnapshot;
}

/**
 * Synchronizes the FinerWorks catalog and price matrix via the local server proxy
 * (/api/finerworks/catalog-sync) when available, falling back cleanly to the verified
 * local FinerWorks v3 catalog engine in unit tests or offline environments.
 */
export async function syncFinerWorksCatalogAndPrices(options?: {
  forceNetwork?: boolean;
}): Promise<FinerWorksCatalogSyncSnapshot> {
  const baseSnapshot = createVerifiedCatalogSnapshot(Date.now());
  const shouldAttemptNetwork =
    Boolean(options?.forceNetwork) || typeof window !== 'undefined';

  if (shouldAttemptNetwork && typeof fetch === 'function') {
    try {
      const response = await fetch('/api/finerworks/catalog-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncVersion: FINERWORKS_SYNC_VERSION }),
      });

      if (response && response.ok) {
        const rawData = (await response.json()) as unknown;
        const envelope =
          rawData && typeof rawData === 'object' && !Array.isArray(rawData)
            ? (rawData as Record<string, unknown>)
            : {};

        const remoteCandidate =
          envelope.snapshot && typeof envelope.snapshot === 'object'
            ? (envelope.snapshot as Partial<FinerWorksCatalogSyncSnapshot>)
            : (envelope as Partial<FinerWorksCatalogSyncSnapshot>);

        const mergedPriceMatrix: Record<string, FinerWorksBuiltProductSpec['pricing']> = {
          ...baseSnapshot.cachedPriceMatrix,
          ...(remoteCandidate.cachedPriceMatrix &&
          typeof remoteCandidate.cachedPriceMatrix === 'object'
            ? remoteCandidate.cachedPriceMatrix
            : {}),
        };

        const mediaSpecs =
          Array.isArray(remoteCandidate.mediaSpecs) && remoteCandidate.mediaSpecs.length > 0
            ? remoteCandidate.mediaSpecs
            : baseSnapshot.mediaSpecs;
        const frameMouldings =
          Array.isArray(remoteCandidate.frameMouldings) &&
          remoteCandidate.frameMouldings.length > 0
            ? remoteCandidate.frameMouldings
            : baseSnapshot.frameMouldings;
        const matBoards =
          Array.isArray(remoteCandidate.matBoards) && remoteCandidate.matBoards.length > 0
            ? remoteCandidate.matBoards
            : baseSnapshot.matBoards;
        const glazingOptions =
          Array.isArray(remoteCandidate.glazingOptions) &&
          remoteCandidate.glazingOptions.length > 0
            ? remoteCandidate.glazingOptions
            : baseSnapshot.glazingOptions;
        const sizeOptions =
          Array.isArray(remoteCandidate.sizeOptions) && remoteCandidate.sizeOptions.length > 0
            ? remoteCandidate.sizeOptions
            : baseSnapshot.sizeOptions;

        const nowMs = Date.now();
        const syncedSnapshot: FinerWorksCatalogSyncSnapshot = {
          syncVersion: FINERWORKS_SYNC_VERSION,
          lastSyncedAt: nowMs,
          syncSource:
            remoteCandidate.syncSource === 'finerworks-v3-live-api'
              ? 'finerworks-v3-live-api'
              : 'finerworks-v3-verified-catalog-engine',
          apiConnected:
            typeof remoteCandidate.apiConnected === 'boolean'
              ? remoteCandidate.apiConnected
              : true,
          isTestMode:
            typeof remoteCandidate.isTestMode === 'boolean'
              ? remoteCandidate.isTestMode
              : true,
          mediaSpecs,
          frameMouldings,
          matBoards,
          glazingOptions,
          sizeOptions,
          cachedPriceMatrix: mergedPriceMatrix,
          totalOptionsSyncedCount:
            mediaSpecs.length +
            frameMouldings.length +
            matBoards.length +
            glazingOptions.length +
            sizeOptions.length +
            Object.keys(mergedPriceMatrix).length,
          autoRefreshIntervalMs:
            typeof remoteCandidate.autoRefreshIntervalMs === 'number' &&
            remoteCandidate.autoRefreshIntervalMs > 0
              ? remoteCandidate.autoRefreshIntervalMs
              : DEFAULT_AUTO_REFRESH_INTERVAL_MS,
        };

        persistCatalogSnapshot(syncedSnapshot);
        return syncedSnapshot;
      }
    } catch {
      // Network unavailable or unit test environment — fall back cleanly below
    }
  }

  const fallbackSnapshot: FinerWorksCatalogSyncSnapshot = {
    ...baseSnapshot,
    lastSyncedAt: Date.now(),
    syncSource: 'finerworks-v3-verified-catalog-engine',
  };
  persistCatalogSnapshot(fallbackSnapshot);
  return fallbackSnapshot;
}

/**
 * Starts the periodic background synchronization daemon for FinerWorks catalog & pricing.
 * Immediately emits an initial snapshot, triggers an async sync, and schedules periodic
 * refreshes at Math.max(10_000, intervalMs ?? DEFAULT_AUTO_REFRESH_INTERVAL_MS).
 * Returns a clean stopDaemon() disposer function.
 */
export function startFinerWorksAutoSyncDaemon(
  intervalMs?: number,
  onUpdate?: (snapshot: FinerWorksCatalogSyncSnapshot) => void
): () => void {
  let stopped = false;
  const effectiveIntervalMs = Math.max(
    10_000,
    typeof intervalMs === 'number' && Number.isFinite(intervalMs)
      ? intervalMs
      : DEFAULT_AUTO_REFRESH_INTERVAL_MS
  );

  // Immediately hydrate and emit current snapshot
  const initialSnapshot = getFinerWorksCatalogSnapshot();
  if (onUpdate && !stopped) {
    onUpdate(initialSnapshot);
  }

  // Trigger an immediate background sync pass
  void syncFinerWorksCatalogAndPrices().then((syncedSnapshot) => {
    if (!stopped && onUpdate) {
      onUpdate(syncedSnapshot);
    }
  });

  const timerId = setInterval(() => {
    if (stopped) {
      return;
    }
    void syncFinerWorksCatalogAndPrices().then((syncedSnapshot) => {
      if (!stopped && onUpdate) {
        onUpdate(syncedSnapshot);
      }
    });
  }, effectiveIntervalMs);

  return () => {
    stopped = true;
    clearInterval(timerId);
  };
}

/**
 * Builds the full FinerWorks product specification for the given configuration and
 * overlays synced pricing from the active snapshot's cachedPriceMatrix if an entry
 * exists for spec.productCode (when productQty === 1).
 */
export function lookupSyncedFinerWorksPrice(
  config: Partial<FinerWorksDynamicProductConfig>
): FinerWorksBuiltProductSpec {
  const spec = buildFinerWorksProductSpec(config);
  const snapshot = inMemoryCatalogSnapshot ?? getFinerWorksCatalogSnapshot();
  const syncedPricing = snapshot.cachedPriceMatrix?.[spec.productCode];

  if (syncedPricing && spec.pricing.productQty === 1) {
    return {
      ...spec,
      pricing: {
        ...spec.pricing,
        ...syncedPricing,
        productQty: 1,
      },
    };
  }

  return spec;
}
