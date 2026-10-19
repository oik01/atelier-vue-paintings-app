// src/subsystems/commerce-fulfillment/LookbookAndOrdersDrawer.tsx
// Leaf 4C — Saved Wall Lookbook Comparison Drawer & Order History / Partner Manifest Inspector
// Supports Mobile Bottom-Sheet (<768px) and Desktop Slide-Over Drawer (>=768px)

import React, { useEffect, useState } from 'react';
import {
  FRAME_PROFILES,
  LookbookPin,
  OrderRecord,
  PRINT_PARTNERS,
  PRINT_SIZES,
} from '../../contracts/masterContract';
import {
  MAT_COLOR_OPTIONS,
  MAT_WIDTH_OPTIONS,
  PRINT_SUBSTRATES,
} from './printPartnerPricingEngine';
import { useAtelierStore } from './studioStoreAndPersistence';

export type DrawerModeTab = 'lookbook' | 'orders';

export interface LookbookAndOrdersDrawerProps {
  isOpen?: boolean;
  initialTab?: DrawerModeTab;
  activeTab?: DrawerModeTab;
  onClose?: () => void;
  onSelectTab?: (tab: DrawerModeTab) => void;
  pinnedLookbook?: LookbookPin[];
  orders?: OrderRecord[];
  onPinCurrentWall?: () => void;
  onRestorePin?: (pinId: string) => void;
  onAcquirePin?: (pin: LookbookPin) => void;
  onRemovePin?: (pinId: string) => void;
  onClearLookbook?: () => void;
  onClearOrders?: () => void;
}

function downloadOrderManifestJson(order: OrderRecord): void {
  if (typeof document === 'undefined') return;
  try {
    const filename = `${order.id}-${order.pricing.partnerId}-manifest.json`;
    const blob = new Blob([order.partnerOrderPayloadJson], { type: 'application/json' });
    const link = document.createElement('a');
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      }, 2500);
    } else {
      link.href = `data:application/json;charset=utf-8,${encodeURIComponent(
        order.partnerOrderPayloadJson
      )}`;
    }
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    // Safe fallback in headless tests
  }
}

function formatPanelLayoutLabel(layout: LookbookPin['panelLayout']): string {
  if (layout === 'diptych') return 'Diptych';
  if (layout === 'triptych') return 'Triptych';
  return 'Single';
}

