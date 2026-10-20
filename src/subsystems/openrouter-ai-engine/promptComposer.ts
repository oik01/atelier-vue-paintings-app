import {
  AiEngineId,
  AiPromptConfiguration,
  ArtPieceCountMode,
  ArtStyleSelectionMode,
  CuratedArtStylePreset,
  FinerWorksPromptConstraintConfig,
  WallPlacementAction,
} from '../../contracts/masterContract';
import {
  FINERWORKS_FRAME_MOULDINGS,
  FINERWORKS_GLAZING_SPECS,
  FINERWORKS_MAT_BOARDS,
  FINERWORKS_MEDIA_SPECS,
  FINERWORKS_SIZE_OPTIONS,
  getFinerWorksFrameByProfileId,
  getFinerWorksGlazingById,
  getFinerWorksMatByColorId,
  getFinerWorksMediaById,
  getFinerWorksMediaBySlug,
  getFinerWorksSizeById,
} from '../finerworks-catalog-sync';

export interface CuratedStylePresetMeta {
  id: CuratedArtStylePreset;
  label: string;
  shortTagline: string;
  promptDescriptor: string;
  samplePaletteHex: [string, string, string, string];
}

export interface ComposeRoomReimagineOptions {
  variationIndex?: number;
  angleLabel?: string;
  angleIndex?: number;
  totalAngles?: number;
  correctionInstructions?: string;
}

export const CURATED_STYLE_PRESET_DESCRIPTIONS: Record<
  CuratedArtStylePreset,
  CuratedStylePresetMeta
> = {
  'impasto-oil': {
    id: 'impasto-oil',
    label: 'Impasto Oil',
    shortTagline: 'Sculptural palette-knife oil texture with rich gallery depth',
    promptDescriptor:
      'Impasto Oil — rich, tactile palette-knife oil brushwork on heavy linen canvas with sculptural pigment ridges, warm gallery glazing, and expressive tonal transitions',
    samplePaletteHex: ['#C86D51', '#D9A76A', '#3B4B59', '#F2ECE1'],
  },
  'minimalist-abstract': {
    id: 'minimalist-abstract',
    label: 'Minimalist Abstract',
    shortTagline: 'Serene architectural forms and quiet tonal balance',
    promptDescriptor:
      'Minimalist Abstract — serene gallery-grade abstract composition with calm architectural forms, nuanced negative space, raw linen undertones, and refined tonal equilibrium',
    samplePaletteHex: ['#E8E2D7', '#B8ADA0', '#5E5A55', '#242220'],
  },
  'warm-midcentury': {
    id: 'warm-midcentury',
    label: 'Warm Mid-Century',
    shortTagline: 'Organic modernist shapes in terracotta, ochre, and walnut',
    promptDescriptor:
      'Warm Mid-Century — organic modernist geometric and biomorphic forms in sun-baked terracotta, ochre gold, deep walnut umber, and warm parchment inspired by 1950s architectural salons',
    samplePaletteHex: ['#C45A3B', '#DBA24A', '#4A3525', '#F3EBDD'],
  },
  'wabi-sabi-plaster': {
    id: 'wabi-sabi-plaster',
    label: 'Wabi-Sabi Plaster',
    shortTagline: 'Mineral limewash relief and meditative organic horizon lines',
    promptDescriptor:
      'Wabi-Sabi Plaster — meditative Japanese-Nordic mineral plaster and limewash relief painting with subtle organic textures, raw chalk and travertine earth pigments, and quiet horizon contours',
    samplePaletteHex: ['#EDE8DF', '#CFC6B8', '#8F8475', '#47413A'],
  },
  'impressionist-landscape': {
    id: 'impressionist-landscape',
    label: 'Impressionist Landscape',
    shortTagline: 'Luminous atmospheric light, horizon mist, and broken color',
    promptDescriptor:
      'Impressionist Landscape — luminous atmospheric landscape painting with broken-color oil brushwork, golden-hour horizon light, soft coastal or pastoral depth, and museum plein-air warmth',
    samplePaletteHex: ['#6E8B9E', '#D8B278', '#7A8C6E', '#F0E9DC'],
  },
  'bauhaus-geometric': {
    id: 'bauhaus-geometric',
    label: 'Bauhaus Geometric',
    shortTagline: 'Constructivist precision, balanced circles, and primary warmth',
    promptDescriptor:
      'Bauhaus Geometric — constructivist modernist composition featuring crisp architectural geometry, intersecting arcs and planes, calibrated color blocks, and timeless Weimar studio balance',
    samplePaletteHex: ['#BF4B38', '#D99B26', '#2B4C6F', '#EFECE4'],
  },
  'botanical-ink': {
    id: 'botanical-ink',
    label: 'Botanical Ink',
    shortTagline: 'Organic sumi ink washes and delicate herbarium foliage studies',
    promptDescriptor:
      'Botanical Ink — fine archival botanical study combining expressive sumi ink linework, layered mineral watercolor washes, sage and olive foliage silhouettes, and deckled cotton paper warmth',
    samplePaletteHex: ['#3D4F41', '#7A8F77', '#2A2927', '#F4EFE6'],
  },
  'rothko-colorfield': {
    id: 'rothko-colorfield',
    label: 'Luminous Color-Field',
    shortTagline: 'Deep layered atmospheric color bands and meditative glow',
    promptDescriptor:
      'Luminous Color-Field — museum-grade Rothko-inspired atmospheric color-field oil painting with soft-edged floating rectangles, translucent pigment glazes, and deep resonant tonal vibration',
    samplePaletteHex: ['#9E3B2B', '#D9823B', '#4A2C2A', '#F2E7D8'],
  },
  'nordic-monochrome': {
    id: 'nordic-monochrome',
    label: 'Nordic Charcoal & Ivory',
    shortTagline: 'Sculptural charcoal strokes on warm alabaster linen',
    promptDescriptor:
      'Nordic Charcoal & Ivory — architectural Scandinavian monochrome study with bold raw charcoal and bone-black brushwork set against warm alabaster, chalk, and unbleached linen',
    samplePaletteHex: ['#1F1E1C', '#5C5852', '#D8D2C7', '#F6F3EC'],
  },
  'mediterranean-fresco': {
    id: 'mediterranean-fresco',
    label: 'Mediterranean Fresco',
    shortTagline: 'Sun-baked terracotta, aged limestone, and coastal olive',
    promptDescriptor:
      'Mediterranean Fresco — weathered architectural buon-fresco painting with sun-baked terracotta, Chalkidiki olive, warm Aegean limestone patinas, and tactile mineral earth wash',
    samplePaletteHex: ['#C96A4A', '#8A8F6A', '#DFD3C0', '#F7F1E5'],
  },
  'contemporary-figurative': {
    id: 'contemporary-figurative',
    label: 'Expressive Silhouette',
    shortTagline: 'Poetic minimalist contour and modern gallery line study',
    promptDescriptor:
      'Expressive Silhouette — contemporary gallery figurative abstraction featuring poetic continuous contour lines, poised gestural silhouettes, and warm muted earth and linen tones',
    samplePaletteHex: ['#2B2623', '#B87A56', '#D9CBB8', '#F5EFE6'],
  },
  'japanese-woodblock': {
    id: 'japanese-woodblock',
    label: 'Zen Mist & Woodblock',
    shortTagline: 'Serene mountain mist, mineral indigo, and cypress horizons',
    promptDescriptor:
      'Zen Mist & Woodblock — serene shin-hanga woodblock-inspired atmospheric landscape with layered mountain mist, mineral Prussian indigo, muted cypress greens, and warm mulberry paper grain',
    samplePaletteHex: ['#2E4A62', '#6C847E', '#C9B99F', '#F3EDE0'],
  },
  'sculptural-paper-relief': {
    id: 'sculptural-paper-relief',
    label: 'Sculptural Bas-Relief',
    shortTagline: 'Three-dimensional monochromatic fluting and shadow play',
    promptDescriptor:
      'Sculptural Bas-Relief — tactile three-dimensional cast-paper and gesso bas-relief artwork with rhythmic architectural fluting, carved geometric ridges, and serene raking light shadow play',
    samplePaletteHex: ['#F7F4EE', '#E4DDD0', '#B8AFA0', '#6E675C'],
  },
  'abstract-expressionist': {
    id: 'abstract-expressionist',
    label: 'Gestural Expressionism',
    shortTagline: 'Bold sweeping brushwork and kinetic New York School energy',
    promptDescriptor:
      'Gestural Expressionism — dynamic mid-century abstract expressionist canvas with sweeping architectural brush gestures, layered raw umber and ochre accents, and energetic studio depth',
    samplePaletteHex: ['#262320', '#C45B3A', '#D6A456', '#EFE9DE'],
  },
  'classical-still-life': {
    id: 'classical-still-life',
    label: 'Modernist Still Life',
    shortTagline: 'Architectural stoneware vessels and quiet chiaroscuro light',
    promptDescriptor:
      'Modernist Still Life — Morandi-inspired contemplative still life ofmatte ceramic and travertine vessels bathed in soft directional studio chiaroscuro with warm chalky oil pigments',
    samplePaletteHex: ['#8C7A6B', '#C9B59C', '#4E443C', '#F2ECE1'],
  },
  'desert-earth-strata': {
    id: 'desert-earth-strata',
    label: 'Desert Earth Strata',
    shortTagline: 'Layered sandstone, canyon rust, desert sage, and dusk',
    promptDescriptor:
      'Desert Earth Strata — organic geological horizon abstraction layering Sedona canyon rust, raw sandstone, desert sage, and warm twilight mineral pigments on heavy woven canvas',
    samplePaletteHex: ['#B8593E', '#D89E6C', '#7F8A74', '#F1E8DA'],
  },
};

