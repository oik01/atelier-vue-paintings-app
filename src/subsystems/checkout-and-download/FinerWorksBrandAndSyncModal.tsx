// src/subsystems/checkout-and-download/FinerWorksBrandAndSyncModal.tsx
// Subsystem 4 (Leaf 4A) — White-Label Brand Identity Picker (5 Curated Brands + 600x180 SVG Logos +
// Live Unpriced Packing Slip & Signed COA Previews) & FinerWorks v3 Auto-Sync Catalog Inspector Modal

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building2,
  CheckCircle2,
  FileCheck2,
  Frame,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  FinerWorksCatalogSyncSnapshot,
  WhiteLabelBrandId,
  WhiteLabelBrandIdentitySpec,
} from '../../contracts/masterContract';
import {
  getActiveWhiteLabelBrand,
  getFinerWorksCatalogSnapshot,
   getWhiteLabelBrandById,
  handleFinerWorksApiRequest,
  renderCertificateOfAuthenticityHtml,
  renderPackingSlipHtmlPreview,
  setActiveWhiteLabelBrand,
  syncFinerWorksCatalogAndPrices,
  WHITE_LABEL_BRAND_LIST,
} from '../finerworks-catalog-sync';

export interface FinerWorksBrandAndSyncModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialTab?: 'brand-identity' | 'catalog-sync';
  activeBrand?: WhiteLabelBrandIdentitySpec;
  activeBrandId?: WhiteLabelBrandId;
  onSelectBrand?: (brand: WhiteLabelBrandIdentitySpec) => void;
  onBrandUpdated?: (brand: WhiteLabelBrandIdentitySpec) => void;
  catalogSnapshot?: FinerWorksCatalogSyncSnapshot;
  snapshot?: FinerWorksCatalogSyncSnapshot;
  onSyncCatalogNow?: (snapshot?: FinerWorksCatalogSyncSnapshot) => void;
  onSnapshotUpdated?: (snapshot: FinerWorksCatalogSyncSnapshot) => void;
  artworkTitle?: string;
  finerworksProductCode?: string;
  collectorName?: string;
}

