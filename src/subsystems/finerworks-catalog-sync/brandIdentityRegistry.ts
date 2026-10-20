// src/subsystems/finerworks-catalog-sync/brandIdentityRegistry.ts
// Subsystem 1 (Leaf 1B) — 5 Curated White-Label Brand Identities, 600x180 SVG Packing Slip Logos,
// Anonymous Gallery Return Addresses & Collector Packing Slip / COA HTML Generators

import type {
  WhiteLabelBrandId,
  WhiteLabelBrandIdentitySpec,
  WhiteLabelBusinessInfo,
} from '../../contracts/masterContract';

export const DEFAULT_WHITE_LABEL_BRAND_ID: WhiteLabelBrandId = 'atelier-koma';
export const WHITE_LABEL_BRAND_STORAGE_KEY = 'atelier_white_label_brand_v3';

function toSvgDataUrl(svgMarkup: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgMarkup);
}

const ATELIER_KOMA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" width="600" height="180" role="img" aria-label="Atelier Vue New Orleans">
  <rect x="0" y="0" width="600" height="180" fill="#F8F3EA" />
  <rect x="12" y="12" width="576" height="156" fill="none" stroke="#7A3E2E" stroke-width="1.5" opacity="0.6" />
  <rect x="18" y="18" width="564" height="144" fill="none" stroke="#3D2B22" stroke-width="0.75" opacity="0.35" />
  <g transform="translate(48, 38)">
    <polygon points="52,4 98,28 98,76 52,100 6,76 6,28" fill="#EFE7D8" stroke="#7A3E2E" stroke-width="1.75" />
    <circle cx="52" cy="52" r="28" fill="none" stroke="#3D2B22" stroke-width="1.25" />
    <text x="52" y="59" text-anchor="middle" fill="#7A3E2E" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="700" letter-spacing="2">AV</text>
  </g>
  <text x="172" y="76" fill="#231B16" font-family="Georgia, 'Times New Roman', serif" font-size="27" font-weight="600" letter-spacing="3.5">ATELIER VUE</text>
  <line x1="172" y1="92" x2="546" y2="92" stroke="#7A3E2E" stroke-width="1" opacity="0.6" />
  <text x="172" y="113" fill="#3D2B22" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9.5" font-weight="600" letter-spacing="1.6">NEW ORLEANS · BESPOKE FINE ART &amp; CONSERVATION FRAMING</text>
  <text x="172" y="135" fill="#6A5B50" font-family="Georgia, 'Times New Roman', serif" font-size="11.5" font-style="italic">Unique Art Pieces Made for You &amp; Your Space</text>
</svg>`;

const GALERIE_VAUBAN_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" width="600" height="180" role="img" aria-label="Galerie Vauban">
  <rect x="0" y="0" width="600" height="180" fill="#F8F3EA" />
  <rect x="12" y="12" width="576" height="156" fill="none" stroke="#7A3E2E" stroke-width="1.5" opacity="0.6" />
  <rect x="18" y="18" width="564" height="144" fill="none" stroke="#3D2B22" stroke-width="0.75" opacity="0.35" />
  <g transform="translate(48, 38)">
    <polygon points="52,4 98,28 98,76 52,100 6,76 6,28" fill="#EFE7D8" stroke="#7A3E2E" stroke-width="1.75" />
    <circle cx="52" cy="52" r="28" fill="none" stroke="#3D2B22" stroke-width="1.25" />
    <text x="52" y="59" text-anchor="middle" fill="#7A3E2E" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="700" letter-spacing="2">GV</text>
  </g>
  <text x="172" y="76" fill="#231B16" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="600" letter-spacing="3.2">GALERIE VAUBAN</text>
  <line x1="172" y1="92" x2="546" y2="92" stroke="#7A3E2E" stroke-width="1" opacity="0.6" />
  <text x="172" y="113" fill="#3D2B22" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9.5" font-weight="600" letter-spacing="1.6">PARIS · ZÜRICH · ÉDITIONS D'ART CONTEMPORAIN</text>
  <text x="172" y="135" fill="#6A5B50" font-family="Georgia, 'Times New Roman', serif" font-size="11" font-style="italic">Tirages d'Archive &amp; Encadrement de Salon · Fondée MMXIV</text>
</svg>`;

const WERKSTATT_NEUE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" width="600" height="180" role="img" aria-label="Werkstatt Neue">
  <rect x="0" y="0" width="600" height="180" fill="#F4F3EF" />
  <rect x="10" y="10" width="580" height="160" fill="none" stroke="#1F2421" stroke-width="2" />
  <line x1="162" y1="10" x2="162" y2="170" stroke="#1F2421" stroke-width="1.5" />
  <g transform="translate(34, 38)">
    <rect x="0" y="0" width="96" height="96" fill="#E6E4DD" stroke="#1F2421" stroke-width="2" />
    <rect x="0" y="0" width="48" height="48" fill="#B6462C" />
    <circle cx="72" cy="72" r="18" fill="#2B4C65" />
    <line x1="0" y1="48" x2="96" y2="48" stroke="#1F2421" stroke-width="1.5" />
    <line x1="48" y1="0" x2="48" y2="96" stroke="#1F2421" stroke-width="1.5" />
  </g>
  <text x="178" y="74" fill="#161817" font-family="'Helvetica Neue', Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="3.5">WERKSTATT NEUE</text>
  <line x1="178" y1="90" x2="548" y2="90" stroke="#B6462C" stroke-width="2" />
  <text x="178" y="113" fill="#2B4C65" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9.5" font-weight="700" letter-spacing="1.8">BERLIN · WIEN · KONSTRUKTIVE RAUMKUNST</text>
  <text x="178" y="135" fill="#4F5450" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10" letter-spacing="0.8">ARCHIVALISCHE MUSEUMSDRUCKE · GEGRÜNDET MMXVII</text>
