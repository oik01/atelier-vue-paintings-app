// src/subsystems/commerce-fulfillment/index.ts
// Subsystem 4 (commerce-fulfillment) Public Barrel Export — Conforms to C_root & C_sub

export {
  DEFAULT_STUDIO_MARKUP_PERCENT,
  MIN_STUDIO_MARKUP_PERCENT,
  MAX_STUDIO_MARKUP_PERCENT,
  DIGITAL_MASTER_LICENSE_USD,
  PRINT_SUBSTRATES,
  MAT_WIDTH_OPTIONS,
  MAT_COLOR_OPTIONS,
  roundCents,
  clampStudioMarkupPercent,
  calculatePrintPricing,
  compareAllPartnersPricing,
  generatePartnerOrderManifestJson,
} from './printPartnerPricingEngine';
export type {
  PrintSubstrateSpec,
  MatWidthOptionSpec,
  MatColorOptionSpec,
  CalculatePrintPricingParams,
} from './printPartnerPricingEngine';

export {
  AtelierProvider,
  useAtelierStore,
  createDefaultPresetRooms,
  createDefaultPaintingsForRoom,
  createDefaultWallPlacementForRoom,
  createInitialAtelierState,
  loadPersistedAtelierState,
  savePersistedAtelierState,
  sanitizeShippingText,
  validateShippingAddress,
} from './studioStoreAndPersistence';
export type {
  AtelierState,
  AtelierStoreActions,
  AtelierStoreValue,
  AtelierProviderProps,
  CreateInitialAtelierStateOptions,
  ShippingAddressInput,
  ShippingValidationResult,
} from './studioStoreAndPersistence';

export {
  CuratorialRightColumn,
  renderFallbackPaintingThumbnail,
  computeCuratorialFitScore,
} from './CuratorialRightColumn';
export type { CuratorialRightColumnProps, MobileStudioDeckTab } from './CuratorialRightColumn';

export { CheckoutAndOrderModal } from './CheckoutAndOrderModal';
export type { CheckoutAndOrderModalProps, CheckoutModeTab } from './CheckoutAndOrderModal';

export { LookbookAndOrdersDrawer } from './LookbookAndOrdersDrawer';
export type { LookbookAndOrdersDrawerProps, DrawerModeTab } from './LookbookAndOrdersDrawer';