export const STYLE_PRESET_DESCRIPTIONS = CURATED_STYLE_PRESET_DESCRIPTIONS;

export const CURATED_STYLE_PRESET_LIST: CuratedStylePresetMeta[] = [
  CURATED_STYLE_PRESET_DESCRIPTIONS['impasto-oil'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['minimalist-abstract'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['warm-midcentury'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['wabi-sabi-plaster'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['impressionist-landscape'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['bauhaus-geometric'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['botanical-ink'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['rothko-colorfield'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['nordic-monochrome'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['mediterranean-fresco'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['contemporary-figurative'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['japanese-woodblock'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['sculptural-paper-relief'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['abstract-expressionist'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['classical-still-life'],
  CURATED_STYLE_PRESET_DESCRIPTIONS['desert-earth-strata'],
];

export const WALL_PLACEMENT_DESCRIPTIONS: Record<WallPlacementAction, string> = {
  'add-only':
    'WALL PLACEMENT MODE (ADD ART TO OPEN WALL ONLY): Preserve all existing room decor, furniture, walls, lighting, and any existing wall items 100% intact while adding well-fitting, gallery-framed fine-art painting(s) onto the open wall space at museum eye level.',
  'replace-existing':
    'WALL PLACEMENT MODE (REPLACE EXISTING WALL ART): Replace any existing wall art, frames, or posters currently hanging on the wall and reimagine the wall with newly curated fine-art painting(s) positioned at museum eye level while preserving the room architecture, furniture, and lighting 100% intact.',
  both:
    'WALL PLACEMENT MODE (BOTH REPLACE EXISTING ART & ADD NEW ART TO BLANK WALLS): BOTH replace any existing wall art/frames in the room with new curated artwork AND add coordinated new framed fine-art painting(s) to open blank wall spaces at museum eye level while preserving the room architecture, furniture, and lighting 100% intact.',
};

export const PIECE_COUNT_DESCRIPTIONS: Record<ArtPieceCountMode, string> = {
  'auto-multi-wall':
    'AUTO MULTI-WALL CURATION: Place 1 primary statement fine-art piece on the main open wall (and if a second distinct empty wall expanse is clearly visible in the room, you may place a 2nd coordinated companion piece so no major wall feels bare).',
  'single-piece':
    'SINGLE FOCAL PIECE CURATION (1 ART PIECE): Focus on placing 1 statement gallery-framed fine-art painting at the primary focal wall location.',
  'multi-piece-pair':
    'MULTI-WALL / MULTI-PIECE CURATION (2 COORDINATED ART PIECES): Place 2 distinct, harmoniously coordinated framed fine-art pieces across the room walls (such as primary wall and companion wall, or a balanced pair) at museum eye level.',
  'multi-piece-trio':
    'MULTI-PIECE GALLERY COLLECTION (3 COORDINATED ART PIECES): Place 3 distinct yet harmoniously coordinated framed fine-art pieces across the room walls (or as a curated gallery arrangement across the available wall expanses) at museum eye level.',
};

export const VARIATION_DIRECTIVES: string[] = [
  'Option 1 (Tonal & Textural Harmony): Echo the primary furniture upholstery and warm wood undertones in a calm, sculptural museum composition that feels seamlessly integrated with the seating below.',
  'Option 2 (Complementary Architectural Contrast & Focal Energy): Introduce a refined complementary accent pigment and bolder geometric or impasto focal structure that dialogues with the furniture silhouette and elevates the room.',
  'Option 3 (Atmospheric Horizon & Organic Materiality): Emphasize luminous horizon depth, mineral or raw-linen surface relief, and serene negative space tailored to the room location and natural daylight.',
  'Option 4 (Collector-Edition Sculptural Study): Feature a distinctive compositional geometry and tactile pigment relief tailored to the room furniture, space location, and color palette.',
];

export function composeFinerWorksCatalogManifestBlock(
  constraints?: FinerWorksPromptConstraintConfig
): string {
  const substratesLine = FINERWORKS_MEDIA_SPECS.map(
    (m) =>
      `[MediaID=${m.mediaId} "${m.shortName}" (${m.substrateSlug}), ProductType=${m.productTypeId}, Finish=${m.surfaceFinish}, Weight=${m.gsmOrThicknessLabel}, MatAllowed=${m.canMat}, GlazeAllowed=${m.canGlaze}]`
  ).join('; ');

  const coreFrames = FINERWORKS_FRAME_MOULDINGS.slice(0, 6);
  const lockedFrameCandidate = constraints?.lockedFrameId
    ? getFinerWorksFrameByProfileId(constraints.lockedFrameId)
    : undefined;
  const manifestFrames =
    lockedFrameCandidate &&
    !coreFrames.some((f) => f.profileId === lockedFrameCandidate.profileId)
      ? [...coreFrames, lockedFrameCandidate]
      : coreFrames;

  const framesLine = manifestFrames
    .map(
      (f) =>
        `[Profile="${f.profileId}" (FrameID=${f.finerworksFrameId}, "${f.name}"), Collection="${f.collectionName}", FaceWidth=${f.thicknessInches}", Depth=${f.depthInches}", Color="${f.colorLabel}", FloatGap=${f.floatOffsetInches}", AllowMat=${f.allowMatting}]`
    )
    .join('; ');

  const matsLine = FINERWORKS_MAT_BOARDS.map(
    (mat) =>
      `[MatID=${mat.finerworksMatId} "${mat.name}" (matColorId="${mat.matColorId}"), ${mat.composite}]`
  ).join('; ');

  const glazingLine = FINERWORKS_GLAZING_SPECS.map(
    (g) =>
      `[GlassID=${g.finerworksGlassId} "${g.name}" (glazingId="${g.glazingId}"), UV=${g.uvFilteringPercent}%]`
  ).join('; ');

  const sizesLine = FINERWORKS_SIZE_OPTIONS.filter((s) => s.id !== 'custom')
    .map((s) => `${s.id} (${s.labelInches}, ${s.aspectRatioLabel})`)
    .join(', ');

  const catalogManifest = [
    'FINERWORKS ARCHIVAL PRINT & FRAMING CATALOG MANIFEST (v3) — 27 Collections, 231 Frame Mouldings:',
    `- Active FinerWorks Substrates: ${substratesLine}.`,
    `- FinerWorks Frame Mouldings: ${framesLine}.`,
    `- FinerWorks 4-Ply Acid-Free Rag Mats: ${matsLine} | Valid Mat Border Widths: "none" (0"), "1.5in" (1.5"), "2.5in" (2.5"), "3.5in" (3.5").`,
    `- FinerWorks Glazing: ${glazingLine}.`,
    `- FinerWorks Standard Sizes: ${sizesLine} (plus Custom Exact-Inch Sizing from 4"×4" to 48"×96").`,
  ].join(' ');

  if (constraints?.mode === 'user-locked-finerworks') {
    const lockedMedia = constraints.lockedMediaId
      ? getFinerWorksMediaById(constraints.lockedMediaId)
      : constraints.lockedSubstrateSlug
      ? getFinerWorksMediaBySlug(String(constraints.lockedSubstrateSlug))
      : undefined;

    const lockedFrame = constraints.lockedFrameId
      ? getFinerWorksFrameByProfileId(constraints.lockedFrameId)
      : undefined;

    const isNonPaperSubstrate = lockedMedia ? lockedMedia.productTypeId !== 5 : false;
    const isFrameMatIncompatible = lockedFrame
      ? lockedFrame.finerworksFrameId === 0 ||
        lockedFrame.isFloatFrame === true ||
        !lockedFrame.allowMatting
      : false;
    const matDisabledByPhysics = isNonPaperSubstrate || isFrameMatIncompatible;

    const effectiveMatWidthId = matDisabledByPhysics
      ? 'none'
      : constraints.lockedMatWidthId ?? 'none';
    const effectiveMatColorId = constraints.lockedMatColorId ?? 'archival-ivory';
    const lockedMatSpec = getFinerWorksMatByColorId(effectiveMatColorId);

    const effectiveGlazingId = matDisabledByPhysics
      ? 'none'
      : constraints.lockedGlazingId ?? 'none';
    const lockedGlazingSpec = getFinerWorksGlazingById(effectiveGlazingId);

    let targetSizeClause = '';
    if (
      constraints.lockedSizeId === 'custom' ||
      (constraints.lockedCustomWidthIn && constraints.lockedCustomHeightIn)
    ) {
      const w = constraints.lockedCustomWidthIn ?? 24;
      const h = constraints.lockedCustomHeightIn ?? 36;
      targetSizeClause = `Locked Print Size: Custom ${w}" × ${h}" exact-inch proportion.`;
    } else if (constraints.lockedSizeId) {
      const sizeSpec = getFinerWorksSizeById(constraints.lockedSizeId);
      targetSizeClause = `Locked Print Size: ${sizeSpec.id} (${sizeSpec.labelInches}, aspect ratio ${sizeSpec.aspectRatioLabel}).`;
    }

    const mediaClause = lockedMedia
      ? `Locked FinerWorks Substrate: MediaID ${lockedMedia.mediaId} "${lockedMedia.name}" (${lockedMedia.substrateSlug}, ProductType=${lockedMedia.productTypeId}, Finish=${lockedMedia.surfaceFinish}).`
      : '';

    const frameClause = lockedFrame
      ? `Locked FinerWorks Frame Moulding: "${lockedFrame.profileId}" (FrameID ${lockedFrame.finerworksFrameId} — ${lockedFrame.name}, ${lockedFrame.thicknessInches}" face width, ${lockedFrame.colorLabel}${
          lockedFrame.isFloatFrame ? `, ${lockedFrame.floatOffsetInches}" float shadow gap` : ''
        }).`
      : '';

    const matClause = matDisabledByPhysics
      ? `Locked Matting Rule: Matboard is strictly DISABLED (effective mat width = "none", no paper matboard bevel) because ${
          isNonPaperSubstrate
            ? `substrate "${lockedMedia?.shortName}" (ProductType ${lockedMedia?.productTypeId}) is a rigid/stretched surface (Stretched Canvas, ChromaLuxe Metal, or Face-Mounted Acrylic)`
            : `frame "${lockedFrame?.name}" (${lockedFrame?.profileId}) does not allow matting`
        }.`
      : effectiveMatWidthId === 'none'
      ? 'Locked Matting Rule: Full-bleed framing with NO matboard border ("none").'
      : `Locked Matting Rule: Render a crisp ${effectiveMatWidthId} 4-ply bevel-cut matboard border in "${effectiveMatColorId}" (${lockedMatSpec.name}, MatID ${lockedMatSpec.finerworksMatId}).`;

    const glazingClause =
      effectiveGlazingId !== 'none'
        ? `Locked Glazing: ${lockedGlazingSpec.name} (GlassID ${lockedGlazingSpec.finerworksGlassId}).`
        : '';

    return [
      catalogManifest,
      'MANDATORY USER-LOCKED FINERWORKS SPECIFICATION:',
      'The collector has explicitly locked their FinerWorks production options. Every generated room visualization MUST depict these exact physical framing, substrate, matboard, and sizing specifications:',
      mediaClause,
      frameClause,
      matClause,
      glazingClause,
      targetSizeClause,
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    catalogManifest,
    'FINERWORKS ARCHIVAL CATALOG CURATION DIRECTIVE:',
    'Select framing, substrate, matting, and sizing options EXCLUSIVELY from the FinerWorks Catalog Manifest above and adhere strictly to FinerWorks physical compatibility rules: (1) Stretched Canvas (ProductType 1), ChromaLuxe Metal (ProductType 2), and Face-Mounted Acrylic (ProductType 3) must NEVER be rendered with a paper matboard bevel ("none" mat only); (2) Brushed Brass Float frames ("brushed-brass-float", FrameID 458) have a 0.35" recessed shadow gap and NEVER use matboard or glazing; (3) Unframed Gallery Wrap ("unframed-canvas", FrameID 0) has a 1.5" mirrored stretcher edge with no outer frame or matboard; (4) Archival Fine Art Papers (ProductType 5, MediaIDs 6, 41, 42, 45, 48) pair with hardwood mouldings ("natural-white-oak", "american-black-walnut", "matte-gallery-black", "warm-travertine-ash") and 4-ply cotton rag matboards ("none", "1.5in", "2.5in", "3.5in").',
  ].join(' ');
}

export function composeCuratorialPreAnalysisPrompt(
  config: Partial<
    Pick<
      AiPromptConfiguration,
      | 'placementAction'
      | 'placementLocationNote'
      | 'styleMode'
      | 'stylePreset'
      | 'customStyleNote'
      | 'additionalUserDetails'
      | 'artPieceCountMode'
      | 'finerworksConstraints'
    >
  >,
  optionCount = 3
): string {
  const presetMeta =
    config.stylePreset && CURATED_STYLE_PRESET_DESCRIPTIONS[config.stylePreset]
      ? CURATED_STYLE_PRESET_DESCRIPTIONS[config.stylePreset]
      : CURATED_STYLE_PRESET_DESCRIPTIONS['impasto-oil'];

  const styleConstraint =
    config.styleMode === 'specific-style'
      ? `The collector requested the "${presetMeta.label}" style (${presetMeta.promptDescriptor})${
          config.customStyleNote?.trim() ? ` with note: "${config.customStyleNote.trim()}"` : ''
        }. All ${optionCount} options must honor this medium while offering ${optionCount} distinct compositional and color-harmony interpretations suited to the room.`
      : `The collector selected AI Auto-Curation${
          config.customStyleNote?.trim() ? ` with note: "${config.customStyleNote.trim()}"` : ''
        }. Propose ${optionCount} distinct, museum-grade fine-art directions (varying compositional approach, brushwork texture, and tonal emphasis) that each look extraordinary in this room.`;

  const locationHint = config.placementLocationNote?.trim()
    ? `Target wall location: "${config.placementLocationNote.trim()}".`
    : '';
  const extraHint = config.additionalUserDetails?.trim()
    ? `Additional collector preferences: "${config.additionalUserDetails.trim()}".`
    : '';

  const finerworksManifestBlock = composeFinerWorksCatalogManifestBlock(
    config.finerworksConstraints
  );

  return [
    'You are the Chief Fine-Art & Interior Architectural Curator at ATELIER VUE.',
    'Before determining what piece of art to place on the wall, you MUST think first about these 3 foundational architectural elements visible in the room photograph:',
    '1. STYLE OF FURNITURE (`furniture_style_analysis`): Analyze the exact style, era, silhouette, upholstery textures, wood species, and decorative character of the furniture in the room (e.g., mid-century modern mustard velvet armchair with tapered timber legs, minimalist bouclé sofa, walnut credenza, brass/ceramic accents).',
    '2. LOCATION & FUNCTION OF THE SPACE (`space_location_analysis`): Identify the location, room type, functional purpose, and lighting environment of the space (e.g., intimate reading nook, sunlit living room lounge, serene primary bedroom sanctuary, dining salon), including natural daylight direction and how the target wall anchors the furniture arrangement.',
    '3. COLOR PALETTE OF THE ROOM (`color_palette_analysis`): Extract the room color palette in detail — dominant wall hue and undertone, primary and secondary furniture colors, wood/flooring warmth, and the ideal harmonious + complementary fine-art pigments that will bridge the wall and furniture.',
    `4. DETERMINE ${optionCount} APPROPRIATE ART PIECE OPTIONS (\`options\`): Based directly on (1) the style of furniture, (2) the location of the space, and (3) the color palette of the room, design exactly ${optionCount} distinct, museum-worthy fine-art options that will look exceptional in this room.`,
    styleConstraint,
    locationHint,
    extraHint,
    finerworksManifestBlock,
    'Return ONLY a strict JSON object with no markdown fences matching this exact schema:',
    '{"furniture_style_analysis": string, "space_location_analysis": string, "color_palette_analysis": string, "options": [{"option_number": 1, "option_label": string, "artwork_title": string, "art_style_and_medium": string, "color_palette_harmony": string, "why_it_fits_furniture_location_and_palette": string, "recommended_frame_id": "natural-white-oak"|"american-black-walnut"|"matte-gallery-black"|"brushed-brass-float"|"warm-travertine-ash"|"unframed-canvas", "recommended_mat_width_id": "none"|"1.5in"|"2.5in"|"3.5in", "image_generation_direction": string}]}',
  ]
    .filter(Boolean)
    .join(' ');
}

export function resolveTargetArtPieceCount(
  config: Partial<
    Pick<
      AiPromptConfiguration,
      'artPieceCountMode' | 'placementAction' | 'placementLocationNote' | 'additionalUserDetails'
    >
  >
): number {
  if (config.artPieceCountMode === 'multi-piece-pair') {
    return 2;
  }
  if (config.artPieceCountMode === 'multi-piece-trio') {
    return 3;
  }
  if (config.artPieceCountMode === 'single-piece') {
    return 1;
  }

  const combinedText = `${config.placementLocationNote || ''} ${
    config.additionalUserDetails || ''
  }`.trim();

  if (/\b(three|3|trio)\b/i.test(combinedText)) {
    return 3;
  }
  if (
    /\b(two|2|multiple|both walls|pieces|walls|pair|each wall|empty walls)\b/i.test(combinedText) ||
    config.placementAction === 'both'
  ) {
    return 2;
  }

  return 1;
}

export function composeRoomReimaginePrompt(
  config: Pick<
    AiPromptConfiguration,
    'placementAction' | 'styleMode' | 'stylePreset' | 'customStyleNote'
  > &
    Partial<
      Pick<
        AiPromptConfiguration,
        | 'placementLocationNote'
        | 'additionalUserDetails'
        | 'artPieceCountMode'
        | 'finerworksConstraints'
      >
    >,
  variationOrOptions?: number | ComposeRoomReimagineOptions
): string {
  const options: ComposeRoomReimagineOptions =
    typeof variationOrOptions === 'number'
      ? { variationIndex: variationOrOptions }
      : variationOrOptions ?? {};

  const variationIndex = options.variationIndex ?? 0;
  const targetPieceCount = resolveTargetArtPieceCount(config);
  const countMode: ArtPieceCountMode = config.artPieceCountMode ?? 'auto-multi-wall';

  const curatorialThinkingProtocol = [
    'MANDATORY CURATORIAL REASONING BEFORE DETERMINING THE ART PIECE:',
    'Think FIRST about (1) the STYLE OF FURNITURE in the room (its design era, silhouette, upholstery textures, wood tones, and surrounding decor), (2) the LOCATION & FUNCTION OF THE SPACE (what kind of room or architectural nook this is, how people experience it, and how natural/ambient light enters the space), and (3) the COLOR PALETTE OF THE ROOM (dominant wall hue, accent furniture colors, wood/flooring undertones, and warm/cool lighting balance).',
    'Only AFTER evaluating the furniture style, space location, and room color palette, determine and render an appropriate, cohesive fine-art piece whose subject, medium, pigment palette, scale, and museum frame look genuinely commissioned for this space.',
  ].join(' ');

  const placementInstruction =
    WALL_PLACEMENT_DESCRIPTIONS[config.placementAction] ?? WALL_PLACEMENT_DESCRIPTIONS['add-only'];

  let pieceCountInstruction: string;
  if (targetPieceCount === 3) {
    pieceCountInstruction = PIECE_COUNT_DESCRIPTIONS['multi-piece-trio'];
  } else if (targetPieceCount === 2) {
    pieceCountInstruction = PIECE_COUNT_DESCRIPTIONS['multi-piece-pair'];
  } else if (countMode === 'single-piece') {
    pieceCountInstruction = PIECE_COUNT_DESCRIPTIONS['single-piece'];
  } else {
    pieceCountInstruction = PIECE_COUNT_DESCRIPTIONS['auto-multi-wall'];
  }

  const locationNote = config.placementLocationNote?.trim();
  const placementLocationClause = locationNote
    ? `EXPECTED PLACEMENT LOCATION: Place the artwork specifically at: "${locationNote}".`
    : '';

  let styleInstruction: string;
  if (config.styleMode === 'ai-curated') {
    const customAddition = config.customStyleNote.trim()
      ? ` Incorporate this additional curatorial note: "${config.customStyleNote.trim()}".`
      : '';
    styleInstruction =
      `ART STYLE DIRECTION (AI AUTO-CURATED TO ROOM): First evaluate the style of the furniture, the location and function of the space, and the color palette of the room (wall undertones, upholstery accents, wood finishes, and lighting warmth in Kelvin), then autonomously determine the best-fitting fine-art painting style, medium, and harmonized color palette so the artwork looks bespoke-commissioned for this space.` +
      customAddition;
  } else {
    const presetMeta =
      CURATED_STYLE_PRESET_DESCRIPTIONS[config.stylePreset] ??
      CURATED_STYLE_PRESET_DESCRIPTIONS['impasto-oil'];
    const customNote = config.customStyleNote.trim();
    const customNoteClause = customNote
      ? ` Custom collector style direction: "${customNote}".`
      : '';
    styleInstruction = `ART STYLE DIRECTION (SPECIFIC CURATED STYLE — ${presetMeta.label}): Create the wall painting(s) in the style of ${presetMeta.promptDescriptor}, specifically tailored to the room's furniture style, space location, and room color palette.${customNoteClause} Harmonize the pigment undertones and frame shadow cast with the room's ambient light.`;
  }

  const additionalDetails = config.additionalUserDetails?.trim();
  const additionalDetailsClause = additionalDetails
    ? `ADDITIONAL USER DETAILS & PREFERENCES: "${additionalDetails}".`
    : '';

  const finerworksManifestBlock = composeFinerWorksCatalogManifestBlock(
    config.finerworksConstraints
  );

  const angleClause =
    options.angleLabel || (options.totalAngles && options.totalAngles > 1)
      ? `MULTI-ANGLE VIEWPOINT CONTEXT (${options.angleLabel ?? `Angle ${(options.angleIndex ?? 0) + 1}`}${
          options.totalAngles ? ` — Viewpoint ${(options.angleIndex ?? 0) + 1} of ${options.totalAngles}` : ''
        }): Render the curated wall artwork naturally from this camera viewpoint while keeping all room geometry and furniture 100% identical to this angle's original photo.`
      : '';

  const strictPreservationMandate = [
    'NON-NEGOTIABLE ROOM & FURNITURE PRESERVATION MANDATE:',
    '(1) STRICTLY NOT ALLOWED TO REMOVE OR ALTER FURNITURE: You are strictly NOT allowed to remove, move, hide, resize, crop out, or alter any pre-existing furniture or decor in the room (including sofas, chairs, tables, credenzas, beds, lamps, rugs, plants, pillows, curtains, or tabletop objects). Every single piece of pre-existing furniture must remain in its exact original pixel position and appearance.',
    '(2) STRICTLY NOT ALLOWED TO CHANGE ROOM DIMENSIONS: You are strictly NOT allowed to change the dimensions of the room, wall proportions, ceiling height, floor boundaries, windows, doors, architectural moldings, camera angle, lens focal length, or perspective geometry.',
    '(3) MANDATORY PRE-OUTPUT SELF-VERIFICATION CHECK: Before releasing the output image, perform an internal verification check comparing your generated image against the input room photo to confirm you abided by rules (1) and (2) and that the ONLY difference between the input room photo and your output is the requested wall art change.',
  ].join(' ');

  const variationClause =
    variationIndex > 0
      ? `CURATORIAL VARIATION #${variationIndex + 1}: ${
          VARIATION_DIRECTIVES[variationIndex % VARIATION_DIRECTIVES.length]
        }`
      : '';

  const correctionClause = options.correctionInstructions?.trim()
    ? `CRITICAL CORRECTION FROM PRIOR VERIFICATION CHECK: ${options.correctionInstructions.trim()}`
    : '';

  return [
    'Photorealistic interior architectural reimagining of this exact room photograph.',
    curatorialThinkingProtocol,
    placementInstruction,
    pieceCountInstruction,
    placementLocationClause,
    styleInstruction,
    additionalDetailsClause,
    finerworksManifestBlock,
    angleClause,
    strictPreservationMandate,
    'ARCHIVAL 300-DPI ZERO-GRAIN QUALITY CONTROL MANDATE: Render all wall artwork and interior surfaces with ultra-crisp, zero-grain, noise-free, high-definition optical clarity suitable for 300-DPI large-format museum printing up to 36"×48" (10,800×14,400 px) and 40"×60" (12,000×18,000 px). Strictly avoid ISO film grain, digital sensor noise, muddy stippling, or compression blockiness; maintain razor-sharp pigment transitions and clean continuous tonal gradients.',
    'Ensure each placed painting has crisp, high-definition canvas detail, realistic frame depth, and natural wall shadow integration.',
    variationClause,
    correctionClause,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Simplified single-input prompt that eliminates the separate Stage 0 pre-analysis step and
 * instructs Gemini directly to come up with a reimagined room keeping the exact same dimensions
 * and original furniture, placing wall art that is a strong visual fit when considering:
 *   (1) the space setting,
 *   (2) the furniture style,
 *   (3) the color palette, and
 *   (4) additional requests from the user.
 * Specifies the consolidated deliverables:
 *   - Row 1: The reimagined room in 3 different options (Option 1, Option 2, Option 3)
 *   - Row 2: A separate Frame/Mat Detection Layer version where the detection box sits tightly on the frame itself with zero wall space for the sizing calibration tool
 *   - Row 3: The standalone 300-DPI print synthesis for each painting option shown in the images
 */
export function composeConsolidatedDeliverablesPrompt(
  config: Partial<
    Pick<
      AiPromptConfiguration,
      | 'placementAction'
      | 'placementLocationNote'
      | 'styleMode'
      | 'stylePreset'
      | 'customStyleNote'
      | 'additionalUserDetails'
      | 'artPieceCountMode'
      | 'finerworksConstraints'
    >
  >,
  options?: {
    hasFrameReferenceImage?: boolean;
    referenceFrameTitle?: string;
  }
): string {
  const presetMeta =
    config.stylePreset && CURATED_STYLE_PRESET_DESCRIPTIONS[config.stylePreset]
      ? CURATED_STYLE_PRESET_DESCRIPTIONS[config.stylePreset]
      : CURATED_STYLE_PRESET_DESCRIPTIONS['impasto-oil'];

  const actionClause =
    config.placementAction === 'replace-existing'
      ? 'Replace the existing wall art while keeping the exact same room dimensions and 100% of the original furniture.'
      : config.placementAction === 'both'
      ? 'Replace existing wall art and add coordinated new wall art while keeping the exact same room dimensions and 100% of the original furniture.'
      : 'Add new framed wall art onto the open wall while keeping the exact same room dimensions and 100% of the original furniture.';

  const styleClause =
    config.styleMode === 'specific-style'
      ? `Requested art style across 3 distinct Art Collections: ${presetMeta.label} (${presetMeta.promptDescriptor}) — create 3 distinct curatorial collections (Collection I: Tonal & Textural Harmony, Collection II: Complementary Architectural Contrast, Collection III: Atmospheric Horizon & Organic Materiality).`
      : 'Curate 3 distinct sets of generations representing 3 different Art Collections (Collection I: Tonal & Textural Harmony, Collection II: Complementary Architectural Contrast, Collection III: Atmospheric Horizon & Organic Materiality) tailored to the space setting, furniture style, and room color palette.';

  const locationClause = config.placementLocationNote?.trim()
    ? `Target wall placement: "${config.placementLocationNote.trim()}".`
    : '';
  const extraRequestsClause = [config.customStyleNote?.trim(), config.additionalUserDetails?.trim()]
    .filter(Boolean)
    .join(' · ');

  const finerworksManifestBlock = composeFinerWorksCatalogManifestBlock(
    config.finerworksConstraints
  );

  const frameReferenceClause = options?.hasFrameReferenceImage
    ? `CATALOGUE FRAME MOULDING REFERENCE IMAGE PROVIDED (Image 2): Render the outer frame around the wall artwork in Row 1 to match the exact moulding profile, wood grain / metallic sheen, rabbet step, and 45-degree mitered corners shown in Image 2${
        options.referenceFrameTitle ? ` (${options.referenceFrameTitle})` : ''
      }.`
    : '';

  return [
    'SINGLE-CALL 3-COLLECTION GENERATION MANDATE: In this single generation call, produce three complete sets of generations representing three different Art Collections (Art Collection 1, Art Collection 2, and Art Collection 3) for the room in Image 1, keeping the exact same room dimensions and 100% of the original furniture.',
    actionClause,
    styleClause,
    locationClause,
    extraRequestsClause ? `Additional user requests: "${extraRequestsClause}".` : '',
    finerworksManifestBlock,
    frameReferenceClause,
    'SINGLE-FRAME-ONLY RULE: Each framed wall artwork in Row 1 must have ONLY ONE single outer frame moulding with zero inner secondary frame, zero double-frame border, and zero fake inner frame.',
    'ARCHIVAL 300-DPI ZERO-GRAIN QUALITY CONTROL MANDATE: Every cell in the 3x3 deliverables sheet MUST be rendered with ultra-clean, zero-grain, noise-free, high-definition optical clarity suitable for 300-DPI archival master printing up to the largest gallery sizes (36"×48" at 10,800×14,400 px and 40"×60" at 12,000×18,000 px). Strictly prohibit ISO film grain, digital sensor noise, pixelated stippling, or JPEG block artifacts; maintain razor-sharp brushwork edges and smooth continuous pigment gradients.',
    'Deliverables in a single borderless 3x3 grid image (3 columns = Option 1 [Art Collection 1], Option 2 [Art Collection 2], Option 3 [Art Collection 3]; 3 rows = the 3 deliverables, with NO text captions):',
    '- DELIVERABLE 1 (Row 1, Columns 1-3): The reimagined room in 3 different options / 3 distinct art collections (Column 1 = Art Collection 1, Column 2 = Art Collection 2, Column 3 = Art Collection 3) keeping identical room dimensions and furniture.',
    '- DELIVERABLE 2 (Row 2, Columns 1-3): A separate version of each reimagined room (Columns 1-3) with a high-contrast Frame/Mat Detection Box sitting TIGHTLY flush on the picture frame molding itself with zero wall space around it, so it can be extracted as a separate detection layer on the photo and compared directly to the calibrated ruler in the sizing tool.',
    '- DELIVERABLE 3 (Row 3, Columns 1-3): The standalone flat, borderless, frame-free, mat-free, edge-to-edge 300-DPI print synthesis for each of the 3 painting options / art collections shown in Row 1 (Column 1 = Unframed Print for Art Collection 1, Column 2 = Unframed Print for Art Collection 2, Column 3 = Unframed Print for Art Collection 3).',
  ]
    .filter(Boolean)
    .join(' ');
}

export function composeRoomPreservationCheckPrompt(params?: {
  placementAction?: WallPlacementAction;
  placementLocationNote?: string;
  angleLabel?: string;
}): string {
  const action = params?.placementAction ?? 'add-only';
  const actionDescription =
    action === 'replace-existing'
      ? 'replacing existing wall art with new framed wall art'
      : action === 'both'
      ? 'both replacing existing wall art and adding new framed wall art on open wall space'
      : 'adding new framed wall art onto the open wall space';

  const locationContext = params?.placementLocationNote?.trim()
    ? `Requested placement location: "${params.placementLocationNote.trim()}".`
    : '';

  const angleContext = params?.angleLabel?.trim()
    ? `Viewpoint being verified: "${params.angleLabel.trim()}".`
    : '';

  return [
    'You are a strict Architectural & Interior Integrity Verification Judge.',
    'Compare Image 1 (Original Uploaded Room Photo) and Image 2 (Candidate AI-Reimagined Room Photo).',
    `The intended edit was strictly limited to ${actionDescription}.`,
    locationContext,
    angleContext,
    'Verify the following 3 mandatory preservation rules:',
    '1. furniture_preserved: Were 100% of all pre-existing furniture items (sofas, chairs, tables, credenzas, lamps, rugs, plants, pillows, decor) kept in their exact original positions without any item being removed, hidden, or altered?',
    '2. room_dimensions_preserved: Were the room dimensions, wall proportions, ceiling height, windows, doors, floor geometry, and camera perspective 100% preserved without distortion or cropping?',
    '3. only_difference_is_wall_art: Is the ONLY meaningful visual difference between Image 1 and Image 2 the newly added or replaced wall art (and its natural frame shadow on the wall)?',
    'Locate the exact OUTER perimeter of the newly placed or replaced picture frame in Image 2 as normalized integer coordinates `artwork_bbox_normalized`: [ymin, xmin, ymax, xmax] on a 0..1000 scale (from the outermost top/left/bottom/right edges of the frame so the sizing box aligns tightly with the outer frame), AND locate the exact INNER painted canvas window `inner_canvas_bbox_normalized`: [ymin, xmin, ymax, xmax] on a 0..1000 scale (strictly inside the frame moulding AND strictly inside any white/ivory/colored matboard border and bevel so zero frame moulding and zero matboard border are included in `inner_canvas_bbox_normalized`), and if multiple art pieces were placed, list all placed art pieces in the "artworks" array. Also identify the rendered frame style (`detected_frame_id`: "unframed-canvas"|"natural-white-oak"|"american-black-walnut"|"matte-gallery-black"|"brushed-brass-float"|"warm-travertine-ash"), matboard width (`detected_mat_width_id`: "none"|"1.5in"|"2.5in"|"3.5in"), and matboard color (`detected_mat_color_id`: "archival-ivory"|"warm-museum-linen"|"charcoal-conservation").',
    'Return ONLY a strict JSON object with no markdown fences matching this exact schema:',
    '{"furniture_preserved": boolean, "room_dimensions_preserved": boolean, "only_difference_is_wall_art": boolean, "discrepancies_found": string, "correction_instructions": string, "room_style": string, "artwork_bbox_normalized": [ymin, xmin, ymax, xmax], "inner_canvas_bbox_normalized": [ymin, xmin, ymax, xmax], "artwork_title": string, "artwork_description": string, "detected_frame_id": string, "detected_mat_width_id": string, "detected_mat_color_id": string, "artworks": [{"title": string, "wall_location_label": string, "description": string, "bbox_normalized": [ymin, xmin, ymax, xmax], "inner_canvas_bbox_normalized": [ymin, xmin, ymax, xmax], "detected_frame_id": string, "detected_mat_width_id": string}]}',
  ]
    .filter(Boolean)
    .join(' ');
}

export function composeFinerWorksOptionsCheckPrompt(
  config: AiPromptConfiguration,
  variationIndex = 0
): string {
  const finerworksManifestBlock = composeFinerWorksCatalogManifestBlock(
    config.finerworksConstraints
  );

  return [
    'You are Separate AI Checker Agent #2 — the FinerWorks Options & Framing Compliance Judge.',
    `Inspect Image 1 (Reimagined Room Photo — Variation #${variationIndex + 1}) and Image 2 (Isolated Framed Artwork Crop) against the FinerWorks Catalog Manifest and constraint mode (${
      config.finerworksConstraints?.mode ?? 'curator-selects-finerworks'
    }).`,
    finerworksManifestBlock,
    'Verify the following 4 FinerWorks archival production compliance criteria:',
    '1. frame_option_valid: Does the rendered frame moulding match an authentic FinerWorks Frame Moulding profile ("unframed-canvas", "natural-white-oak", "american-black-walnut", "matte-gallery-black", "brushed-brass-float", "warm-travertine-ash") and honor any user-locked frame constraint?',
    '2. matting_and_glazing_valid: Does the matboard border width ("none", "1.5in", "2.5in", "3.5in") and mat color ("archival-ivory", "warm-museum-linen", "charcoal-conservation") obey FinerWorks physical compatibility rules (Stretched Canvas, ChromaLuxe Metal, Face-Mounted Acrylic, Unframed wraps, and Brushed Brass Float frames must NEVER have a paper matboard bevel) and honor any user-locked mat constraint?',
    '3. sizing_and_aspect_ratio_valid: Do the artwork proportions and physical scale fit within FinerWorks substrate minimum/maximum inch bounds and honor any user-locked print size?',
    '4. substrate_surface_authentic: Does the rendered artwork surface authentically reflect a valid FinerWorks archival substrate (Hahnemühle fine art rag paper, stretched canvas weave, ChromaLuxe aluminum, or optical acrylic)?',
    'Return ONLY a strict JSON object with no markdown fences matching this exact schema:',
    '{"frame_option_valid": boolean, "matting_and_glazing_valid": boolean, "sizing_and_aspect_ratio_valid": boolean, "substrate_surface_authentic": boolean, "detected_frame_id": string, "detected_mat_width_id": string, "detected_mat_color_id": string, "detected_media_id": number, "discrepancies_found": string[], "correction_instructions": string}',
  ]
    .filter(Boolean)
    .join(' ');
}

export function composeArtworkDetectionPrompt(
  placementAction: WallPlacementAction = 'add-only'
): string {
  const targetHint =
    placementAction === 'replace-existing'
      ? 'Locate the newly replaced primary fine-art painting on the wall in this reimagined room image.'
      : placementAction === 'both'
      ? 'Locate the primary newly added or replaced fine-art painting on the wall in this reimagined room image.'
      : 'Locate the newly added primary fine-art painting on the wall in this reimagined room image.';

  return [
    targetHint,
    'Identify the tight bounding box of the outer picture frame perimeter itself (from the outermost top/left/bottom/right frame edges, excluding surrounding room walls and furniture).',
    'Return ONLY a strict JSON object with no markdown fences matching this exact schema:',
    '{"room_style": string, "artwork_bbox_normalized": [ymin, xmin, ymax, xmax], "artwork_title": string, "artwork_description": string}',
    'where ymin, xmin, ymax, xmax are integers normalized on a 0 to 1000 scale (0 = top/left edge, 1000 = bottom/right edge, with ymin < ymax and xmin < xmax).',
  ].join(' ');
}

export function composeIdenticalPrintMasterPrompt(params: {
  artworkTitle?: string;
  artworkDescription?: string;
  styleMode?: ArtStyleSelectionMode;
  stylePreset?: CuratedArtStylePreset;
}): string {
  const titleClause = params.artworkTitle?.trim()
    ? `Artwork title reference: "${params.artworkTitle.trim()}".`
    : '';
  const descriptionClause = params.artworkDescription?.trim()
    ? `Visual subject & brushwork reference: "${params.artworkDescription.trim()}".`
    : '';
  const stylePresetMeta =
    params.stylePreset && CURATED_STYLE_PRESET_DESCRIPTIONS[params.stylePreset]
      ? CURATED_STYLE_PRESET_DESCRIPTIONS[params.stylePreset]
      : undefined;
  const styleClause =
    params.styleMode === 'specific-style' && stylePresetMeta
      ? `Maintain the authentic ${stylePresetMeta.label} medium and pigment character.`
      : 'Maintain the exact fine-art medium, pigment saturation, and surface texture.';

  return [
    'STRICT 1:1 IDENTICAL FINE-ART PRINT MASTER RECONSTRUCTION:',
    'Take this cropped wall screenshot of the painting from the room photograph and generate an extremely identical, flat, front-facing, perspective-rectified, borderless, frame-free, lighting-neutral 2D fine-art print master.',
    'Preserve the exact composition, subject geometry, color palette, and brushstroke placement 1:1 with the reference screenshot.',
    'Remove all room perspective tilt, remove any outer picture frame, matboard, glass reflections, or uneven room wall shadows, and fill 100% of the image canvas edge-to-edge with the high-resolution artwork itself at 300-DPI archival gallery quality.',
    'ARCHIVAL 300-DPI ZERO-GRAIN QUALITY CONTROL MANDATE: Produce a zero-grain, noise-free, ultra-high-definition print master suitable for 300-DPI archival museum printing up to 36"×48" (10,800×14,400 px) and 40"×60" (12,000×18,000 px) with crisp pigment transitions and zero digital artifacts.',
    titleClause,
    descriptionClause,
    styleClause,
  ]
    .filter(Boolean)
    .join(' ');
}

export function composeScaleQuestionsPrompt(placementLocationNote?: string): string {
  const placementContext = placementLocationNote?.trim()
    ? `The user plans to place artwork at: "${placementLocationNote.trim()}".`
    : 'The user plans to place framed artwork on the primary visible wall expanse.';

  return [
    'You are an Architectural Interior Scale & Proportional Framing Specialist.',
    'Inspect this uploaded room photograph to identify the 3 easiest-to-measure physical reference dimensions visible in the space (such as the width of the primary sofa/bed/credenza beneath the wall, the horizontal span of the open wall section, and the floor-to-ceiling height or vertical wall clearance).',
    placementContext,
    'Formulate exactly 3 concise, homeowner-friendly measurement questions in inches that will calibrate the real-world scale of the artwork so the physical print matches the visual proportion shown on their wall.',
    'Return ONLY a strict JSON object with no markdown fences matching this exact schema:',
    '{"questions": [{"id": string, "questionText": string, "helperText": string, "unitLabel": "inches", "placeholder": string, "suggestedQuickValuesInches": [{"label": string, "valueInches": number}]}]}',
  ].join(' ');
}

export function createDefaultAiPromptConfig(
  overrides?: Partial<AiPromptConfiguration>
): AiPromptConfiguration {
  const defaultEngineId: AiEngineId = overrides?.engineId ?? 'astra';
  const baseConfig: AiPromptConfiguration = {
    engineId: defaultEngineId,
    placementAction: overrides?.placementAction ?? 'add-only',
    placementLocationNote: overrides?.placementLocationNote ?? '',
    artPieceCountMode: overrides?.artPieceCountMode ?? 'auto-multi-wall',
    styleMode: overrides?.styleMode ?? 'ai-curated',
    stylePreset: overrides?.stylePreset ?? 'impasto-oil',
    customStyleNote: overrides?.customStyleNote ?? '',
    additionalUserDetails: overrides?.additionalUserDetails ?? '',
    editablePromptText: '',
    isPromptManuallyEdited: overrides?.isPromptManuallyEdited ?? false,
    finerworksConstraints: overrides?.finerworksConstraints ?? {
      mode: 'curator-selects-finerworks',
    },
  };

  baseConfig.editablePromptText =
    overrides?.editablePromptText !== undefined
      ? overrides.editablePromptText
      : composeRoomReimaginePrompt(baseConfig, 0);

  return baseConfig;
}