export const FinerWorksBrandAndSyncModal: React.FC<FinerWorksBrandAndSyncModalProps> = ({
  isOpen = true,
  onClose,
  initialTab = 'brand-identity',
  activeBrand,
  activeBrandId,
  onSelectBrand,
  onBrandUpdated,
  catalogSnapshot,
  snapshot: snapshotProp,
  onSyncCatalogNow,
  onSnapshotUpdated,
  artworkTitle = 'Architectural Study No. 01',
  finerworksProductCode = '5M42M9S24X36F131S29X41J2S24X36G1',
  collectorName = 'Clara Vance · Private Collector',
}) => {
  const incomingSnapshot = catalogSnapshot ?? snapshotProp;
  const [activeTab, setActiveTab] = useState<'brand-identity' | 'catalog-sync'>(initialTab);
  const [currentBrand, setCurrentBrand] = useState<WhiteLabelBrandIdentitySpec>(() => {
    if (activeBrand) {
      return activeBrand;
    }
    if (activeBrandId) {
      return getWhiteLabelBrandById(activeBrandId);
    }
    return getActiveWhiteLabelBrand();
  });

  const [snapshot, setSnapshot] = useState<FinerWorksCatalogSyncSnapshot>(() => {
    return incomingSnapshot ?? getFinerWorksCatalogSnapshot();
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (activeBrand) {
      setCurrentBrand(activeBrand);
    } else if (activeBrandId) {
      setCurrentBrand(getWhiteLabelBrandById(activeBrandId));
    }
  }, [activeBrand, activeBrandId]);

  useEffect(() => {
    if (incomingSnapshot) {
      setSnapshot(incomingSnapshot);
    }
  }, [incomingSnapshot]);

  const packingSlipHtml = useMemo(
    () =>
      renderPackingSlipHtmlPreview(currentBrand, {
        artworkTitle,
        productCode: finerworksProductCode,
        collectorName,
      }),
    [currentBrand, artworkTitle, finerworksProductCode, collectorName]
  );

  const coaHtml = useMemo(
    () =>
      renderCertificateOfAuthenticityHtml(currentBrand, {
        artworkTitle,
        productCode: finerworksProductCode,
        collectorName,
      }),
    [currentBrand, artworkTitle, finerworksProductCode, collectorName]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMedia = useMemo(() => {
    if (!normalizedQuery) return snapshot.mediaSpecs;
    return snapshot.mediaSpecs.filter(
      (m) =>
        m.name.toLowerCase().includes(normalizedQuery) ||
        m.shortName.toLowerCase().includes(normalizedQuery) ||
        m.description.toLowerCase().includes(normalizedQuery) ||
        String(m.mediaId).includes(normalizedQuery)
    );
  }, [snapshot.mediaSpecs, normalizedQuery]);

  const filteredFrames = useMemo(() => {
    if (!normalizedQuery) return snapshot.frameMouldings;
    return snapshot.frameMouldings.filter(
      (f) =>
        f.name.toLowerCase().includes(normalizedQuery) ||
        f.collectionName.toLowerCase().includes(normalizedQuery) ||
        f.materialDescription.toLowerCase().includes(normalizedQuery) ||
        String(f.finerworksFrameId).includes(normalizedQuery)
    );
  }, [snapshot.frameMouldings, normalizedQuery]);

  const filteredMats = useMemo(() => {
    if (!normalizedQuery) return snapshot.matBoards;
    return snapshot.matBoards.filter(
      (m) =>
        m.name.toLowerCase().includes(normalizedQuery) ||
        m.composite.toLowerCase().includes(normalizedQuery) ||
        String(m.finerworksMatId).includes(normalizedQuery)
    );
  }, [snapshot.matBoards, normalizedQuery]);

  const filteredGlazing = useMemo(() => {
    if (!normalizedQuery) return snapshot.glazingOptions;
    return snapshot.glazingOptions.filter(
      (g) =>
        g.name.toLowerCase().includes(normalizedQuery) ||
        g.description.toLowerCase().includes(normalizedQuery) ||
        String(g.finerworksGlassId).includes(normalizedQuery)
    );
  }, [snapshot.glazingOptions, normalizedQuery]);

  const filteredSizes = useMemo(() => {
    if (!normalizedQuery) return snapshot.sizeOptions;
    return snapshot.sizeOptions.filter(
      (s) =>
        s.labelInches.toLowerCase().includes(normalizedQuery) ||
        s.scaleCategory.toLowerCase().includes(normalizedQuery) ||
        s.id.toLowerCase().includes(normalizedQuery)
    );
  }, [snapshot.sizeOptions, normalizedQuery]);

  if (!isOpen) {
    return null;
  }

  const handleSelectBrandCard = (brand: WhiteLabelBrandIdentitySpec) => {
    const updated = setActiveWhiteLabelBrand(brand.id);
    setCurrentBrand(updated);
    if (typeof fetch === 'function' && typeof window !== 'undefined') {
      void fetch('/api/finerworks/update-branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          business_info: brand.businessInfo,
        }),
      }).catch(() =>
        handleFinerWorksApiRequest('update-branding', 'PUT', {
          brandId: brand.id,
          business_info: brand.businessInfo,
        })
      );
    } else {
      void handleFinerWorksApiRequest('update-branding', 'PUT', {
        brandId: brand.id,
        business_info: brand.businessInfo,
      });
    }
    onSelectBrand?.(updated);
    onBrandUpdated?.(updated);
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const synced = await syncFinerWorksCatalogAndPrices({ forceNetwork: true });
      setSnapshot(synced);
      onSyncCatalogNow?.(synced);
      onSnapshotUpdated?.(synced);
    } finally {
      setIsSyncing(false);
    }
  };

  const formattedSyncTime = new Date(snapshot.lastSyncedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      data-testid="finerworks-brand-and-sync-modal"
      role="dialog"
      aria-modal="true"
      aria-label="White-Label Brand Identity & Archival Catalog Studio"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1C18]/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-[#DFD7C8] bg-[#FAF6EE] text-[#1F1C18] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DFD7C8] bg-[#F5F0E6] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#9E5A3C]/15 text-[#9E5A3C] border border-[#9E5A3C]/30">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9E5A3C]">
                  Blind-Ship Gallery Fulfillment &amp; Live SKU Registry
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#2E4A3E]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#2E4A3E]">
                  <ShieldCheck className="h-3 w-3" />
                  600×180 Logo Verified
                </span>
              </div>
              <h2 className="font-serif text-xl font-semibold tracking-tight text-[#1F1C18]">
                White-Label Brand Identity &amp; Archival Catalog Studio
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-xs text-[#6B6358]">
              <span>
                Active Gallery: <strong className="text-[#1F1C18]">{currentBrand.brandName}</strong>
              </span>
              <span>
                Synced Options:{' '}
                <strong className="text-[#2E4A3E]">{snapshot.totalOptionsSyncedCount}</strong>
              </span>
            </div>
            <button
              type="button"
              data-testid="close-brand-and-sync-modal-btn"
              onClick={() => onClose?.()}
              aria-label="Close White-Label Brand Identity & Archival Studio modal"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-3.5 py-2 text-xs font-medium text-[#1F1C18] hover:border-[#9E5A3C] hover:bg-[#F5F0E6] transition-colors"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[#DFD7C8] bg-[#F5F0E6]/70 px-6 py-2.5">
          <div className="flex items-center gap-2" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'brand-identity'}
              data-testid="tab-brand-identity-picker"
              onClick={() => setActiveTab('brand-identity')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'brand-identity'
                  ? 'bg-[#9E5A3C] text-[#FAF6EE] shadow-sm'
                  : 'bg-[#FAF6EE] text-[#5C5449] border border-[#DFD7C8] hover:border-[#9E5A3C]/50'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>White-Label Brand Identity Picker (5 Galleries)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'catalog-sync'}
              data-testid="tab-finerworks-sync-status"
              onClick={() => setActiveTab('catalog-sync')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'catalog-sync'
                  ? 'bg-[#2E4A3E] text-[#FAF6EE] shadow-sm'
                  : 'bg-[#FAF6EE] text-[#5C5449] border border-[#DFD7C8] hover:border-[#2E4A3E]/50'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Archival Catalog &amp; Price Sync ({snapshot.totalOptionsSyncedCount})</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-[#6B6358]">
            <Sparkles className="h-3.5 w-3.5 text-[#9E5A3C]" />
            <span>Zero Fulfiller Marks on Collector Parcel · Anonymous Gallery Return Address</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'brand-identity' ? (
            <div className="space-y-6">
              {/* 5 Curated Brand Cards */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-serif text-base font-semibold text-[#1F1C18]">
                      Select Your White-Label Gallery Identity
                    </h3>
                    <p className="text-xs text-[#6B6358]">
                      Every physical edition ships blind under your chosen gallery imprint with a
                      600×180px packing slip header and dedicated return address.
                    </p>
                  </div>
                  <span className="rounded-lg border border-[#DFD7C8] bg-[#F5F0E6] px-3 py-1 text-xs font-medium text-[#2E4A3E]">
                    Active Return Origin: {currentBrand.businessInfo.company_name} (
                    {currentBrand.businessInfo.city}, {currentBrand.businessInfo.state_code})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {WHITE_LABEL_BRAND_LIST.map((brand) => {
                    const isSelected = brand.id === currentBrand.id;
                    return (
                      <button
                        key={brand.id}
                        type="button"
                        data-testid={`brand-option-card-${brand.id}`}
                        aria-pressed={isSelected}
                        onClick={() => handleSelectBrandCard(brand)}
                        className={`group flex flex-col text-left rounded-xl border p-4 transition-all ${
                          isSelected
                            ? 'border-[#9E5A3C] bg-[#F5F0E6] ring-2 ring-[#9E5A3C]/30 shadow-md'
                            : 'border-[#DFD7C8] bg-[#FAF6EE] hover:border-[#9E5A3C]/60 hover:bg-[#F5F0E6]/60'
                        }`}
                      >
                        <div className="mb-3 overflow-hidden rounded-lg border border-[#DFD7C8] bg-[#FAF6EE]">
                          <img
                            src={brand.logoDataUrl}
                            alt={`${brand.brandName} 600x180 packing slip logo`}
                            className="w-full h-auto rounded border border-[#DFD7C8]"
                          />
                        </div>

                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <div className="font-serif text-base font-semibold text-[#1F1C18] flex items-center gap-1.5">
                              <span>{brand.brandName}</span>
                              {brand.isFlagshipDefault && (
                                <span className="rounded bg-[#9E5A3C]/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-[#9E5A3C]">
                                  Flagship
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-medium text-[#9E5A3C]">
                              {brand.tagline}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#2E4A3E] px-2 py-0.5 text-[10px] font-semibold text-[#FAF6EE]">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-[#6B6358] mb-2">
                          {brand.id === 'atelier-koma'
                            ? `${brand.establishedYear} · Bespoke Fine Art Salon`
                            : `${brand.originCity} · Est. ${brand.establishedYear}`}
                        </div>

                        <p className="text-xs text-[#4A443D] line-clamp-2 mb-3">
                          {brand.brandPersonaDescription}
                        </p>

                        <div className="mt-auto rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] p-2.5 text-[11px] text-[#4A443D]">
                          <div className="font-semibold uppercase tracking-wider text-[10px] text-[#2E4A3E] mb-0.5">
                            Anonymous Blind-Ship Return Address
                          </div>
                          <div className="font-medium text-[#1F1C18]">
                            {brand.businessInfo.company_name}
                          </div>
                          <div>{brand.businessInfo.address_1}</div>
                          <div>
                            {brand.businessInfo.city}, {brand.businessInfo.state_code}{' '}
                            {brand.businessInfo.zip_postal_code}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Packing Slip & Signed COA Previews */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-[#DFD7C8]">
                <div className="flex flex-col rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-[#9E5A3C]" />
                      <h4 className="font-serif text-sm font-semibold text-[#1F1C18]">
                        Unpriced 600×180px White-Label Packing Slip Preview
                      </h4>
                    </div>
                    <span className="rounded bg-[#2E4A3E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#2E4A3E]">
                      Collector-Safe · Unpriced
                    </span>
                  </div>
                  <div
                    data-testid="brand-modal-packing-slip-preview"
                    className="rounded-lg overflow-hidden border border-[#DFD7C8] bg-[#FAF6EE] text-xs"
                    dangerouslySetInnerHTML={{ __html: packingSlipHtml }}
                  />
                </div>

                <div className="flex flex-col rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-[#2E4A3E]" />
                      <h4 className="font-serif text-sm font-semibold text-[#1F1C18]">
                        Signed Certificate of Authenticity (COA) Preview
                      </h4>
                    </div>
                    <span className="rounded bg-[#9E5A3C]/15 px-2 py-0.5 text-[10px] font-semibold text-[#9E5A3C]">
                      Curator Signed · {currentBrand.coaSpec.chiefCuratorName}
                    </span>
                  </div>
                  <div
                    data-testid="brand-modal-coa-preview"
                    className="rounded-lg overflow-hidden border border-[#DFD7C8] bg-[#FAF6EE] text-xs"
                    dangerouslySetInnerHTML={{ __html: coaHtml }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sync Status Metrics Header */}
              <div
                data-testid="finerworks-sync-metrics-grid"
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-4"
              >
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 flex-1">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6358]">
                      Total Options Synced
                    </div>
                    <div className="font-serif text-lg font-bold text-[#2E4A3E]">
                      {snapshot.totalOptionsSyncedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6358]">
                      Sync Version
                    </div>
                    <div className="font-mono text-sm font-semibold text-[#1F1C18]">
                      v{snapshot.syncVersion}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6358]">
                      Sync Source
                    </div>
                    <div className="text-xs font-semibold text-[#9E5A3C]">
                      {snapshot.syncSource}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6358]">
                      Last Synced At
                    </div>
                    <div className="text-xs font-medium text-[#1F1C18]">{formattedSyncTime}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6358]">
                      Dispatch Safeguard
                    </div>
                    <div className="text-xs font-semibold text-[#2E4A3E]">
                      {snapshot.isTestMode ? 'Test Mode Active (Safe)' : 'Live Production'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="trigger-finerworks-sync-btn"
                  disabled={isSyncing}
                  onClick={() => {
                    void handleTriggerSync();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2E4A3E] px-4 py-2.5 text-xs font-semibold text-[#FAF6EE] hover:bg-[#243B31] disabled:opacity-60 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncing
                      ? 'Syncing Archival Catalog...'
                      : 'Sync Archival Catalog & Prices Now'}
                  </span>
                </button>
              </div>

              {/* Search Filter Bar */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6358]" />
                <input
                  type="search"
                  data-testid="finerworks-catalog-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter synced archival substrates, hardwood mouldings, cotton rag mats, glazing, or sizes..."
                  className="w-full rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] pl-10 pr-4 py-2.5 text-xs text-[#1F1C18] placeholder-[#8A8175] focus:border-[#9E5A3C] focus:outline-none"
                />
              </div>

              {/* Synced Archival Media Specs */}
              <div data-testid="finerworks-media-specs-list" className="space-y-2.5">
                <h4 className="font-serif text-sm font-semibold text-[#1F1C18] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#9E5A3C]" />
                  <span>
                    Synced Archival Substrates &amp; Media ({filteredMedia.length} of{' '}
                    {snapshot.mediaSpecs.length})
                  </span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMedia.map((media) => (
                    <div
                      key={media.mediaId}
                      className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6]/70 p-3 text-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-[#1F1C18]">{media.name}</span>
                          <span className="font-mono text-[11px] rounded bg-[#9E5A3C]/15 px-2 py-0.5 text-[#9E5A3C] font-semibold">
                            MediaID {media.mediaId} · Type {media.productTypeId}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5C5449] mb-2">{media.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DFD7C8]/70 text-[11px] text-[#6B6358]">
                        <span>
                          {media.gsmOrThicknessLabel} · Bleed {media.bleedInches}&quot;
                        </span>
                        <span>
                          Bounds: {media.minWidthIn}&quot;×{media.minHeightIn}&quot; to{' '}
                          {media.maxWidthIn}&quot;×{media.maxHeightIn}&quot;
                        </span>
                        <span className="font-semibold text-[#2E4A3E]">
                          Min ${media.minimumUnitPriceUsd.toFixed(2)} (${media.baseRatePerSqInchUsd}/sq.in)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Synced Frame Mouldings */}
              <div data-testid="finerworks-frame-mouldings-list" className="space-y-2.5">
                <h4 className="font-serif text-sm font-semibold text-[#1F1C18] flex items-center gap-2">
                  <Frame className="h-4 w-4 text-[#2E4A3E]" />
                  <span>
                    Synced Frame Mouldings ({filteredFrames.length} of{' '}
                    {snapshot.frameMouldings.length})
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredFrames.map((frame) => (
                    <div
                      key={frame.profileId}
                      className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6]/70 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-[#1F1C18]">{frame.name}</span>
                        <span className="font-mono text-[11px] rounded bg-[#2E4A3E]/15 px-2 py-0.5 text-[#2E4A3E] font-semibold">
                          F{frame.finerworksFrameId}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5C5449] mb-2">
                        {frame.collectionName} · {frame.materialDescription}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6B6358] pt-1.5 border-t border-[#DFD7C8]/70">
                        <span>
                          Width {frame.thicknessInches}&quot; · Rabbet {frame.rabbetInches}&quot;
                        </span>
                        <span className="font-semibold text-[#1F1C18]">
                          Base ${frame.startingPriceUsd.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Synced Mat Boards, Glazing & Standard Sizes */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div
                  data-testid="finerworks-mat-boards-list"
                  className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6]/60 p-3.5 space-y-2"
                >
                  <h5 className="font-serif text-xs font-semibold uppercase tracking-wider text-[#9E5A3C]">
                    4-Ply Cotton Rag Mats ({filteredMats.length})
                  </h5>
                  <div className="space-y-1.5">
                    {filteredMats.map((mat) => (
                      <div
                        key={mat.finerworksMatId}
                        className="flex items-center justify-between rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-[#1F1C18]/30"
                            style={{ backgroundColor: mat.hex }}
                          />
                          <span className="font-medium text-[#1F1C18]">{mat.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-[#6B6358]">
                          J{mat.finerworksMatId} · ${mat.startingPriceUsd.toFixed(0)}+
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  data-testid="finerworks-glazing-options-list"
                  className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6]/60 p-3.5 space-y-2"
                >
                  <h5 className="font-serif text-xs font-semibold uppercase tracking-wider text-[#2E4A3E]">
                    Conservation Glazing ({filteredGlazing.length})
                  </h5>
                  <div className="space-y-1.5">
                    {filteredGlazing.map((glass) => (
                      <div
                        key={glass.finerworksGlassId}
                        className="flex items-center justify-between rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] px-2.5 py-1.5 text-xs"
                      >
                        <div>
                          <div className="font-medium text-[#1F1C18]">{glass.shortLabel}</div>
                          <div className="text-[10px] text-[#6B6358]">
                            UV {glass.uvFilteringPercent}% Filtration
                          </div>
                        </div>
                        <span className="font-mono text-[11px] text-[#2E4A3E] font-semibold">
                          G{glass.finerworksGlassId} · ${glass.startingPriceUsd.toFixed(0)}+
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  data-testid="finerworks-size-options-list"
                  className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6]/60 p-3.5 space-y-2"
                >
                  <h5 className="font-serif text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
                    Standard &amp; Custom Sizes ({filteredSizes.length})
                  </h5>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {filteredSizes.map((size) => (
                      <div
                        key={size.id}
                        className="flex items-center justify-between rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] px-2.5 py-1 text-[11px]"
                      >
                        <span className="font-semibold text-[#1F1C18]">{size.labelInches}</span>
                        <span className="text-[#6B6358]">{size.scaleCategory}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