</svg>`;

const STILLWATER_PRESS_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" width="600" height="180" role="img" aria-label="Stillwater Press">
  <rect x="0" y="0" width="600" height="180" fill="#F6F2E9" />
  <rect x="12" y="12" width="576" height="156" fill="none" stroke="#3B5241" stroke-width="1.5" opacity="0.65" />
  <rect x="17" y="17" width="566" height="146" fill="none" stroke="#8C6239" stroke-width="0.8" opacity="0.45" />
  <g transform="translate(46, 38)">
    <rect x="0" y="0" width="104" height="104" rx="8" fill="#ECE5D5" stroke="#3B5241" stroke-width="1.75" />
    <path d="M52 20 C68 36, 68 68, 52 86 C36 68, 36 36, 52 20 Z" fill="none" stroke="#3B5241" stroke-width="1.6" />
    <line x1="52" y1="18" x2="52" y2="88" stroke="#8C6239" stroke-width="1.4" />
    <line x1="24" y1="74" x2="80" y2="74" stroke="#8C6239" stroke-width="1.2" />
  </g>
  <text x="172" y="76" fill="#1F2821" font-family="Georgia, 'Times New Roman', serif" font-size="25" font-weight="600" letter-spacing="2.8">STILLWATER PRESS</text>
  <line x1="172" y1="92" x2="546" y2="92" stroke="#8C6239" stroke-width="1.1" opacity="0.65" />
  <text x="172" y="113" fill="#3B5241" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9.2" font-weight="600" letter-spacing="1.3">HUDSON VALLEY · PORTLAND · CONSERVATION FRAMING GUILD</text>
  <text x="172" y="135" fill="#5E564B" font-family="Georgia, 'Times New Roman', serif" font-size="11" font-style="italic">Quarter-Sawn Millwork &amp; Heavyweight Rag Press · Est. MMXVI</text>
</svg>`;

const THE_NOCTURNE_ARCHIVE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" width="600" height="180" role="img" aria-label="The Nocturne Archive">
  <rect x="0" y="0" width="600" height="180" fill="#F3EFE8" />
  <rect x="10" y="10" width="580" height="160" fill="none" stroke="#232931" stroke-width="1.6" opacity="0.75" />
  <rect x="16" y="16" width="568" height="148" fill="none" stroke="#9B7A44" stroke-width="0.9" opacity="0.55" />
  <g transform="translate(46, 38)">
    <rect x="0" y="0" width="104" height="104" fill="#232931" stroke="#9B7A44" stroke-width="1.5" />
    <circle cx="48" cy="52" r="28" fill="none" stroke="#EAE3D5" stroke-width="1.5" />
    <circle cx="58" cy="48" r="22" fill="#232931" stroke="#9B7A44" stroke-width="1" />
    <circle cx="34" cy="52" r="3.5" fill="#9B7A44" />
  </g>
  <text x="172" y="75" fill="#1D2228" font-family="Georgia, 'Times New Roman', serif" font-size="21" font-weight="600" letter-spacing="2.2">THE NOCTURNE ARCHIVE</text>
  <line x1="172" y1="92" x2="546" y2="92" stroke="#9B7A44" stroke-width="1.1" opacity="0.75" />
  <text x="172" y="113" fill="#232931" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9.5" font-weight="600" letter-spacing="1.8">LONDON · EDINBURGH · TONAL MONOGRAPHS</text>
  <text x="172" y="135" fill="#5A554E" font-family="Georgia, 'Times New Roman', serif" font-size="11" font-style="italic">Chiaroscuro Pigment Editions &amp; Library Studies · Est. MMXX</text>