export const LookbookAndOrdersDrawer: React.FC<LookbookAndOrdersDrawerProps> = (props) => {
  const store = useAtelierStore();

  const isOpen = props.isOpen !== undefined ? props.isOpen : store.isLookbookDrawerOpen;
  const resolvedStoreTab = store.activeDrawerTab ?? 'lookbook';
  const [localTab, setLocalTab] = useState<DrawerModeTab>(
    props.activeTab ?? props.initialTab ?? resolvedStoreTab
  );
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (props.activeTab) {
      setLocalTab(props.activeTab);
    } else if (props.initialTab) {
      setLocalTab(props.initialTab);
    } else if (store.activeDrawerTab) {
      setLocalTab(store.activeDrawerTab);
    }
  }, [props.activeTab, props.initialTab, store.activeDrawerTab, isOpen]);

  const activeTab: DrawerModeTab = props.activeTab ?? localTab;
  const pinnedLookbook = props.pinnedLookbook ?? store.pinnedLookbook;
  const orders = props.orders ?? store.orders;

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (props.onClose) {
      props.onClose();
    } else {
      store.closeLookbookDrawer();
    }
  };

  const handleTabSwitch = (nextTab: DrawerModeTab) => {
    setLocalTab(nextTab);
    if (props.onSelectTab) {
      props.onSelectTab(nextTab);
    } else {
      store.openLookbookDrawer(nextTab);
    }
  };

  const handlePinCurrent = () => {
    if (props.onPinCurrentWall) {
      props.onPinCurrentWall();
    } else {
      store.pinCurrentWallToLookbook();
    }
  };

  const handleRestorePin = (pinId: string) => {
    if (props.onRestorePin) {
      props.onRestorePin(pinId);
    } else {
      store.applyLookbookPin(pinId);
    }
  };

  const handleAcquirePin = (pin: LookbookPin) => {
    if (props.onAcquirePin) {
      props.onAcquirePin(pin);
    } else {
      store.applyLookbookPin(pin.id);
      store.closeLookbookDrawer();
      store.openCheckoutModal('partner-printed-edition');
    }
  };

  const handleRemovePin = (pinId: string) => {
    if (props.onRemovePin) {
      props.onRemovePin(pinId);
    } else {
      store.removeLookbookPin(pinId);
    }
  };

  const toggleExpandManifest = (orderId: string) => {
    setExpandedOrderIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-[#161514]/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lookbook-drawer-title"
      data-testid="lookbook-and-orders-drawer"
    >
      <div className="rounded-t-[12px] md:rounded-none max-h-[92dvh] md:max-h-none md:h-full w-full max-w-xl flex flex-col bg-[#F6F4EF] text-[#161514] border-t md:border-t-0 md:border-l border-[#E2DDD3] shadow-2xl overflow-hidden">
        {/* Mobile Drag Handle Pill */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1.5 w-11 rounded-full bg-[#CFC9BC]" aria-hidden="true" />
        </div>

        {/* Sticky Header */}
        <header className="shrink-0 border-b border-[#E2DDD3] bg-[#F6F4EF] px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#B85D3B]">
              CURATORIAL ARCHIVE &amp; FULFILLMENT
            </span>
            <h2
              id="lookbook-drawer-title"
              className="font-serif text-lg md:text-xl font-normal text-[#161514]"
            >
              Saved Wall Lookbook &amp; Order Ledger
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            data-testid="drawer-close-btn"
            aria-label="Close lookbook and orders drawer"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[4px] border border-[#E2DDD3] bg-[#FFFFFF] text-[#161514] hover:bg-[#EFECE6] transition-colors shrink-0 px-3 text-sm font-medium"
          >
            ✕
          </button>
        </header>

        {/* Two Mode Tabs */}
        <div className="shrink-0 bg-[#EFECE6] border-b border-[#E2DDD3] px-4 py-2 md:px-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="drawer-tab-lookbook"
            onClick={() => handleTabSwitch('lookbook')}
            className={`min-h-[44px] px-3 py-2 rounded-[4px] font-mono text-xs font-medium transition-all flex items-center justify-between border ${
              activeTab === 'lookbook'
                ? 'bg-[#FFFFFF] border-[#B85D3B] text-[#161514] shadow-sm'
                : 'bg-[#F6F4EF]/70 border-[#E2DDD3] text-[#5C5852] hover:text-[#161514]'
            }`}
          >
            <span>Saved Wall Lookbook</span>
            <span className="px-1.5 py-0.5 rounded bg-[#EFECE6] text-[#161514] tabular-nums">
              {pinnedLookbook.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="drawer-tab-orders"
            onClick={() => handleTabSwitch('orders')}
            className={`min-h-[44px] px-3 py-2 rounded-[4px] font-mono text-xs font-medium transition-all flex items-center justify-between border ${
              activeTab === 'orders'
                ? 'bg-[#FFFFFF] border-[#2E4A3E] text-[#161514] shadow-sm'
                : 'bg-[#F6F4EF]/70 border-[#E2DDD3] text-[#5C5852] hover:text-[#161514]'
            }`}
          >
            <span>Order History &amp; Manifests</span>
            <span className="px-1.5 py-0.5 rounded bg-[#EFECE6] text-[#161514] tabular-nums">
              {orders.length}
            </span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {activeTab === 'lookbook' ? (
            /* Tab 1: Saved Wall Lookbook */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FFFFFF] border border-[#E2DDD3] rounded-[6px] p-3.5">
                <div>
                  <div className="text-xs font-semibold text-[#161514]">
                    Compare Pinned Wall Configurations
                  </div>
                  <div className="text-[11px] text-[#5C5852]">
                    Snapshot the active room, painting, scale, frame, matboard, and wall coordinates
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="drawer-pin-current-btn"
                  onClick={handlePinCurrent}
                  className="min-h-[44px] px-3.5 py-2 rounded-[4px] bg-[#161514] hover:bg-[#B85D3B] text-[#FFFFFF] text-xs font-mono transition-colors"
                >
                  + Pin Current Wall Setup
                </button>
              </div>

              {pinnedLookbook.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-[#E2DDD3] bg-[#FFFFFF]/60 p-8 text-center space-y-2">
                  <div className="font-serif text-base text-[#161514]">
                    No Pinned Wall Setups Yet
                  </div>
                  <p className="text-xs text-[#5C5852] max-w-sm mx-auto">
                    Pin combinations of paintings, physical sizes, and museum frames while exploring
                    your room to compare them side by side before ordering.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pinnedLookbook.map((pin) => {
                    const sizeSpec = PRINT_SIZES[pin.sizeId] ?? PRINT_SIZES['24x36'];
                    const frameSpec =
                      FRAME_PROFILES[pin.frameId] ?? FRAME_PROFILES['natural-white-oak'];
                    const matWidthSpec =
                      MAT_WIDTH_OPTIONS[pin.matWidthId] ?? MAT_WIDTH_OPTIONS['2.5in'];
                    const matColorSpec =
                      MAT_COLOR_OPTIONS[pin.matColorId] ?? MAT_COLOR_OPTIONS['archival-ivory'];
                    const layoutLabel = formatPanelLayoutLabel(pin.panelLayout);

                    return (
                      <article
                        key={pin.id}
                        data-testid={`lookbook-pin-card-${pin.id}`}
                        className="bg-[#FFFFFF] border border-[#E2DDD3] rounded-[6px] p-3.5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Mini Framed Artwork Swatch Preview */}
                            <div
                              className="w-14 h-16 rounded-[2px] shrink-0 p-1 flex items-center justify-center shadow-sm"
                              style={{
                                backgroundColor: frameSpec.primaryHex,
                                border: `2px solid ${frameSpec.secondaryHex}`,
                              }}
                            >
                              <div
                                className="w-full h-full flex flex-col overflow-hidden"
                                style={{
                                  padding: pin.matWidthId === 'none' ? '0px' : '3px',
                                  backgroundColor: matColorSpec.hex,
                                }}
                              >
                                <div
                                  className="w-full h-full"
                                  style={{
                                    background: `linear-gradient(135deg, ${
                                      pin.painting.pigments[0]?.hex ?? '#C87D55'
                                    }, ${pin.painting.pigments[1]?.hex ?? '#D9CDB8'}, ${
                                      pin.painting.pigments[2]?.hex ?? '#3E4E56'
                                    })`,
                                  }}
                                />
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#5C5852]">
                                <span>{pin.painting.catalogNumber}</span>
                                <span>•</span>
                                <span className="truncate">{pin.roomId}</span>
                              </div>
                              <h3 className="font-serif text-base text-[#161514] truncate">
                                {pin.painting.title}
                              </h3>
                              <div className="text-xs text-[#5C5852] mt-0.5">
                                {sizeSpec.labelInches} ·{' '}
                                {pin.orientation.charAt(0).toUpperCase() + pin.orientation.slice(1)}{' '}
                                · {layoutLabel}
                              </div>
                              <div className="text-[11px] text-[#5C5852]">
                                {frameSpec.name} · {matWidthSpec.label} ({matColorSpec.name})
                              </div>
                              <div className="font-mono text-[10px] text-[#5C5852] mt-0.5 tabular-nums">
                                Wall Mount: ({Math.round(pin.placement.centerX * 100)}%,{' '}
                                {Math.round(pin.placement.centerY * 100)}%) · Wall{' '}
                                {pin.placement.wallWidthInches}&quot;
                              </div>
                            </div>
                          </div>

                          <div className="text-right font-mono tabular-nums shrink-0">
                            <div className="text-sm font-semibold text-[#B85D3B]">
                              ${pin.retailPriceUsd.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-[#5C5852]">Retail Edition</div>
                          </div>
                        </div>

                        {/* Pigment Swatch Strip */}
                        <div className="flex items-center gap-1.5">
                          {pin.painting.pigments.slice(0, 6).map((pigment, idx) => (
                            <span
                              key={idx}
                              title={`${pigment.pigmentName} (${pigment.hex})`}
                              className="h-3 w-6 rounded-[2px] border border-[#E2DDD3]"
                              style={{ backgroundColor: pigment.hex }}
                            />
                          ))}
                        </div>

                        {/* Card Actions (min-h-[44px]) */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E2DDD3]">
                          <button
                            type="button"
                            data-testid={`lookbook-restore-${pin.id}`}
                            onClick={() => handleRestorePin(pin.id)}
                            className="min-h-[44px] px-2.5 py-2 rounded-[4px] border border-[#E2DDD3] bg-[#F6F4EF] hover:bg-[#EFECE6] text-xs font-medium text-[#161514] transition-colors"
                          >
                            Restore to Wall
                          </button>

                          <button
                            type="button"
                            data-testid={`lookbook-acquire-${pin.id}`}
                            onClick={() => handleAcquirePin(pin)}
                            className="min-h-[44px] px-2.5 py-2 rounded-[4px] bg-[#B85D3B] hover:bg-[#A04E2F] text-xs font-medium text-[#FFFFFF] transition-colors"
                          >
                            Order / Acquire
                          </button>

                          <button
                            type="button"
                            data-testid={`lookbook-remove-${pin.id}`}
                            onClick={() => handleRemovePin(pin.id)}
                            className="min-h-[44px] px-2.5 py-2 rounded-[4px] border border-[#E2DDD3] bg-[#FFFFFF] hover:bg-[#EFECE6] text-xs font-medium text-[#5C5852] hover:text-[#161514] transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Order History & Partner Manifests */
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-[#E2DDD3] bg-[#FFFFFF]/60 p-8 text-center space-y-2">
                  <div className="font-serif text-base text-[#161514]">
                    No Completed Orders Recorded Yet
                  </div>
                  <p className="text-xs text-[#5C5852] max-w-sm mx-auto">
                    Orders placed for Partner Printed &amp; Framed Editions or 300-DPI Digital Print
                    Masters appear here with full wholesale-to-retail breakdowns and JSON manifests.
                  </p>
                </div>
              ) : (
                orders.map((order) => {
                  const sizeSpec = PRINT_SIZES[order.sizeId] ?? PRINT_SIZES['24x36'];
                  const frameSpec =
                    FRAME_PROFILES[order.frameId] ?? FRAME_PROFILES['natural-white-oak'];
                  const substrateSpec =
                    PRINT_SUBSTRATES[order.substrateId] ??
                    PRINT_SUBSTRATES['hahnemuhle-etching-310gsm'];
                  const partnerSpec =
                    PRINT_PARTNERS[order.pricing.partnerId] ?? PRINT_PARTNERS.prodigi;
                  const isExpanded = !!expandedOrderIds[order.id];
                  const isPartnerEdition = order.orderType === 'partner-printed-edition';

                  return (
                    <article
                      key={order.id}
                      data-testid={`order-history-card-${order.id}`}
                      className="bg-[#FFFFFF] border border-[#E2DDD3] rounded-[6px] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E2DDD3] pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-[#161514]">
                              {order.id}
                            </span>
                            <span
                              className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                                order.status === 'dispatched-to-partner'
                                  ? 'bg-[#B85D3B]/15 text-[#B85D3B]'
                                  : 'bg-[#2E4A3E]/15 text-[#2E4A3E]'
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <h3 className="font-serif text-base text-[#161514] mt-1">
                            {order.painting.catalogNumber} · {order.painting.title}
                          </h3>
                          <div className="text-xs text-[#5C5852]">
                            {sizeSpec.labelInches} · {frameSpec.name} · {substrateSpec.shortName}
                          </div>
                        </div>

                        <div className="text-right font-mono tabular-nums">
                          <div className="text-sm font-semibold text-[#161514]">
                            $
                            {isPartnerEdition
                              ? order.pricing.physicalRetailTotalUsd.toFixed(2)
                              : order.pricing.digitalMasterLicenseUsd.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-[#5C5852]">
                            {isPartnerEdition
                              ? partnerSpec.websiteDomain
                              : '300-DPI Print Master'}
                          </div>
                        </div>
                      </div>

                      {/* Wholesale vs. Studio Markup Breakdown */}
                      <div className="bg-[#F6F4EF] border border-[#E2DDD3] rounded-[4px] p-2.5 font-mono text-[11px] tabular-nums space-y-1">
                        <div className="flex justify-between text-[#5C5852]">
                          <span>
                            Partner Wholesale ({partnerSpec.websiteDomain} Print $
                            {order.pricing.partnerBasePrintCostUsd.toFixed(2)} + Frame $
                            {order.pricing.partnerFrameAndMatCostUsd.toFixed(2)}):
                          </span>
                          <span className="text-[#161514]">
                            ${order.pricing.partnerWholesaleSubtotalUsd.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#B85D3B]">
                          <span>
                            Atelier Studio Markup (+{order.pricing.studioMarkupPercent}%):
                          </span>
                          <span>+${order.pricing.studioMarkupDollarUsd.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#5C5852]">
                          <span>Insured Courier Shipping:</span>
                          <span className="text-[#161514]">
                            ${order.pricing.insuredShippingUsd.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          data-testid={`order-manifest-toggle-${order.id}`}
                          onClick={() => toggleExpandManifest(order.id)}
                          className="min-h-[44px] px-3 py-2 rounded-[4px] border border-[#E2DDD3] bg-[#F6F4EF] hover:bg-[#EFECE6] text-xs font-mono text-[#161514]"
                        >
                          {isExpanded ? 'Hide Partner Manifest JSON' : 'Inspect Partner Manifest JSON'}
                        </button>

                        <button
                          type="button"
                          data-testid={`order-download-manifest-${order.id}`}
                          onClick={() => downloadOrderManifestJson(order)}
                          className="min-h-[44px] px-3.5 py-2 rounded-[4px] bg-[#161514] hover:bg-[#2E4A3E] text-[#FFFFFF] text-xs font-mono transition-colors"
                        >
                          Download Manifest JSON
                        </button>
                      </div>

                      {isExpanded && (
                        <pre
                          data-testid={`order-manifest-json-${order.id}`}
                          className="max-h-52 overflow-auto rounded-[4px] border border-[#E2DDD3] bg-[#161514] text-[#F6F4EF] p-3 font-mono text-[11px] leading-relaxed"
                        >
                          {order.partnerOrderPayloadJson}
                        </pre>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
