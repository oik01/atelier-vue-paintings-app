// src/subsystems/finerworks-catalog-sync/index.ts
// Subsystem 1 (finerworks-catalog-sync) — Barrel Export

export * from './finerworksCatalogRegistry';
export * from './finerworksProductCodeBuilder';
export * from './finerworksAutoSyncService';
export * from './brandIdentityRegistry';
export * from './finerworksServerProxy';

export type {
  FinerWorksProductTypeId,
  FinerWorksGlazingId,
  FinerWorksStandardSizeId,
  WhiteLabelBrandId,
  FinerWorksMediaSpec,
  FinerWorksFrameMouldingSpec,
  FinerWorksMatBoardSpec,
  FinerWorksGlazingSpec,
  FinerWorksSizeOptionSpec,
  FinerWorksDynamicProductConfig,
  FinerWorksBuiltProductSpec,
  FinerWorksCatalogSyncSnapshot,
  FinerWorksPromptConstraintConfig,
  FinerWorksOptionsVerification,
  WhiteLabelBusinessInfo,
  WhiteLabelBrandIdentitySpec,
  FinerWorksShippingOptionQuote,
} from '../../contracts/masterContract';