</svg>`;

export const WHITE_LABEL_BRAND_IDENTITIES: Record<
  WhiteLabelBrandId,
  WhiteLabelBrandIdentitySpec
> = {
  'atelier-koma': {
    id: 'atelier-koma',
    brandName: 'Atelier Vue',
    tagline: 'Unique Art Pieces Made for You & Your Space',
    establishedYear: 'New Orleans, LA',
    originCity: 'New Orleans',
    brandPersonaDescription:
      'New Orleans salon editions featuring bespoke fine art tailored to your architecture, warm hardwood framing, and museum-grade rag papers.',
    isFlagshipDefault: true,
    logoSvgMarkup: ATELIER_KOMA_LOGO_SVG,
    logoDataUrl: toSvgDataUrl(ATELIER_KOMA_LOGO_SVG),
    businessInfo: {
      first_name: 'Camille',
      last_name: 'Beaumont',
      company_name: 'Atelier Vue',
      address_1: '628 Royal Street, Suite 200',
      address_2: 'French Quarter Archival Salon',
      city: 'New Orleans',
      state_code: 'LA',
      zip_postal_code: '70130',
      country_code: 'US',
      phone: '504-555-0148',
      email: 'curators@atelier-vue.org',
      website: 'https://atelier-vue.org',
    },
    packingSlipSpec: {
      headerTitle: 'ATELIER VUE · NEW ORLEANS ARCHIVAL DISPATCH DOSSIER',
      collectorGreeting:
        'Unique Art Pieces Made for You & Your Space — Issued from our New Orleans salon.',
      curatorialNoteTemplate:
        'Each bespoke art piece is individually calibrated to the natural light, architecture, and material undertones of your space before archival press striking.',
      unboxingCareInstructions: [
        'Allow your parcel to acclimate to room temperature for 2 hours prior to uncrating.',
        'Handle unframed cotton rag borders exclusively with the enclosed conservation cotton gloves.',
        'Hang away from direct unbuffered HVAC vents and prolonged midday UV exposure.',
      ],
      accentHex: '#7A3E2E',
      secondaryHex: '#3D2B22',
      paperTintHex: '#F8F3EA',
    },
    coaSpec: {
      certificateTitle: 'CERTIFICATE OF AUTHENTICITY · ATELIER VUE NEW ORLEANS',
      archivalGuaranteeStatement:
        'Unique Art Pieces Made for You & Your Space · Certified Museum Archival Pigment Striking on Acid-Free Conservation Substrate',
      editionNamingFormat: 'AV-NOLA-EDITION',
      chiefCuratorName: 'Camille Beaumont',
      chiefCuratorTitle: 'Principal Curator · Atelier Vue New Orleans',
      embossedSealLabel: 'ATELIER VUE · NEW ORLEANS ARCHIVAL SEAL',
    },
  },
  'galerie-vauban': {
    id: 'galerie-vauban',
    brandName: 'Galerie Vauban',
    tagline: 'Éditions d’Art Contemporain & Tirages d’Archive',
    establishedYear: 'MMXIV (2014)',
    originCity: 'Paris · Zürich',
    brandPersonaDescription:
      'Continental salon editions featuring classical proportions, deep walnut framing, and mould-made European rag papers.',
    isFlagshipDefault: false,
    logoSvgMarkup: GALERIE_VAUBAN_LOGO_SVG,
    logoDataUrl: toSvgDataUrl(GALERIE_VAUBAN_LOGO_SVG),
    businessInfo: {
      first_name: 'Henri',
      last_name: 'Delacroix',
      company_name: 'Galerie Vauban Éditions d’Art',
      address_1: '782 Madison Avenue, Floor 3',
      address_2: 'Salon des Tirages',
      city: 'New York',
      state_code: 'NY',
      zip_postal_code: '10065',
      country_code: 'US',
      phone: '212-555-0148',
      email: 'archives@galerie-vauban.org',
      website: 'https://galerie-vauban.org',
    },
    packingSlipSpec: {
      headerTitle: 'GALERIE VAUBAN · BORDEREAU DE COLLECTION ARCHIVE',
      collectorGreeting: 'Issued from our private salon registry for your collection.',
      curatorialNoteTemplate:
        'Struck under master press supervision on mould-made European rag and inspected for tonal depth and conservation framing.',
      unboxingCareInstructions: [
        'Unpack flat on a clean conservation surface using the enclosed lint-free handling gloves.',
        'Inspect corner joinery and French cleat hardware prior to wall mounting.',
        'Maintain indoor relative humidity between 40% and 55% for optimal rag preservation.',
      ],
      accentHex: '#7A3E2E',
      secondaryHex: '#3D2B22',
      paperTintHex: '#F8F3EA',
    },
    coaSpec: {
      certificateTitle: 'CERTIFICAT D’AUTHENTICITÉ · TIRAGE DE COLLECTION',
      archivalGuaranteeStatement:
        'Guaranteed Museum-Grade Pigment Permanence on Acid-Free European Conservation Substrate',
      editionNamingFormat: 'VAUBAN-SALON-EDITION',
      chiefCuratorName: 'Henri Delacroix',
      chiefCuratorTitle: 'Directeur des Archives · Galerie Vauban',
      embossedSealLabel: 'GALERIE VAUBAN · SCEAU D’ARCHIVE VÉRIFIÉ',
    },
  },
  'werkstatt-neue': {
    id: 'werkstatt-neue',
    brandName: 'Werkstatt Neue',
    tagline: 'Konstruktive Raumkunst & Museumsdrucke',
    establishedYear: 'MMXVII (2017)',
    originCity: 'Berlin · Wien',
    brandPersonaDescription:
      'Modernist structural editions rooted in Bauhaus grid discipline, precision aluminum/ash framing, and tonal clarity.',
    isFlagshipDefault: false,
    logoSvgMarkup: WERKSTATT_NEUE_LOGO_SVG,
    logoDataUrl: toSvgDataUrl(WERKSTATT_NEUE_LOGO_SVG),
    businessInfo: {
      first_name: 'Lukas',
      last_name: 'Vogel',
      company_name: 'Werkstatt Neue Raumkunst GmbH',
      address_1: '524 West 24th Street, Unit 2C',
      address_2: 'Chelsea Constructive Archive',
      city: 'New York',
      state_code: 'NY',
      zip_postal_code: '10011',
      country_code: 'US',
      phone: '212-555-0172',
      email: 'registratur@werkstatt-neue.org',
      website: 'https://werkstatt-neue.org',
    },
    packingSlipSpec: {
      headerTitle: 'WERKSTATT NEUE · WERKVERZEICHNIS LIEFERSCHEIN',
      collectorGreeting: 'Constructed and calibrated to architectural grid specifications.',
      curatorialNoteTemplate:
        'Every edition is optically verified for chromatic balance, structural edge crispness, and proportional wall alignment.',
      unboxingCareInstructions: [
        'Remove protective corner blocks only after positioning near the target wall.',
        'Use a spirit level along the top rabbet rail to lock horizontal grid alignment.',
        'Clean museum acrylic glazing only with a dry optical microfiber cloth.',
      ],
      accentHex: '#B6462C',
      secondaryHex: '#2B4C65',
      paperTintHex: '#F4F3EF',
    },
    coaSpec: {
      certificateTitle: 'ECHTHEITSZERTIFIKAT · ARCHITEKTONISCHE EDITION',
      archivalGuaranteeStatement:
        'DIN-ISO Certified Archival Pigment Permanence & Precision Conservation Framing',
      editionNamingFormat: 'WN-BAU-EDITION',
      chiefCuratorName: 'Lukas Vogel',
      chiefCuratorTitle: 'Chefkurator · Werkstatt Neue',
      embossedSealLabel: 'WERKSTATT NEUE · PRÜFSIEGEL ARCHIV',
    },
  },
  'stillwater-press': {
    id: 'stillwater-press',
    brandName: 'Stillwater Press',
    tagline: 'Fine Art Press & Conservation Framing Guild',
    establishedYear: 'MMXVI (2016)',
    originCity: 'Hudson Valley · Portland',
    brandPersonaDescription:
      'Organic American fine art press specializing in botanical ink studies, quarter-sawn white oak millwork, and heavyweight cotton rag.',
    isFlagshipDefault: false,
    logoSvgMarkup: STILLWATER_PRESS_LOGO_SVG,
    logoDataUrl: toSvgDataUrl(STILLWATER_PRESS_LOGO_SVG),
    businessInfo: {
      first_name: 'Clara',
      last_name: 'Alden',
      company_name: 'Stillwater Fine Art Press & Guild',
      address_1: '314 Warren Street, Studio 2',
      address_2: 'Hudson River Conservation Mill',
      city: 'Hudson',
      state_code: 'NY',
      zip_postal_code: '12534',
      country_code: 'US',
      phone: '518-555-0163',
      email: 'guild@stillwater-press.org',
      website: 'https://stillwater-press.org',
    },
    packingSlipSpec: {
      headerTitle: 'STILLWATER PRESS · GUILD DISPATCH LEDGER',
      collectorGreeting: 'Hand-inspected and crated by our conservation framing guild.',
      curatorialNoteTemplate:
        'Printed with archival mineral-rich pigments and paired with sustainably harvested domestic hardwood moulding.',
      unboxingCareInstructions: [
        'Keep the archival kraft dust-cover intact on the reverse of the frame.',
        'Avoid hanging directly above active wood-burning hearths or radiators.',
        'Dust solid hardwood mouldings gently with an untreated soft bristle brush.',
      ],
      accentHex: '#8C6239',
      secondaryHex: '#3B5241',
      paperTintHex: '#F6F2E9',
    },
    coaSpec: {
      certificateTitle: 'GUILD CERTIFICATE OF ARCHIVAL EDITION AUTHENTICITY',
      archivalGuaranteeStatement:
        '100% Cotton Rag & FSC Hardwood Millwork Certified to Museum Conservation Standards',
      editionNamingFormat: 'SWP-GUILD-EDITION',
      chiefCuratorName: 'Clara Alden',
      chiefCuratorTitle: 'Master Printer & Guild Director · Stillwater Press',
      embossedSealLabel: 'STILLWATER PRESS · CONSERVATION GUILD SEAL',
    },
  },
  'the-nocturne-archive': {
    id: 'the-nocturne-archive',
    brandName: 'The Nocturne Archive',
    tagline: 'Tonal Monographs & Archival Pigment Editions',
    establishedYear: 'MMXX (2020)',
    originCity: 'London · Edinburgh',
    brandPersonaDescription:
      'Atmospheric chiaroscuro and deep-tone colorfield editions designed for intimate studies, libraries, and evening sconce lighting.',
    isFlagshipDefault: false,
    logoSvgMarkup: THE_NOCTURNE_ARCHIVE_LOGO_SVG,
    logoDataUrl: toSvgDataUrl(THE_NOCTURNE_ARCHIVE_LOGO_SVG),
    businessInfo: {
      first_name: 'Julian',
      last_name: 'Ashford',
      company_name: 'The Nocturne Archive Editions',
      address_1: '19 East 71st Street, Suite 5A',
      address_2: 'North American Viewing Library',
      city: 'New York',
      state_code: 'NY',
      zip_postal_code: '10021',
      country_code: 'US',
      phone: '212-555-0188',
      email: 'curator@nocturne-archive.org',
      website: 'https://nocturne-archive.org',
    },
    packingSlipSpec: {
      headerTitle: 'THE NOCTURNE ARCHIVE · MONOGRAPH DISPATCH FOLIO',
      collectorGreeting: 'Prepared for intimate architectural and library illumination.',
      curatorialNoteTemplate:
        'Deep shadow densities and warm Dmax pigment layers have been calibrated for warm 2700K–3200K evening sconce lighting.',
      unboxingCareInstructions: [
        'Handle matte deep-tone pigment surfaces exclusively by the outer frame or mat border.',
        'Angle picture lights at 30 degrees to eliminate specular reflection while preserving shadow depth.',
        'Retain this archival folio in your collection provenance records.',
      ],
      accentHex: '#9B7A44',
      secondaryHex: '#232931',
      paperTintHex: '#F3EFE8',
    },
    coaSpec: {
      certificateTitle: 'CERTIFICATE OF MONOGRAPH EDITION PROVENANCE',
      archivalGuaranteeStatement:
        'High-Dmax Carbon & Archival Pigment Permanence Verified for Collector Libraries',
      editionNamingFormat: 'NOCTURNE-FOLIO-EDITION',
      chiefCuratorName: 'Julian Ashford',
      chiefCuratorTitle: 'Keeper of Monographs · The Nocturne Archive',
      embossedSealLabel: 'THE NOCTURNE ARCHIVE · VERIFIED FOLIO SEAL',
    },
  },
};

export const WHITE_LABEL_BRAND_LIST: WhiteLabelBrandIdentitySpec[] = [
  WHITE_LABEL_BRAND_IDENTITIES['atelier-koma'],
  WHITE_LABEL_BRAND_IDENTITIES['galerie-vauban'],
  WHITE_LABEL_BRAND_IDENTITIES['werkstatt-neue'],
  WHITE_LABEL_BRAND_IDENTITIES['stillwater-press'],
  WHITE_LABEL_BRAND_IDENTITIES['the-nocturne-archive'],
];

interface PersistedBrandState {
  brandId: WhiteLabelBrandId;
  customOverrides?: Partial<WhiteLabelBusinessInfo>;
}

let inMemoryBrandState: PersistedBrandState = {
  brandId: DEFAULT_WHITE_LABEL_BRAND_ID,
};

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function isValidBrandId(value: unknown): value is WhiteLabelBrandId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(WHITE_LABEL_BRAND_IDENTITIES, value)
  );
}

function sanitizeBusinessOverrides(
  overrides?: Partial<WhiteLabelBusinessInfo>
): Partial<WhiteLabelBusinessInfo> | undefined {
  if (!overrides || typeof overrides !== 'object') {
    return undefined;
  }

  const keys: Array<keyof WhiteLabelBusinessInfo> = [
    'first_name',
    'last_name',
    'company_name',
    'address_1',
    'address_2',
    'city',
    'state_code',
    'zip_postal_code',
    'country_code',
    'phone',
    'email',
    'website',
  ];

  const cleaned: Partial<WhiteLabelBusinessInfo> = {};
  let hasAny = false;

  for (const key of keys) {
    const rawVal = overrides[key];
    if (typeof rawVal === 'string' && rawVal.trim().length > 0) {
      // Strip any accidental mention of FinerWorks so white-label blind shipping remains 100% pure
      cleaned[key] = rawVal.replace(/finerworks/gi, 'Archival Guild').trim();
      hasAny = true;
    }
  }

  return hasAny ? cleaned : undefined;
}

function mergeBrandWithOverrides(
  baseBrand: WhiteLabelBrandIdentitySpec,
  customOverrides?: Partial<WhiteLabelBusinessInfo>
): WhiteLabelBrandIdentitySpec {
  const sanitized = sanitizeBusinessOverrides(customOverrides);
  if (!sanitized) {
    return {
      ...baseBrand,
      businessInfo: { ...baseBrand.businessInfo },
      packingSlipSpec: {
        ...baseBrand.packingSlipSpec,
        unboxingCareInstructions: [...baseBrand.packingSlipSpec.unboxingCareInstructions],
      },
      coaSpec: { ...baseBrand.coaSpec },
    };
  }

  return {
    ...baseBrand,
    businessInfo: {
      ...baseBrand.businessInfo,
      ...sanitized,
    },
    packingSlipSpec: {
      ...baseBrand.packingSlipSpec,
      unboxingCareInstructions: [...baseBrand.packingSlipSpec.unboxingCareInstructions],
    },
    coaSpec: { ...baseBrand.coaSpec },
  };
}

export function getWhiteLabelBrandById(
  brandId?: WhiteLabelBrandId | string
): WhiteLabelBrandIdentitySpec {
  const resolvedId: WhiteLabelBrandId = isValidBrandId(brandId)
    ? brandId
    : DEFAULT_WHITE_LABEL_BRAND_ID;
  return mergeBrandWithOverrides(WHITE_LABEL_BRAND_IDENTITIES[resolvedId]);
}

/**
 * Reads WHITE_LABEL_BRAND_STORAGE_KEY from localStorage if available,
 * applies any customOverrides to businessInfo, and returns the active
 * WhiteLabelBrandIdentitySpec (defaulting to 'atelier-koma').
 */
export function getActiveWhiteLabelBrand(): WhiteLabelBrandIdentitySpec {
  const storage = getSafeLocalStorage();
  if (storage) {
    try {
      const raw = storage.getItem(WHITE_LABEL_BRAND_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'string' && isValidBrandId(parsed)) {
          inMemoryBrandState = { brandId: parsed };
          return mergeBrandWithOverrides(WHITE_LABEL_BRAND_IDENTITIES[parsed]);
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const record = parsed as Record<string, unknown>;
          const candidateId = record.brandId ?? record.id;
          const resolvedId: WhiteLabelBrandId = isValidBrandId(candidateId)
            ? candidateId
            : DEFAULT_WHITE_LABEL_BRAND_ID;
          const overrides = sanitizeBusinessOverrides(
            (record.customOverrides ?? record.businessInfo) as
              | Partial<WhiteLabelBusinessInfo>
              | undefined
          );
          inMemoryBrandState = {
            brandId: resolvedId,
            customOverrides: overrides,
          };
          return mergeBrandWithOverrides(
            WHITE_LABEL_BRAND_IDENTITIES[resolvedId],
            overrides
          );
        }
      }
    } catch {
      // Ignore malformed storage data and fall back to in-memory / default
    }
  }

  const base =
    WHITE_LABEL_BRAND_IDENTITIES[inMemoryBrandState.brandId] ??
    WHITE_LABEL_BRAND_IDENTITIES[DEFAULT_WHITE_LABEL_BRAND_ID];
  return mergeBrandWithOverrides(base, inMemoryBrandState.customOverrides);
}

/**
 * Validates brandId (falling back to 'atelier-koma' if unknown), merges customOverrides
 * into businessInfo, persists to localStorage with QuotaExceeded safety, and returns
 * the updated WhiteLabelBrandIdentitySpec.
 */
export function setActiveWhiteLabelBrand(
  brandId: WhiteLabelBrandId,
  customOverrides?: Partial<WhiteLabelBusinessInfo>
): WhiteLabelBrandIdentitySpec {
  const resolvedId: WhiteLabelBrandId = isValidBrandId(brandId)
    ? brandId
    : DEFAULT_WHITE_LABEL_BRAND_ID;
  const sanitizedOverrides = sanitizeBusinessOverrides(customOverrides);

  inMemoryBrandState = {
    brandId: resolvedId,
    customOverrides: sanitizedOverrides,
  };

  const storage = getSafeLocalStorage();
  if (storage) {
    const payload = JSON.stringify(inMemoryBrandState);
    try {
      storage.setItem(WHITE_LABEL_BRAND_STORAGE_KEY, payload);
    } catch {
      try {
        storage.removeItem(WHITE_LABEL_BRAND_STORAGE_KEY);
        storage.setItem(WHITE_LABEL_BRAND_STORAGE_KEY, payload);
      } catch {
        // Keep in-memory state if QuotaExceeded persists
      }
    }
  }

  return mergeBrandWithOverrides(
    WHITE_LABEL_BRAND_IDENTITIES[resolvedId],
    sanitizedOverrides
  );
}

export interface WhiteLabelDocumentRenderOptions {
  brand?: WhiteLabelBrandIdentitySpec;
  brandId?: WhiteLabelBrandId;
  collectorName?: string;
  recipientName?: string;
  artworkTitle?: string;
  title?: string;
  substrateLabel?: string;
  substrateName?: string;
  frameLabel?: string;
  frameName?: string;
  matLabel?: string;
  glazingLabel?: string;
  dimensionsLabel?: string;
  sizeLabel?: string;
  productCode?: string;
  finerworksProductCode?: string;
  orderPo?: string;
  orderId?: string;
  editionNumber?: string;
  curatorialNote?: string;
  issuedDate?: string;
}

function escapeCollectorHtml(raw: string): string {
  return raw
    .replace(/finerworks/gi, 'Archival Press')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripForbiddenFulfillmentAndAnchorTokens(html: string): string {
  return html
    .replace(/finerworks/gi, 'Archival Press')
    .replace(/<a\b[^>]*>/gi, '<span>')
    .replace(/<\/a>/gi, '</span>');
}

function resolveBrandAndOptions(
  firstArg?:
    | WhiteLabelDocumentRenderOptions
    | WhiteLabelBrandIdentitySpec
    | WhiteLabelBrandId,
  secondArg?: WhiteLabelDocumentRenderOptions
): {
  brand: WhiteLabelBrandIdentitySpec;
  options: WhiteLabelDocumentRenderOptions;
} {
  if (typeof firstArg === 'string') {
    return {
      brand: getWhiteLabelBrandById(firstArg),
      options: secondArg ?? {},
    };
  }

  if (
    firstArg &&
    typeof firstArg === 'object' &&
    'brandName' in firstArg &&
    'businessInfo' in firstArg &&
    'logoSvgMarkup' in firstArg
  ) {
    return {
      brand: firstArg as WhiteLabelBrandIdentitySpec,
      options: secondArg ?? {},
    };
  }

  const opts = (firstArg as WhiteLabelDocumentRenderOptions | undefined) ?? {};
  const brand =
    opts.brand ??
    (opts.brandId ? getWhiteLabelBrandById(opts.brandId) : getActiveWhiteLabelBrand());

  return { brand, options: opts };
}

/**
 * Generates the collector-facing White-Label Packing Slip HTML Preview.
 * Includes the 600x180 SVG logo header, anonymous gallery return address,
 * collector name, artwork title, substrate/frame/dimensions, reference code,
 * curatorial notes, and embossed seal — with ZERO mention of "FinerWorks"
 * and ZERO <a href> tags.
 */
export function renderPackingSlipHtmlPreview(
  brandOrOptions?:
    | WhiteLabelDocumentRenderOptions
    | WhiteLabelBrandIdentitySpec
    | WhiteLabelBrandId,
  extraOptions?: WhiteLabelDocumentRenderOptions
): string {
  const { brand, options } = resolveBrandAndOptions(brandOrOptions, extraOptions);

  const collectorName = escapeCollectorHtml(
    options.collectorName || options.recipientName || 'Clara Vance · Private Collector'
  );
  const artworkTitle = escapeCollectorHtml(
    options.artworkTitle || options.title || 'Architectural Study No. 01'
  );
  const substrateLabel = escapeCollectorHtml(
    options.substrateLabel ||
      options.substrateName ||
      '310gsm Hahnemühle German Etching Archival Rag'
  );
  const frameLabel = escapeCollectorHtml(
    options.frameLabel ||
      options.frameName ||
      'Natural Quarter-Sawn White Oak Gallery Moulding'
  );
  const dimensionsLabel = escapeCollectorHtml(
    options.dimensionsLabel || options.sizeLabel || '24" × 36" (61 × 91 cm)'
  );
  const productCode = escapeCollectorHtml(
    options.productCode ||
      options.finerworksProductCode ||
      '5M41M9S24X36F131S29X41J2S24X36G1'
  );
  const orderPo = escapeCollectorHtml(
    options.orderPo || options.orderId || `${brand.coaSpec.editionNamingFormat}-2026-01`
  );
  const curatorialNote = escapeCollectorHtml(
    options.curatorialNote || brand.packingSlipSpec.curatorialNoteTemplate
  );
  const issuedDate = escapeCollectorHtml(
    options.issuedDate || new Date().toISOString().slice(0, 10)
  );

  const careItemsHtml = brand.packingSlipSpec.unboxingCareInstructions
    .map(
      (instruction) =>
        `<li style="margin-bottom:4px;color:#3F3A34;font-size:12px;">${escapeCollectorHtml(
          instruction
        )}</li>`
    )
    .join('');

  const html = `<section class="white-label-packing-slip" data-brand-id="${brand.id}" style="background:${brand.packingSlipSpec.paperTintHex};border:1px solid ${brand.packingSlipSpec.accentHex};padding:24px;font-family:Georgia, 'Times New Roman', serif;color:#1C1917;">
  <header class="packing-slip-logo-banner" data-logo-dimensions="600x180" style="margin-bottom:16px;border-bottom:1px solid ${brand.packingSlipSpec.accentHex};padding-bottom:12px;">
    ${brand.logoSvgMarkup}
  </header>
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;font-size:12px;">
    <div class="anonymous-return-address">
      <div style="font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.packingSlipSpec.secondaryHex};">Gallery Dispatch &amp; Return Origin</div>
      <div>${escapeCollectorHtml(brand.businessInfo.company_name)}</div>
      <div>${escapeCollectorHtml(brand.businessInfo.address_1)}${brand.businessInfo.address_2 ? ' · ' + escapeCollectorHtml(brand.businessInfo.address_2) : ''}</div>
      <div>${escapeCollectorHtml(brand.businessInfo.city)}, ${escapeCollectorHtml(brand.businessInfo.state_code)} ${escapeCollectorHtml(brand.businessInfo.zip_postal_code)} (${escapeCollectorHtml(brand.businessInfo.country_code)})</div>
      <div>Curatorial Registrar: ${escapeCollectorHtml(brand.businessInfo.first_name)} ${escapeCollectorHtml(brand.businessInfo.last_name)} · ${escapeCollectorHtml(brand.businessInfo.phone)}</div>
    </div>
    <div class="collector-dossier-meta" style="text-align:right;">
      <div style="font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.packingSlipSpec.accentHex};">${escapeCollectorHtml(brand.packingSlipSpec.headerTitle)}</div>
      <div>Prepared For: <strong>${collectorName}</strong></div>
      <div>Dispatch Dossier No.: <code>${orderPo}</code></div>
      <div>Date of Issue: ${issuedDate}</div>
    </div>
  </div>
  <div style="background:#FFFFFF;border:1px solid #DFD7C8;padding:14px;margin-bottom:14px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${brand.packingSlipSpec.accentHex};margin-bottom:4px;">Commissioned Edition Specification</div>
    <div style="font-size:16px;font-weight:600;margin-bottom:6px;">${artworkTitle}</div>
    <div style="font-size:12px;color:#4A443D;">
      <span><strong>Substrate:</strong> ${substrateLabel}</span> ·
      <span><strong>Framing:</strong> ${frameLabel}</span> ·
      <span><strong>Dimensions:</strong> ${dimensionsLabel}</span>
    </div>
    <div style="font-size:11px;color:#6B6358;margin-top:6px;">
      <span><strong>Archival Press Reference Code:</strong> <code>${productCode}</code></span>
    </div>
  </div>
  <div style="margin-bottom:14px;">
    <div style="font-size:12px;font-style:italic;color:${brand.packingSlipSpec.secondaryHex};margin-bottom:4px;">${escapeCollectorHtml(brand.packingSlipSpec.collectorGreeting)}</div>
    <p style="font-size:12px;line-height:1.5;margin:0;color:#3F3A34;">${curatorialNote}</p>
  </div>
  <div style="margin-bottom:14px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${brand.packingSlipSpec.secondaryHex};margin-bottom:6px;">Conservation &amp; Acclimation Protocol</div>
    <ul style="margin:0;padding-left:18px;">${careItemsHtml}</ul>
  </div>
  <footer style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #DFD7C8;padding-top:12px;font-size:11px;">
    <div>Signed: <strong>${escapeCollectorHtml(brand.coaSpec.chiefCuratorName)}</strong> (${escapeCollectorHtml(brand.coaSpec.chiefCuratorTitle)})</div>
    <div class="embossed-archival-seal" style="border:1px solid ${brand.packingSlipSpec.accentHex};padding:4px 10px;letter-spacing:0.1em;font-weight:700;color:${brand.packingSlipSpec.accentHex};">${escapeCollectorHtml(brand.coaSpec.embossedSealLabel)}</div>
  </footer>
