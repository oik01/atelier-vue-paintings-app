import React from 'react';
import {
  AiEngineId,
  AiGenerationStage,
  AiPromptConfiguration,
  ArtPieceCountMode,
  ArtStyleSelectionMode,
  CuratedArtStylePreset,
  WallPlacementAction,
} from '../../contracts/masterContract';

export interface ArtStylePresetOption {
  id: CuratedArtStylePreset;
  label: string;
  description: string;
}

export const CURATED_STYLE_PRESETS: ArtStylePresetOption[] = [
  {
    id: 'impasto-oil',
    label: 'Impasto Oil',
    description: 'Thick palette-knife relief & warm gallery pigment',
  },
  {
    id: 'wabi-sabi-plaster',
    label: 'Wabi-Sabi Plaster',
    description: 'Raw mineral limewash, travertine & linen',
  },
  {
    id: 'minimalist-abstract',
    label: 'Minimalist Abstract',
    description: 'Monolithic calm forms & negative space',
  },
  {
    id: 'warm-midcentury',
    label: 'Warm Mid-Century',
    description: 'Organic ochre, burnt sienna, walnut & charcoal',
  },
  {
    id: 'impressionist-landscape',
    label: 'Atmospheric Landscape',
    description: 'Luminous horizon, mist & coastal depth',
  },
  {
    id: 'bauhaus-geometric',
    label: 'Bauhaus Geometric',
    description: 'Architectural balance, arches & earth blocks',
  },
  {
    id: 'botanical-ink',
    label: 'Botanical & Sumi Ink',
    description: 'Organic foliage wash on raw cotton rag',
  },
  {
    id: 'rothko-colorfield',
    label: 'Luminous Color-Field',
    description: 'Deep layered atmospheric color bands',
  },
  {
    id: 'nordic-monochrome',
    label: 'Nordic Charcoal & Ivory',
    description: 'Sculptural charcoal & warm alabaster contrast',
  },
  {
    id: 'mediterranean-fresco',
    label: 'Mediterranean Fresco',
    description: 'Sun-baked terracotta, olive & limestone',
  },
  {
    id: 'contemporary-figurative',
    label: 'Expressive Silhouette',
    description: 'Poetic minimalist contour & line study',
  },
  {
    id: 'japanese-woodblock',
    label: 'Zen Mist & Woodblock',
    description: 'Serene mountain mist, indigo & cypress',
  },
  {
    id: 'sculptural-paper-relief',
    label: 'Sculptural Bas-Relief',
    description: '3D monochromatic fluting & light shadow-play',
  },
  {
    id: 'abstract-expressionist',
    label: 'Gestural Expressionism',
    description: 'Bold sweeping brushwork & raw canvas energy',
  },
  {
    id: 'classical-still-life',
    label: 'Modernist Still Life',
    description: 'Stoneware vessels & chiaroscuro studio light',
  },
  {
    id: 'desert-earth-strata',
    label: 'Desert Earth Strata',
    description: 'Layered sandstone, canyon rust, sage & dusk',
  },
];

export const ART_STYLE_PRESET_OPTIONS: ArtStylePresetOption[] = CURATED_STYLE_PRESETS;

export const WALL_PLACEMENT_LOCATION_PRESETS: string[] = [
  'Centered above main sofa',
  'Above bed headboard',
  'Over dining console / credenza',
  'Above fireplace mantel',
  'Flanking window or doorway',
  'Across two adjacent empty walls',
];

export const ADDITIONAL_DETAILS_MOOD_PRESETS: string[] = [
  'Warm Linen, Ochre & Terracotta',
  'Calm Travertine & Raw Oak',
  'Coastal Slate, Mist & Sage',
  'Sculptural Charcoal & Warm Ivory',
  'Sun-Baked Mediterranean Earth',
  'Soft Morning Gold & Botanical Green',
];

export interface ArtPieceCountOption {
  id: ArtPieceCountMode;
  label: string;
  description: string;
  testId: string;
}

export const ART_PIECE_COUNT_OPTIONS: ArtPieceCountOption[] = [
  {
    id: 'auto-multi-wall',
    label: 'Auto-Fit Empty Walls',
    description: 'Places multiple pieces if multiple walls are open',
    testId: 'piece-count-auto-multi-wall',
  },
  {
    id: 'single-piece',
    label: 'Single Focal Piece',
    description: '1 statement piece',
    testId: 'piece-count-single-piece',
  },
  {
    id: 'multi-piece-pair',
    label: 'Coordinated Pair (2 Pieces)',
    description: '2 pieces at once',
    testId: 'piece-count-multi-piece-pair',
  },
  {
    id: 'multi-piece-trio',
    label: 'Multi-Wall Trio (3 Pieces)',
    description: '3 pieces at once',
    testId: 'piece-count-multi-piece-trio',
  },
];