</section>`;

  return stripForbiddenFulfillmentAndAnchorTokens(html);
}

/**
 * Generates the collector-facing White-Label Certificate of Authenticity (COA) HTML.
 * Includes the 600x180 SVG logo header, anonymous gallery return address,
 * collector name, artwork title, substrate/frame/dimensions, reference code,
 * curatorial notes, and embossed seal — with ZERO mention of "FinerWorks"
 * and ZERO <a href> tags.
 */
export function renderCertificateOfAuthenticityHtml(
  brandOrOptions?:
    | WhiteLabelDocumentRenderOptions
    | WhiteLabelBrandIdentitySpec
    | WhiteLabelBrandId,
  extraOptions?: WhiteLabelDocumentRenderOptions
): string {
  const { brand, options } = resolveBrandAndOptions(brandOrOptions, extraOptions);

  const collectorName = escapeCollectorHtml(
    options.collectorName || options.recipientName || 'Clara Vance · Private Collector'
  );
  const artworkTitle = escapeCollectorHtml(
    options.artworkTitle || options.title || 'Architectural Study No. 01'
  );
  const substrateLabel = escapeCollectorHtml(
    options.substrateLabel ||
      options.substrateName ||
      '310gsm Hahnemühle German Etching Archival Rag'
  );
  const frameLabel = escapeCollectorHtml(
    options.frameLabel ||
      options.frameName ||
      'Natural Quarter-Sawn White Oak Gallery Moulding'
  );
  const dimensionsLabel = escapeCollectorHtml(
    options.dimensionsLabel || options.sizeLabel || '24" × 36" (61 × 91 cm)'
  );
  const productCode = escapeCollectorHtml(
    options.productCode ||
      options.finerworksProductCode ||
      '5M41M9S24X36F131S29X41J2S24X36G1'
  );
  const editionNumber = escapeCollectorHtml(
    options.editionNumber ||
      options.orderPo ||
      options.orderId ||
      `${brand.coaSpec.editionNamingFormat}-001/100`
  );
  const curatorialNote = escapeCollectorHtml(
    options.curatorialNote || brand.packingSlipSpec.curatorialNoteTemplate
  );
  const issuedDate = escapeCollectorHtml(
    options.issuedDate || new Date().toISOString().slice(0, 10)
  );

  const html = `<article class="white-label-coa-certificate" data-brand-id="${brand.id}" style="background:${brand.packingSlipSpec.paperTintHex};border:2px double ${brand.packingSlipSpec.accentHex};padding:28px;font-family:Georgia, 'Times New Roman', serif;color:#1C1917;">
  <header class="coa-logo-banner" data-logo-dimensions="600x180" style="text-align:center;margin-bottom:18px;border-bottom:1px solid ${brand.packingSlipSpec.accentHex};padding-bottom:14px;">
    ${brand.logoSvgMarkup}
    <h2 style="margin:12px 0 4px;font-size:17px;letter-spacing:0.14em;text-transform:uppercase;color:${brand.packingSlipSpec.secondaryHex};">${escapeCollectorHtml(brand.coaSpec.certificateTitle)}</h2>
    <div style="font-size:12px;color:#6B6358;font-style:italic;">${escapeCollectorHtml(brand.coaSpec.archivalGuaranteeStatement)}</div>
  </header>
  <div style="margin-bottom:16px;font-size:13px;line-height:1.6;">
    <p style="margin:0 0 8px;">This document certifies that the architectural pigment edition <strong>${artworkTitle}</strong> has been struck and inspected under the curatorial authority of <strong>${escapeCollectorHtml(brand.brandName)}</strong> (${brand.id === 'atelier-koma' ? escapeCollectorHtml(brand.establishedYear) : `${escapeCollectorHtml(brand.originCity)}, Est. ${escapeCollectorHtml(brand.establishedYear)}`}) exclusively for the collection of <strong>${collectorName}</strong>.</p>
    <p style="margin:0;color:#3F3A34;font-style:italic;">${curatorialNote}</p>
  </div>
  <div style="background:#FFFFFF;border:1px solid #DFD7C8;padding:14px;margin-bottom:16px;font-size:12px;">
    <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px;">
      <div><strong>Edition Designation:</strong> <code>${editionNumber}</code></div>
      <div><strong>Archival Reference Code:</strong> <code>${productCode}</code></div>
      <div><strong>Archival Substrate:</strong> ${substrateLabel}</div>
      <div><strong>Conservation Framing:</strong> ${frameLabel}</div>
      <div><strong>Calibrated Dimensions:</strong> ${dimensionsLabel}</div>
      <div><strong>Registry Date:</strong> ${issuedDate}</div>
    </div>
  </div>
  <footer style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;border-top:1px solid #DFD7C8;padding-top:14px;font-size:11px;">
    <div class="coa-gallery-origin">
      <div style="font-weight:700;color:${brand.packingSlipSpec.secondaryHex};">${escapeCollectorHtml(brand.businessInfo.company_name)}</div>
      <div>${escapeCollectorHtml(brand.businessInfo.address_1)}, ${escapeCollectorHtml(brand.businessInfo.city)}, ${escapeCollectorHtml(brand.businessInfo.state_code)} ${escapeCollectorHtml(brand.businessInfo.zip_postal_code)}</div>
      <div>Authenticated By: <strong>${escapeCollectorHtml(brand.coaSpec.chiefCuratorName)}</strong> · ${escapeCollectorHtml(brand.coaSpec.chiefCuratorTitle)}</div>
    </div>
    <div class="coa-embossed-seal" style="border:1.5px solid ${brand.packingSlipSpec.accentHex};padding:6px 12px;letter-spacing:0.12em;font-weight:700;text-transform:uppercase;color:${brand.packingSlipSpec.accentHex};background:#FFFFFF;">
      ${escapeCollectorHtml(brand.coaSpec.embossedSealLabel)}
    </div>
  </footer>
</article>`;

  return stripForbiddenFulfillmentAndAnchorTokens(html);
}