export interface AtelierCreationStepSpec {
  stepNumber: 1 | 2 | 3 | 4;
  testId: 'creation-step-1' | 'creation-step-2' | 'creation-step-3' | 'creation-step-4';
  title: string;
  description: string;
}

export type AtelierCreationStepDef = AtelierCreationStepSpec;

export const ATELIER_CREATION_STEPS: AtelierCreationStepSpec[] = [
  {
    stepNumber: 1,
    testId: 'creation-step-1',
    title: '1. Absorbing the Room & Layout',
    description:
      "Reading your room's architectural proportions, natural light warmth, and open wall geometry...",
  },
  {
    stepNumber: 2,
    testId: 'creation-step-2',
    title: '2. Sprinkling On Atelier Vue Magic',
    description:
      'Composing bespoke artwork tailored to your walls and interior palette...',
  },
  {
    stepNumber: 3,
    testId: 'creation-step-3',
    title: '3. Harmonizing Spatial Balance & Room Fidelity',
    description:
      'Ensuring your furniture, room dimensions, and architectural character remain untouched...',
  },
  {
    stepNumber: 4,
    testId: 'creation-step-4',
    title: '4. Finalizing the Art Piece(s)',
    description:
      'Preparing museum-grade 300-DPI archival print masters for every piece in your space...',
  },
];

export type ComposeUiPromptInput = Omit<
  AiPromptConfiguration,
  | 'editablePromptText'
  | 'isPromptManuallyEdited'
  | 'placementLocationNote'
  | 'artPieceCountMode'
  | 'additionalUserDetails'
> & {
  placementLocationNote?: string;
  artPieceCountMode?: ArtPieceCountMode;
  additionalUserDetails?: string;
};

export function composeDefaultUiPrompt(config: ComposeUiPromptInput): string {
  const engineLabel =
    config.engineId === 'gemini-argon'
      ? 'Gemini Argon (Gemini 4 Argon)'
      : 'Astra (GPT-6 Astra)';

  let placementDirective: string;
  if (config.placementAction === 'replace-existing') {
    placementDirective =
      'Remove and replace any existing wall art or frames in the room with newly curated wall art pieces while preserving the surrounding room architecture, furniture, and natural lighting.';
  } else if (config.placementAction === 'both') {
    placementDirective =
      'Replace any existing wall art or frames in the room AND hang complementary new museum-grade wall art on open blank wall space while preserving all surrounding room architecture, furniture, and natural lighting.';
  } else {
    placementDirective =
      'Preserve all existing room architecture, furniture, and decor while hanging new museum-grade wall art on the open blank wall space.';
  }

  const pieceCountMode: ArtPieceCountMode =
    config.artPieceCountMode ?? 'auto-multi-wall';
  let pieceCountDirective: string;
  if (pieceCountMode === 'single-piece') {
    pieceCountDirective =
      'Piece Quantity & Wall Coverage: Single Focal Piece (1 statement piece).';
  } else if (pieceCountMode === 'multi-piece-pair') {
    pieceCountDirective =
      'Piece Quantity & Wall Coverage: Coordinated Pair (2 Pieces placed at once across the wall space).';
  } else if (pieceCountMode === 'multi-piece-trio') {
    pieceCountDirective =
      'Piece Quantity & Wall Coverage: Multi-Wall Trio (3 Pieces placed at once across the walls).';
  } else {
    pieceCountDirective =
      'Piece Quantity & Wall Coverage: Auto-Fit Empty Walls (places multiple coordinated pieces if multiple walls are open).';
  }

  const locationNote = (config.placementLocationNote ?? '').trim();
  const locationDirective =
    locationNote.length > 0
      ? `Expected Placement Location: ${locationNote}.`
      : '';

  const presetEntry =
    CURATED_STYLE_PRESETS.find((item) => item.id === config.stylePreset) ??
    CURATED_STYLE_PRESETS[0];

  const customNote = (config.customStyleNote ?? '').trim();

  let styleDirective: string;
  if (config.styleMode === 'ai-curated') {
    styleDirective =
      "Think first about (1) the style of furniture in the room, (2) the location and function of the space, and (3) the color palette of the room before determining an appropriate piece of art, medium, and brushwork that will look good and harmonize with the room's lighting and materials.";
    if (customNote.length > 0) {
      styleDirective += ` Additional curatorial note: ${customNote}.`;
    }
  } else {
    styleDirective = `Think first about (1) the style of furniture, (2) the location of the space, and (3) the color palette of the room, then render an appropriate artwork in ${presetEntry.label} style (${presetEntry.description}) harmonized to the space.`;
    if (customNote.length > 0) {
      styleDirective += ` Custom style direction: ${customNote}.`;
    }
  }

  const additionalDetails = (config.additionalUserDetails ?? '').trim();
  const additionalDetailsDirective =
    additionalDetails.length > 0
      ? `Additional User Preferences & Details: ${additionalDetails}.`
      : '';

  return [
    `[AI Engine: ${engineLabel}] Reimagine this exact room photo with museum-grade framed wall art.`,
    'Curatorial Thinking Protocol: First analyze the style of furniture, the location of the space, and the color palette of the room before determining an appropriate piece of art that will look good.',
    `Wall Placement Action: ${placementDirective}`,
    pieceCountDirective,
    locationDirective,
    `Art Style Direction: ${styleDirective}`,
    additionalDetailsDirective,
    'STRICT PRESERVATION RULE: Do NOT remove, move, hide, resize, or alter any pre-existing furniture (sofas, chairs, tables, lamps, rugs, plants, curtains, pillows, decor) or room dimensions, walls, windows, or camera perspective. Confirm before output that ONLY the wall art has changed.',
  ]
    .filter((segment) => segment.length > 0)
    .join(' ');
}

export function createInitialPromptConfiguration(
  overrides?: Partial<AiPromptConfiguration>
): AiPromptConfiguration {
  const engineId: AiEngineId = overrides?.engineId ?? 'astra';
  const placementAction: WallPlacementAction = overrides?.placementAction ?? 'add-only';
  const placementLocationNote: string = overrides?.placementLocationNote ?? '';
  const artPieceCountMode: ArtPieceCountMode =
    overrides?.artPieceCountMode ?? 'auto-multi-wall';
  const styleMode: ArtStyleSelectionMode = overrides?.styleMode ?? 'ai-curated';
  const stylePreset: CuratedArtStylePreset = overrides?.stylePreset ?? 'impasto-oil';
  const customStyleNote: string = overrides?.customStyleNote ?? '';
  const additionalUserDetails: string = overrides?.additionalUserDetails ?? '';
  const isPromptManuallyEdited: boolean = overrides?.isPromptManuallyEdited ?? false;

  const editablePromptText =
    overrides?.editablePromptText !== undefined
      ? overrides.editablePromptText
      : composeDefaultUiPrompt({
          engineId,
          placementAction,
          placementLocationNote,
          artPieceCountMode,
          styleMode,
          stylePreset,
          customStyleNote,
          additionalUserDetails,
        });

  return {
    engineId,
    placementAction,
    placementLocationNote,
    artPieceCountMode,
    styleMode,
    stylePreset,
    customStyleNote,
    additionalUserDetails,
    editablePromptText,
    isPromptManuallyEdited,
  };
}

export type StepStatus = 'pending' | 'active' | 'completed';

export function resolveAtelierCreationStepStatuses(
  stage: AiGenerationStage
): [StepStatus, StepStatus, StepStatus, StepStatus] {
  switch (stage) {
    case 'reimagining-room':
      return ['active', 'pending', 'pending', 'pending'];
    case 'sprinkling-magic':
      return ['completed', 'active', 'pending', 'pending'];
    case 'verifying-room-preservation':
      return ['completed', 'completed', 'active', 'pending'];
    case 'detecting-and-cropping-art':
    case 'generating-identical-print':
      return ['completed', 'completed', 'completed', 'active'];
    case 'completed':
      return ['completed', 'completed', 'completed', 'completed'];
    case 'idle':
    case 'error':
    default:
      return ['pending', 'pending', 'pending', 'pending'];
  }
}

export interface AtelierCreationProgressScreenProps {
  generationStage: AiGenerationStage;
  engineId?: AiEngineId;
  artPieceCountMode?: ArtPieceCountMode;
  roomAngleCount?: number;
  subtitle?: string;
}

export const AtelierCreationProgressScreen: React.FC<
  AtelierCreationProgressScreenProps
> = ({
  generationStage,
  artPieceCountMode = 'auto-multi-wall',
  roomAngleCount = 1,
  subtitle,
}) => {
  const statuses = resolveAtelierCreationStepStatuses(generationStage);
  const pieceOption =
    ART_PIECE_COUNT_OPTIONS.find((opt) => opt.id === artPieceCountMode) ??
    ART_PIECE_COUNT_OPTIONS[0];

  return (
    <section
      data-testid="atelier-creation-progress-screen"
      aria-label="Atelier Creation Experience"
      className="mx-auto max-w-3xl rounded-2xl border-2 border-[#4A3B32] bg-[#FAF6EE] p-6 sm:p-8 shadow-[0_16px_38px_rgba(31,28,24,0.08)] space-y-6"
    >
      <div className="text-center space-y-2 border-b border-[#DFD7C8] pb-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#DFD7C8] bg-[#F5F0E6] px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-[#9E5A3C]">
          <span className="h-2 w-2 rounded-full bg-[#9E5A3C] animate-pulse" />
          Step 3 · Original Atelier Commission
        </span>
        <h2 className="font-serif text-xl sm:text-2xl font-normal text-[#1F1C18]">
          Curating Bespoke Fine Art for Your Space
        </h2>
        <p className="text-xs sm:text-sm text-[#4A3B32]">
          {subtitle ??
            `Atelier Vue is harmonizing ${pieceOption.label.toLowerCase()} across ${roomAngleCount} room ${
              roomAngleCount === 1 ? 'viewpoint' : 'viewpoints'
            } while preserving every architectural detail.`}
        </p>
      </div>

      <div
        data-testid="ai-generation-progress-stepper"
        aria-label="Atelier Creation Progress Steps"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
      >
        {ATELIER_CREATION_STEPS.map((step, idx) => {
          const status = statuses[idx];
          return (
            <div
              key={step.testId}
              data-testid={step.testId}
              data-step-status={status}
              className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
                status === 'active'
                  ? 'border-[#9E5A3C] bg-[#9E5A3C]/10 ring-1 ring-[#9E5A3C] text-[#1F1C18]'
                  : status === 'completed'
                  ? 'border-emerald-700/40 bg-emerald-50/70 text-emerald-950'
                  : 'border-[#DFD7C8] bg-[#F5F0E6]/70 text-[#6E6559]'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  status === 'active'
                    ? 'bg-[#9E5A3C] text-[#FAF6EE]'
                    : status === 'completed'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-[#DFD7C8] text-[#4A3B32]'
                }`}
              >
                {status === 'completed' ? '✓' : step.stepNumber}
              </span>
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-semibold">{step.title}</div>
                <p className="text-xs leading-relaxed opacity-90">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export interface AiPromptConfiguratorProps {
  config: AiPromptConfiguration;
  onChangeConfig: (nextConfig: AiPromptConfiguration) => void;
  onSubmitReimagine: (finalConfig: AiPromptConfiguration) => void;
  generationStage: AiGenerationStage;
  hasUploadedRoom: boolean;
  errorMessage?: string | null;
  onBackToSpace?: () => void;
  onProceedToScale?: () => void;
  composePrompt?: (
    config: Omit<AiPromptConfiguration, 'editablePromptText' | 'isPromptManuallyEdited'>
  ) => string;
}

export const AiPromptConfigurator: React.FC<AiPromptConfiguratorProps> = ({
  config,
  onChangeConfig,
  onSubmitReimagine,
  generationStage = 'idle',
  hasUploadedRoom = true,
  errorMessage = null,
  onBackToSpace,
  onProceedToScale,
  composePrompt,
}) => {
  const buildPrompt = composePrompt ?? composeDefaultUiPrompt;

  const isGenerating =
    generationStage === 'reimagining-room' ||
    generationStage === 'sprinkling-magic' ||
    generationStage === 'verifying-room-preservation' ||
    generationStage === 'detecting-and-cropping-art' ||
    generationStage === 'generating-identical-print';

  const activePieceCountMode: ArtPieceCountMode =
    config.artPieceCountMode ?? 'auto-multi-wall';

  const applyStructuredConfigChange = (
    partial: Partial<Omit<AiPromptConfiguration, 'editablePromptText' | 'isPromptManuallyEdited'>>
  ) => {
    const nextCore = {
      engineId: partial.engineId ?? config.engineId,
      placementAction: partial.placementAction ?? config.placementAction,
      placementLocationNote:
        partial.placementLocationNote ?? config.placementLocationNote ?? '',
      artPieceCountMode:
        partial.artPieceCountMode ?? config.artPieceCountMode ?? 'auto-multi-wall',
      styleMode: partial.styleMode ?? config.styleMode,
      stylePreset: partial.stylePreset ?? config.stylePreset,
      customStyleNote: partial.customStyleNote ?? config.customStyleNote ?? '',
      additionalUserDetails:
        partial.additionalUserDetails ?? config.additionalUserDetails ?? '',
    };

    const nextPrompt = buildPrompt(nextCore);

    onChangeConfig({
      ...nextCore,
      editablePromptText: nextPrompt,
      isPromptManuallyEdited: Boolean(
        nextCore.additionalUserDetails.trim().length > 0 ||
          nextCore.placementLocationNote.trim().length > 0
      ),
    });
  };

  const handlePlacementSelect = (placementAction: WallPlacementAction) => {
    applyStructuredConfigChange({ placementAction });
  };

  const handlePieceCountSelect = (artPieceCountMode: ArtPieceCountMode) => {
    applyStructuredConfigChange({ artPieceCountMode });
  };

  const handlePlacementLocationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    applyStructuredConfigChange({
      placementLocationNote: event.target.value,
    });
  };

  const handlePlacementLocationPresetClick = (presetLocation: string) => {
    applyStructuredConfigChange({
      placementLocationNote: presetLocation,
    });
  };

  const handleStyleModeSelect = (styleMode: ArtStyleSelectionMode) => {
    applyStructuredConfigChange({ styleMode });
  };

  const handleStylePresetSelect = (stylePreset: CuratedArtStylePreset) => {
    applyStructuredConfigChange({
      styleMode: 'specific-style',
      stylePreset,
    });
  };

  const handleCustomStyleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    applyStructuredConfigChange({
      customStyleNote: event.target.value,
    });
  };

  const handleAdditionalDetailsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyStructuredConfigChange({
      additionalUserDetails: event.target.value,
    });
  };

  const handleDetailsMoodPresetClick = (moodPreset: string) => {
    const currentDetails = (config.additionalUserDetails ?? '').trim();
    const nextDetails =
      currentDetails.length === 0
        ? moodPreset
        : currentDetails.includes(moodPreset)
        ? currentDetails
        : `${currentDetails} · ${moodPreset}`;
    applyStructuredConfigChange({
      additionalUserDetails: nextDetails,
    });
  };

  const handleClearAdditionalDetails = () => {
    applyStructuredConfigChange({
      additionalUserDetails: '',
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasUploadedRoom || isGenerating) {
      return;
    }
    onSubmitReimagine(config);
  };

  const stepStatuses = resolveAtelierCreationStepStatuses(generationStage);
  const additionalDetailsValue = config.additionalUserDetails ?? '';
  const placementLocationValue = config.placementLocationNote ?? '';

  return (
    <section
      data-testid="ai-prompt-configurator"
      aria-label="Atelier Curation & Wall Direction Studio"
      className="rounded-2xl border-2 border-[#4A3B32] bg-[#FAF6EE] p-4 sm:p-6 shadow-[0_16px_38px_rgba(31,28,24,0.08)]"
    >
      <div className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6]/75 p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header with Back Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#DFD7C8] pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  data-testid="back-to-page-1-btn"
                  onClick={() => onBackToSpace?.()}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1.5 text-xs font-semibold text-[#4A3B32] hover:border-[#9E5A3C] hover:text-[#9E5A3C] transition-colors"
                >
                  ← Back to Room Photos
                </button>
                <span className="text-xs font-semibold uppercase tracking-widest text-[#9E5A3C]">
                  Step 2 · Shape Your Vision
                </span>
              </div>
              <h2 className="font-serif text-lg sm:text-2xl font-normal text-[#1F1C18]">
                Configure Your Space &amp; Art Direction
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3.5 py-1.5 text-xs font-medium text-[#4A3B32]">
              <span className="h-2 w-2 rounded-full bg-[#9E5A3C]" />
              <span>Atelier Bespoke Curation</span>
            </div>
          </div>

          {/* 1. Wall Art Placement & Multi-Wall Quantity ([SPEC PATCH #16, #19, #23, #26]) */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4A3B32]">
              1. Wall Art Placement &amp; Multi-Wall Quantity
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                data-testid="placement-action-add-only"
                aria-pressed={config.placementAction === 'add-only'}
                onClick={() => handlePlacementSelect('add-only')}
                className={`min-h-[48px] w-full rounded-xl border p-3.5 text-left transition-all ${
                  config.placementAction === 'add-only'
                    ? 'border-[#9E5A3C] bg-[#9E5A3C]/10 ring-1 ring-[#9E5A3C] text-[#1F1C18]'
                    : 'border-[#DFD7C8] bg-[#FAF6EE] hover:border-[#B56543] text-[#4A3B32]'
                }`}
              >
                <div className="font-semibold text-sm text-[#1F1C18]">
                  Add to Blank Wall
                </div>
                <p className="mt-1 text-xs text-[#4A3B32]">
                  Keep existing decor &amp; add art to open wall
                </p>
              </button>

              <button
                type="button"
                data-testid="placement-action-replace-existing"
                aria-pressed={config.placementAction === 'replace-existing'}
                onClick={() => handlePlacementSelect('replace-existing')}
                className={`min-h-[48px] w-full rounded-xl border p-3.5 text-left transition-all ${
                  config.placementAction === 'replace-existing'
                    ? 'border-[#9E5A3C] bg-[#9E5A3C]/10 ring-1 ring-[#9E5A3C] text-[#1F1C18]'
                    : 'border-[#DFD7C8] bg-[#FAF6EE] hover:border-[#B56543] text-[#4A3B32]'
                }`}
              >
                <div className="font-semibold text-sm text-[#1F1C18]">
                  Replace Existing Art
                </div>
                <p className="mt-1 text-xs text-[#4A3B32]">
                  Replace existing wall art with new art
                </p>
              </button>

              <button
                type="button"
                data-testid="placement-action-both"
                aria-pressed={config.placementAction === 'both'}
                onClick={() => handlePlacementSelect('both')}
                className={`min-h-[48px] w-full rounded-xl border p-3.5 text-left transition-all ${
                  config.placementAction === 'both'
                    ? 'border-[#9E5A3C] bg-[#9E5A3C]/10 ring-1 ring-[#9E5A3C] text-[#1F1C18]'
                    : 'border-[#DFD7C8] bg-[#FAF6EE] hover:border-[#B56543] text-[#4A3B32]'
                }`}
              >
                <div className="font-semibold text-sm text-[#1F1C18]">
                  Both (Add &amp; Replace)
                </div>
                <p className="mt-1 text-xs text-[#4A3B32]">
                  Replace existing art AND add art to blank wall space
                </p>
              </button>
            </div>

            {/* Multi-Piece / Multi-Wall Quantity Selector ([SPEC PATCH #19]) */}
            <div className="rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3.5 space-y-2.5">
              <span className="block text-xs font-medium text-[#4A3B32]">
                How many art pieces should we curate across your walls?
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {ART_PIECE_COUNT_OPTIONS.map((option) => {
                  const isSelected = activePieceCountMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      data-testid={option.testId}
                      aria-pressed={isSelected}
                      onClick={() => handlePieceCountSelect(option.id)}
                      className={`min-h-[48px] rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-[#9E5A3C] bg-[#9E5A3C]/10 ring-1 ring-[#9E5A3C] text-[#1F1C18]'
                          : 'border-[#DFD7C8] bg-[#F5F0E6] hover:border-[#B56543] text-[#4A3B32]'
                      }`}
                    >
                      <div className="font-semibold text-xs sm:text-sm text-[#1F1C18]">
                        {option.label}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#4A3B32]">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Expected Placement Location Input + Quick Placement Presets ([SPEC PATCH #16, #26]) */}
            <div className="rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3.5 space-y-2.5">
              <div>
                <label
                  htmlFor="placement-location-input"
                  className="block text-xs font-medium text-[#4A3B32] mb-1.5"
                >
                  Where should the art be placed? (Optional)
                </label>
                <input
                  id="placement-location-input"
                  type="text"
                  data-testid="placement-location-input"
                  value={placementLocationValue}
                  onChange={handlePlacementLocationChange}
                  placeholder="e.g., Centered above the sofa, on the blank wall between the windows, replacing the frame over the console..."
                  className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-[#F5F0E6] px-3.5 py-2 text-base text-[#1F1C18] placeholder:text-[#78716C] focus:border-[#9E5A3C] focus:outline-none focus:ring-1 focus:ring-[#9E5A3C]"
                />
              </div>

              <div
                data-testid="placement-location-presets"
                className="flex flex-wrap items-center gap-2 pt-0.5"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6559] mr-1">
                  Quick Wall Zones:
                </span>
                {WALL_PLACEMENT_LOCATION_PRESETS.map((presetText, idx) => {
                  const isActiveChip = placementLocationValue === presetText;
                  return (
                    <button
                      key={presetText}
                      type="button"
                      data-testid={`placement-preset-chip-${idx}`}
                      aria-pressed={isActiveChip}
                      onClick={() => handlePlacementLocationPresetClick(presetText)}
                      className={`min-h-[44px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        isActiveChip
                          ? 'border-[#9E5A3C] bg-[#9E5A3C] text-[#FAF6EE]'
                          : 'border-[#DFD7C8] bg-[#F5F0E6] text-[#4A3B32] hover:border-[#9E5A3C]/60'
                      }`}
                    >
                      {presetText}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Art Style & Medium Direction — 16 Fine-Art Style Presets ([SPEC PATCH #23, #26]) */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4A3B32]">
              2. Art Style &amp; Medium Direction
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="style-mode-ai-curated"
                aria-pressed={config.styleMode === 'ai-curated'}
                onClick={() => handleStyleModeSelect('ai-curated')}
                className={`min-h-[48px] w-full rounded-xl border p-3.5 text-left transition-all ${
                  config.styleMode === 'ai-curated'
                    ? 'border-[#9E5A3C] bg-[#9E5A3C]/10 ring-1 ring-[#9E5A3C] text-[#1F1C18]'
                    : 'border-[#DFD7C8] bg-[#FAF6EE] hover:border-[#B56543] text-[#4A3B32]'
                }`}
              >
                <div className="font-semibold text-sm text-[#1F1C18]">
                  AI Curated Style (Auto-Fit Room)
                </div>
                <p className="mt-1 text-xs text-[#4A3B32]">
                  Automatically analyzes your space&apos;s palette and lighting to choose the ideal movement.
                </p>
              </button>

              <button
                type="button"
                data-testid="style-mode-specific-style"
                aria-pressed={config.styleMode === 'specific-style'}
                onClick={() => handleStyleModeSelect('specific-style')}
                className={`min-h-[48px] w-full rounded-xl border p-3.5 text-left transition-all ${
                  config.styleMode === 'specific-style'
                    ? 'border-[#9E5A3C] bg-[#9E5A3C]/10 ring-1 ring-[#9E5A3C] text-[#1F1C18]'
                    : 'border-[#DFD7C8] bg-[#FAF6EE] hover:border-[#B56543] text-[#4A3B32]'
                }`}
              >
                <div className="font-semibold text-sm text-[#1F1C18]">
                  Specific Art Style (16 Studio Movements)
                </div>
                <p className="mt-1 text-xs text-[#4A3B32]">
                  Choose from 16 curated fine-art movement presets or add your own custom curatorial note below.
                </p>
              </button>
            </div>

            {/* 16 Style Preset Cards/Pills */}
            <div className="rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#4A3B32]">
                  Curated Style Presets (16 Fine-Art Movements — click any style to apply):
                </span>
                {config.styleMode === 'specific-style' && (
                  <span className="text-xs font-semibold text-[#9E5A3C]">
                    Active:{' '}
                    {CURATED_STYLE_PRESETS.find((p) => p.id === config.stylePreset)?.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {CURATED_STYLE_PRESETS.map((preset) => {
                  const isPresetActive =
                    config.styleMode === 'specific-style' && config.stylePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`style-preset-${preset.id}`}
                      aria-pressed={isPresetActive}
                      title={preset.description}
                      onClick={() => handleStylePresetSelect(preset.id)}
                      className={`min-h-[48px] rounded-xl border px-3 py-2 text-left transition-all ${
                        isPresetActive
                          ? 'border-[#9E5A3C] bg-[#9E5A3C] text-[#FAF6EE] shadow-sm'
                          : 'border-[#DFD7C8] bg-[#F5F0E6] text-[#1F1C18] hover:border-[#9E5A3C]/60'
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-semibold">
                        {preset.label}
                      </div>
                      <p
                        className={`mt-0.5 text-[11px] leading-snug ${
                          isPresetActive ? 'text-[#FAF6EE]/90' : 'text-[#6E6559]'
                        }`}
                      >
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Custom Style Input */}
              <div className="pt-1">
                <label
                  htmlFor="custom-style-input"
                  className="block text-xs font-medium text-[#4A3B32] mb-1.5"
                >
                  Optional Custom Style Note (palette, artist inspiration, brushwork):
                </label>
                <input
                  id="custom-style-input"
                  type="text"
                  data-testid="custom-style-input"
                  value={config.customStyleNote}
                  onChange={handleCustomStyleInputChange}
                  placeholder="e.g., Warm terracotta and sage palette, heavy linen texture, subtle gold leaf..."
                  className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-[#F5F0E6] px-3.5 py-2 text-base text-[#1F1C18] placeholder:text-[#78716C] focus:border-[#9E5A3C] focus:outline-none focus:ring-1 focus:ring-[#9E5A3C]"
                />
              </div>
            </div>
          </div>

          {/* 3. Describe What You're Looking For & Additional Details + Mood Presets ([SPEC PATCH #14, #23, #24, #26]) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="additional-user-details-input"
                className="text-xs font-semibold uppercase tracking-wider text-[#4A3B32]"
              >
                3. Describe What You&apos;re Looking For &amp; Additional Details (Optional)
              </label>
              {additionalDetailsValue.length > 0 && (
                <button
                  type="button"
                  data-testid="clear-additional-details-btn"
                  onClick={handleClearAdditionalDetails}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1.5 text-xs font-medium text-[#4A3B32] hover:border-[#9E5A3C] hover:text-[#9E5A3C] transition-colors"
                >
                  Clear Additional Details
                </button>
              )}
            </div>
            <textarea
              id="additional-user-details-input"
              data-testid="additional-user-details-input"
              rows={3}
              value={additionalDetailsValue}
              onChange={handleAdditionalDetailsChange}
              placeholder="Describe any specific colors, subject matter, mood, texture, or details you want in the artwork..."
              className="w-full rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3.5 text-base leading-relaxed text-[#1F1C18] placeholder:text-[#78716C] focus:border-[#9E5A3C] focus:outline-none focus:ring-1 focus:ring-[#9E5A3C]"
            />

            {/* Quick Palette & Mood Presets ([SPEC PATCH #26]) */}
            <div
              data-testid="additional-details-presets"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6559] mr-1">
                Quick Palette &amp; Mood Chips:
              </span>
              {ADDITIONAL_DETAILS_MOOD_PRESETS.map((moodText, idx) => {
                const isSelectedMood = additionalDetailsValue.includes(moodText);
                return (
                  <button
                    key={moodText}
                    type="button"
                    data-testid={`details-preset-chip-${idx}`}
                    aria-pressed={isSelectedMood}
                    onClick={() => handleDetailsMoodPresetClick(moodText)}
                    className={`min-h-[44px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelectedMood
                        ? 'border-[#9E5A3C] bg-[#9E5A3C] text-[#FAF6EE]'
                        : 'border-[#DFD7C8] bg-[#F5F0E6] text-[#4A3B32] hover:border-[#9E5A3C]/60'
                    }`}
                  >
                    + {moodText}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[#6E6559]">
              Pre-existing furniture and room dimensions are strictly preserved automatically across every viewpoint.
            </p>
          </div>

          {/* Optional Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              data-testid="ai-prompt-error-banner"
              className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm text-red-900"
            >
              {errorMessage}
            </div>
          )}

          {/* Action Row: Single Direct Create CTA (Size Calibration Window is triggered post-visualization on Page 4) */}
          <div className="space-y-4 pt-1">
            <div>
              <button
                type="submit"
                data-testid="reimagine-room-submit-btn"
                disabled={!hasUploadedRoom || isGenerating}
                className={`min-h-[48px] w-full rounded-xl px-6 py-3.5 text-sm sm:text-base font-semibold transition-all shadow-sm ${
                  !hasUploadedRoom || isGenerating
                    ? 'cursor-not-allowed bg-[#DFD7C8] text-[#78716C]'
                    : 'bg-[#9E5A3C] text-[#FAF6EE] hover:bg-[#874B30] cursor-pointer'
                }`}
              >
                {isGenerating
                  ? 'Curating Your Space...'
                  : 'Create Art Piece(s) for My Space →'}
              </button>
            </div>

            {/* 4-Step Secret-Preserving Atelier Creation Stepper ([SPEC PATCH #18]) */}
            <div
              data-testid="ai-generation-progress-stepper"
              aria-label="Atelier Creation Experience Steps"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3"
            >
              {ATELIER_CREATION_STEPS.map((step, idx) => {
                const status = stepStatuses[idx];
                return (
                  <div
                    key={step.testId}
                    data-testid={step.testId}
                    data-step-status={status}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-all ${
                      status === 'active'
                        ? 'border-[#9E5A3C] bg-[#9E5A3C]/10 font-semibold text-[#1F1C18]'
                        : status === 'completed'
                        ? 'border-emerald-700/40 bg-emerald-50/70 font-medium text-emerald-950'
                        : 'border-transparent bg-[#F5F0E6] text-[#6E6559]'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        status === 'active'
                          ? 'bg-[#9E5A3C] text-[#FAF6EE]'
                          : status === 'completed'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-[#DFD7C8] text-[#4A3B32]'
                      }`}
                    >
                      {status === 'completed' ? '✓' : step.stepNumber}
                    </span>
                    <div className="space-y-0.5">
                      <div>{step.title}</div>
                      <p className="text-[11px] font-normal leading-snug opacity-85">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};

export default AiPromptConfigurator;
