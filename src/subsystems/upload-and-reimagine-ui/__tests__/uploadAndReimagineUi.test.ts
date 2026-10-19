// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiGenerationStage,
  AiPromptConfiguration,
  CuratedArtStylePreset,
  ReimaginedRoomVariation,
  RoomAngleAsset,
  ScaleCalibrationQuestion,
} from '../../../contracts/masterContract';
import {
  ADDITIONAL_DETAILS_MOOD_PRESETS,
  AiPromptConfigurator,
  ART_PIECE_COUNT_OPTIONS,
  ART_STYLE_PRESET_OPTIONS,
  ATELIER_CREATION_STEPS,
  AtelierCreationProgressScreen,
  composeDefaultUiPrompt,
  computeFallbackScaleRecommendation,
  createInitialPromptConfiguration,
  CURATED_STYLE_PRESETS,
  DEFAULT_SCALE_CALIBRATION_QUESTIONS,
  ReimaginedVariationsStrip,
  SAMPLE_ROOM_PHOTOS,
  ScaleCalibrationPage,
  UploadHeroStage,
  WALL_PLACEMENT_LOCATION_PRESETS,
} from '../index';

// Enable React act() environment flag for JSDOM
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const FORBIDDEN_SECRET_TERMS = [
  'screenshot',
  'crop',
  '2nd-prompt',
  'bounding box',
  'bbox',
  'prompt',
];

const FORBIDDEN_MODEL_TERMS = [
  'astra',
  'gemini',
  'argon',
  'gpt-6',
  'nano banana',
  'openrouter',
];

function assertNoSecretOrModelTermsInVisibleDom(element: HTMLElement): void {
  const visibleText = (element.textContent ?? '').toLowerCase();
  for (const term of FORBIDDEN_SECRET_TERMS) {
    expect(visibleText).not.toContain(term);
  }
  for (const modelTerm of FORBIDDEN_MODEL_TERMS) {
    expect(visibleText).not.toContain(modelTerm);
  }
}

function triggerTextInputChange(
  element: HTMLInputElement | HTMLTextAreaElement,
  nextValue: string
): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor?.set) {
    descriptor.set.call(element, nextValue);
  } else {
    element.value = nextValue;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Subsystem 2 (V2.4): upload-and-reimagine-ui', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('1. UploadHeroStage Option 5 Wabi-Sabi Easel, Non-Photo Description Path & Dedicated Add-Angle Upload/Camera Screen ([SPEC PATCH #21, #24, #25])', () => {
    it('renders the Option 5 Wabi-Sabi easel dropzone, "+ Place Your Space Photograph on the Easel" button, camera button, museum placard footer, and non-photo-describe-section with zero preset sample-room grid buttons', () => {
      const onSelectRoomPhoto = vi.fn();

      act(() => {
        root.render(
          React.createElement(UploadHeroStage, {
            uploadedRoomDataUrl: null,
            onSelectRoomPhoto,
          })
        );
      });

      const fileInput = container.querySelector(
        '[data-testid="upload-room-file-input"]'
      ) as HTMLInputElement;
      const addAngleInput = container.querySelector(
        '[data-testid="add-room-angle-file-input"]'
      ) as HTMLInputElement;
      const dropzone = container.querySelector('[data-testid="upload-room-dropzone"]');
      const uploadBtn = container.querySelector('[data-testid="upload-room-file-btn"]');
      const cameraBtn = container.querySelector('[data-testid="take-room-photo-btn"]');
      const nonPhotoSection = container.querySelector(
        '[data-testid="non-photo-describe-section"]'
      );
      const describeInput = container.querySelector(
        '[data-testid="describe-without-photo-input"]'
      );
      const proceedBtn = container.querySelector(
        '[data-testid="proceed-by-describing-btn"]'
      );

      expect(fileInput).not.toBeNull();
      expect(fileInput.multiple).toBe(true);
      expect(addAngleInput).not.toBeNull();
      expect(addAngleInput.multiple).toBe(true);
      expect(dropzone).not.toBeNull();
      expect(container.textContent).toContain(
        'Begin Your Custom Art Commission — Share Your Space'
      );
      expect(uploadBtn).not.toBeNull();
      expect(uploadBtn?.textContent).toContain(
        '+ Place Your Space Photograph on the Easel'
      );
      expect(cameraBtn).not.toBeNull();
      expect(cameraBtn?.textContent).toContain('Take Photo with Camera');

      // Non-photo description path replaces preset sample-room buttons ([SPEC PATCH #24])
      expect(nonPhotoSection).not.toBeNull();
      expect(describeInput).not.toBeNull();
      expect(proceedBtn).not.toBeNull();
      expect(proceedBtn?.textContent).toContain(
        "Proceed by Describing What You're Looking For →"
      );
      expect(container.querySelector('[data-testid^="sample-room-btn-"]')).toBeNull();

      // Wabi-Sabi museum placard footer ([SPEC PATCH #21])
      expect(container.textContent).toContain("✦ Tailored to Your Space's Palette");
      expect(SAMPLE_ROOM_PHOTOS).toHaveLength(3);

      expect(container.querySelectorAll('a[href]').length).toBe(0);
      assertNoSecretOrModelTermsInVisibleDom(container);
    });

    it('invokes onProceedWithDescription, prepares default "Custom Described Space" canvas via onSelectRoomPhoto, and calls onContinueToCuration when clicking proceed-by-describing-btn ([SPEC PATCH #24])', () => {
      const onSelectRoomPhoto = vi.fn();
      const onProceedWithDescription = vi.fn();
      const onContinueToCuration = vi.fn();

      act(() => {
        root.render(
          React.createElement(UploadHeroStage, {
            uploadedRoomDataUrl: null,
            onSelectRoomPhoto,
            onProceedWithDescription,
            onContinueToCuration,
          })
        );
      });

      const describeInput = container.querySelector(
        '[data-testid="describe-without-photo-input"]'
      ) as HTMLTextAreaElement;
      const proceedBtn = container.querySelector(
        '[data-testid="proceed-by-describing-btn"]'
      ) as HTMLButtonElement;

      act(() => {
        triggerTextInputChange(
          describeInput,
          'Warm wabi-sabi plaster and raw ochre horizontal relief for a sunlit minimalist living space'
        );
      });

      act(() => {
        proceedBtn.click();
      });

      expect(onProceedWithDescription).toHaveBeenCalledWith(
        'Warm wabi-sabi plaster and raw ochre horizontal relief for a sunlit minimalist living space'
      );
      expect(onSelectRoomPhoto).toHaveBeenCalledWith(
        expect.stringContaining('data:image/svg+xml'),
        'Custom Described Space',
        false,
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Custom Described Space',
            hasExistingWallArt: false,
          }),
        ])
      );
      expect(onContinueToCuration).toHaveBeenCalledTimes(1);
    });

    it('opens the Dedicated Add-Angle Upload & Camera Screen ([SPEC PATCH #25]) when clicking add-room-angle-btn, and appends Angle 2 via file upload or camera capture without overwriting Angle 1', async () => {
      const onSelectRoomPhoto = vi.fn();
      const onUpdateRoomAngles = vi.fn();
      const onAddRoomAngle = vi.fn();
      const onRemoveRoomAngle = vi.fn();
      const onContinueToCuration = vi.fn();

      function MultiAngleHarness() {
        const [primaryUrl, setPrimaryUrl] = useState<string | null>(
          SAMPLE_ROOM_PHOTOS[0].dataUrl
        );
        const [angles, setAngles] = useState<RoomAngleAsset[]>([
          {
            id: 'angle-1',
            label: 'Sunlit Living Room',
            dataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
            hasExistingWallArt: false,
          },
        ]);

        return React.createElement(UploadHeroStage, {
          uploadedRoomDataUrl: primaryUrl,
          uploadedRoomTitle: 'Sunlit Living Room',
          roomAngles: angles,
          onSelectRoomPhoto: (url, title, hint, nextAngles) => {
            setPrimaryUrl(url);
            if (nextAngles) {
              setAngles(nextAngles);
            }
            onSelectRoomPhoto(url, title, hint, nextAngles);
          },
          onUpdateRoomAngles: (nextAngles) => {
            setAngles(nextAngles);
            onUpdateRoomAngles(nextAngles);
          },
          onAddRoomAngle,
          onRemoveRoomAngle,
          onContinueToCuration,
          onClearRoomPhoto: () => {
            setPrimaryUrl(null);
            setAngles([]);
          },
        });
      }

      act(() => {
        root.render(React.createElement(MultiAngleHarness));
      });

      const gallery = container.querySelector(
        '[data-testid="uploaded-room-angles-gallery"]'
      );
      const angleCard0 = container.querySelector('[data-testid="room-angle-card-0"]');
      const addRoomAngleBtn = container.querySelector(
        '[data-testid="add-room-angle-btn"]'
      ) as HTMLButtonElement;
      const continueToCurationBtn = container.querySelector(
        '[data-testid="goto-page-2-curation-btn"]'
      ) as HTMLButtonElement;

      expect(gallery).not.toBeNull();
      expect(angleCard0).not.toBeNull();
      expect(angleCard0?.textContent).toContain('Angle 1 (Primary View)');
      expect(addRoomAngleBtn).not.toBeNull();
      expect(addRoomAngleBtn.textContent).toContain('+ Add Another Angle / Viewpoint');
      expect(continueToCurationBtn).not.toBeNull();

      // Clicking "+ Add Another Angle / Viewpoint" opens add-angle-upload-screen ([SPEC PATCH #25])
      act(() => {
        addRoomAngleBtn.click();
      });

      const addAngleScreen = container.querySelector(
        '[data-testid="add-angle-upload-screen"]'
      );
      const newAngleLabelInput = container.querySelector(
        '[data-testid="new-angle-label-input"]'
      ) as HTMLInputElement;
      const addAngleUploadFileBtn = container.querySelector(
        '[data-testid="add-angle-upload-file-btn"]'
      ) as HTMLButtonElement;
      const addAngleUseCameraBtn = container.querySelector(
        '[data-testid="add-angle-use-camera-btn"]'
      ) as HTMLButtonElement;
      const closeAddAngleScreenBtn = container.querySelector(
        '[data-testid="close-add-angle-screen-btn"]'
      ) as HTMLButtonElement;

      expect(addAngleScreen).not.toBeNull();
      expect(newAngleLabelInput).not.toBeNull();
      expect(addAngleUploadFileBtn).not.toBeNull();
      expect(addAngleUseCameraBtn).not.toBeNull();
      expect(closeAddAngleScreenBtn).not.toBeNull();
      assertNoSecretOrModelTermsInVisibleDom(container);

      // Customize Angle 2 label and upload via add-room-angle-file-input
      act(() => {
        triggerTextInputChange(newAngleLabelInput, 'Angle 2 (East Window Perspective)');
      });

      const addAngleInput = container.querySelector(
        '[data-testid="add-room-angle-file-input"]'
      ) as HTMLInputElement;
      const mockFile = new File(['svg'], 'east-window-wall.png', { type: 'image/png' });
      Object.defineProperty(addAngleInput, 'files', {
        value: [mockFile],
        configurable: true,
      });

      act(() => {
        addAngleInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Add-angle screen closes and Angle 2 is appended while Angle 1 remains intact
      expect(container.querySelector('[data-testid="add-angle-upload-screen"]')).toBeNull();
      expect(onAddRoomAngle).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Angle 2 (East Window Perspective)',
        })
      );
      expect(container.querySelector('[data-testid="room-angle-card-0"]')).not.toBeNull();
      const angleCard1 = container.querySelector('[data-testid="room-angle-card-1"]');
      expect(angleCard1).not.toBeNull();
      expect(angleCard1?.textContent).toContain('Angle 2 (East Window Perspective)');

      // Remove Angle 2 and verify adding Angle 2 via Camera from add-angle-upload-screen
      const removeAngle1Btn = container.querySelector(
        '[data-testid="remove-room-angle-btn-1"]'
      ) as HTMLButtonElement;
      act(() => {
        removeAngle1Btn.click();
      });
      expect(container.querySelector('[data-testid="room-angle-card-1"]')).toBeNull();

      // Re-open add-angle-upload-screen and use camera
      act(() => {
        addRoomAngleBtn.click();
      });
      const cameraBtnInAddAngle = container.querySelector(
        '[data-testid="add-angle-use-camera-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        cameraBtnInAddAngle.click();
      });

      const cameraModal = container.querySelector('[data-testid="camera-capture-modal"]');
      expect(cameraModal).not.toBeNull();
      const shutterBtn = container.querySelector(
        '[data-testid="camera-shutter-btn"]'
      ) as HTMLButtonElement;
      act(() => {
        shutterBtn.click();
      });

      expect(container.querySelector('[data-testid="camera-capture-modal"]')).toBeNull();
      expect(container.querySelector('[data-testid="add-angle-upload-screen"]')).toBeNull();
      expect(container.querySelector('[data-testid="room-angle-card-0"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="room-angle-card-1"]')).not.toBeNull();
      assertNoSecretOrModelTermsInVisibleDom(container);
    });

    it('opens the camera modal when clicking Take Photo with Camera and captures a photo when clicking the shutter button', async () => {
      const onSelectRoomPhoto = vi.fn();

      act(() => {
        root.render(
          React.createElement(UploadHeroStage, {
            uploadedRoomDataUrl: null,
            onSelectRoomPhoto,
          })
        );
      });

      const cameraBtn = container.querySelector(
        '[data-testid="take-room-photo-btn"]'
      ) as HTMLButtonElement;

      await act(async () => {
        cameraBtn.click();
      });

      const cameraModal = container.querySelector('[data-testid="camera-capture-modal"]');
      expect(cameraModal).not.toBeNull();

      const shutterBtn = container.querySelector(
        '[data-testid="camera-shutter-btn"]'
      ) as HTMLButtonElement;
      expect(shutterBtn).not.toBeNull();

      act(() => {
        shutterBtn.click();
      });

      expect(onSelectRoomPhoto).toHaveBeenCalledWith(
        expect.stringContaining('data:image/svg+xml'),
        'Camera Captured Room',
        false,
        expect.any(Array)
      );
      expect(container.querySelector('[data-testid="camera-capture-modal"]')).toBeNull();
    });
  });

  describe('2. AiPromptConfigurator & AtelierCreationProgressScreen — 16 Fine-Art Style Presets, Placement/Mood Preset Chips & Page 3 Scale Navigation CTA ([SPEC PATCH #14, #16, #18, #19, #23, #26])', () => {
    function StatefulConfiguratorHarness(props: {
      initialStage?: AiGenerationStage;
      onSubmit?: (config: AiPromptConfiguration) => void;
      onBackToSpace?: () => void;
      onProceedToScale?: () => void;
      onConfigSpy?: (config: AiPromptConfiguration) => void;
    }) {
      const [config, setConfig] = useState<AiPromptConfiguration>(() =>
        createInitialPromptConfiguration()
      );
      const handleUpdate = (next: AiPromptConfiguration) => {
        setConfig(next);
        props.onConfigSpy?.(next);
      };
      return React.createElement(AiPromptConfigurator, {
        config,
        onChangeConfig: handleUpdate,
        onSubmitReimagine: props.onSubmit ?? vi.fn(),
        onBackToSpace: props.onBackToSpace,
        onProceedToScale: props.onProceedToScale,
        generationStage: props.initialStage ?? 'idle',
        hasUploadedRoom: true,
      });
    }

    it('renders back-to-page-1-btn ("← Back to Room Photos"), goto-page-3-scale-btn ("Next: Scale & Room Measurements (Optional) →"), renumbers sections 1-2-3 cleanly, and exposes zero AI model selectors or model names in the DOM ([SPEC PATCH #23, #26])', () => {
      const onBackToSpace = vi.fn();
      const onProceedToScale = vi.fn();

      act(() => {
        root.render(
          React.createElement(StatefulConfiguratorHarness, {
            onBackToSpace,
            onProceedToScale,
          })
        );
      });

      const backBtn = container.querySelector(
        '[data-testid="back-to-page-1-btn"]'
      ) as HTMLButtonElement;
      expect(backBtn).not.toBeNull();
      expect(backBtn.textContent).toContain('← Back to Room Photos');

      act(() => {
        backBtn.click();
      });
      expect(onBackToSpace).toHaveBeenCalledTimes(1);

      // Size calibration window is only triggered at one point in the workflow (after art visualization on Page 4),
      // so there is no pre-visualization goto-page-3-scale-btn on Page 2
      expect(
        container.querySelector('[data-testid="goto-page-3-scale-btn"]')
      ).toBeNull();

      const submitBtn = container.querySelector(
        '[data-testid="reimagine-room-submit-btn"]'
      ) as HTMLButtonElement;
      expect(submitBtn).not.toBeNull();
      expect(submitBtn.textContent).toContain('Create Art Piece(s) for My Space →');

      // Strictly zero AI engine selector buttons in DOM ([SPEC PATCH #23])
      expect(container.querySelector('[data-testid^="engine-selector-"]')).toBeNull();
      expect(
        container.querySelector('[data-testid="editable-ai-prompt-textarea"]')
      ).toBeNull();

      // Verify clean 1-2-3 section numbering
      expect(container.textContent).toContain(
        '1. Wall Art Placement & Multi-Wall Quantity'
      );
      expect(container.textContent).toContain('2. Art Style & Medium Direction');
      expect(container.textContent).toContain(
        "3. Describe What You're Looking For & Additional Details"
      );

      assertNoSecretOrModelTermsInVisibleDom(container);
    });

    it('renders all 3 Wall Art Placement buttons, all 4 Art Piece Count / Multi-Wall buttons ([SPEC PATCH #19]), placement location input, and Quick Wall Placement Preset chips ([SPEC PATCH #16, #26])', () => {
      let latestConfig = createInitialPromptConfiguration();

      act(() => {
        root.render(
          React.createElement(StatefulConfiguratorHarness, {
            onConfigSpy: (cfg) => {
              latestConfig = cfg;
            },
          })
        );
      });

      const addOnlyBtn = container.querySelector(
        '[data-testid="placement-action-add-only"]'
      ) as HTMLButtonElement;
      const replaceBtn = container.querySelector(
        '[data-testid="placement-action-replace-existing"]'
      ) as HTMLButtonElement;
      const bothBtn = container.querySelector(
        '[data-testid="placement-action-both"]'
      ) as HTMLButtonElement;
      const locationInput = container.querySelector(
        '[data-testid="placement-location-input"]'
      ) as HTMLInputElement;
      const placementPresetsContainer = container.querySelector(
        '[data-testid="placement-location-presets"]'
      );

      expect(addOnlyBtn).not.toBeNull();
      expect(replaceBtn).not.toBeNull();
      expect(bothBtn).not.toBeNull();
      expect(locationInput).not.toBeNull();
      expect(placementPresetsContainer).not.toBeNull();
      expect(WALL_PLACEMENT_LOCATION_PRESETS).toHaveLength(6);

      // Test clicking each placement preset chip (placement-preset-chip-0..5)
      WALL_PLACEMENT_LOCATION_PRESETS.forEach((presetText, idx) => {
        const chip = container.querySelector(
          `[data-testid="placement-preset-chip-${idx}"]`
        ) as HTMLButtonElement;
        expect(chip).not.toBeNull();
        expect(chip.textContent).toContain(presetText);

        act(() => {
          chip.click();
        });
        expect(latestConfig.placementLocationNote).toBe(presetText);
        expect(chip.getAttribute('aria-pressed')).toBe('true');
      });

      expect(ART_PIECE_COUNT_OPTIONS).toHaveLength(4);
      const singlePieceBtn = container.querySelector(
        '[data-testid="piece-count-single-piece"]'
      ) as HTMLButtonElement;
      const pairBtn = container.querySelector(
        '[data-testid="piece-count-multi-piece-pair"]'
      ) as HTMLButtonElement;
      const trioBtn = container.querySelector(
        '[data-testid="piece-count-multi-piece-trio"]'
      ) as HTMLButtonElement;

      act(() => {
        singlePieceBtn.click();
      });
      expect(latestConfig.artPieceCountMode).toBe('single-piece');

      act(() => {
        pairBtn.click();
      });
      expect(latestConfig.artPieceCountMode).toBe('multi-piece-pair');

      act(() => {
        trioBtn.click();
      });
      expect(latestConfig.artPieceCountMode).toBe('multi-piece-trio');

      act(() => {
        replaceBtn.click();
      });
      expect(latestConfig.placementAction).toBe('replace-existing');

      act(() => {
        bothBtn.click();
      });
      expect(latestConfig.placementAction).toBe('both');
    });

    it('renders all 16 Fine-Art Style Presets ([SPEC PATCH #26]) and updates styleMode and stylePreset when clicked', () => {
      let latestConfig = createInitialPromptConfiguration();

      act(() => {
        root.render(
          React.createElement(StatefulConfiguratorHarness, {
            onConfigSpy: (cfg) => {
              latestConfig = cfg;
            },
          })
        );
      });

      const aiCuratedBtn = container.querySelector(
        '[data-testid="style-mode-ai-curated"]'
      ) as HTMLButtonElement;
      const specificStyleBtn = container.querySelector(
        '[data-testid="style-mode-specific-style"]'
      ) as HTMLButtonElement;
      const customInput = container.querySelector(
        '[data-testid="custom-style-input"]'
      ) as HTMLInputElement;

      expect(aiCuratedBtn).not.toBeNull();
      expect(specificStyleBtn).not.toBeNull();
      expect(customInput).not.toBeNull();
      expect(CURATED_STYLE_PRESETS).toHaveLength(16);
      expect(ART_STYLE_PRESET_OPTIONS).toHaveLength(16);

      const expectedPresetIds: CuratedArtStylePreset[] = [
        'impasto-oil',
        'wabi-sabi-plaster',
        'minimalist-abstract',
        'warm-midcentury',
        'impressionist-landscape',
        'bauhaus-geometric',
        'botanical-ink',
        'rothko-colorfield',
        'nordic-monochrome',
        'mediterranean-fresco',
        'contemporary-figurative',
        'japanese-woodblock',
        'sculptural-paper-relief',
        'abstract-expressionist',
        'classical-still-life',
        'desert-earth-strata',
      ];

      for (const presetId of expectedPresetIds) {
        const pill = container.querySelector(
          `[data-testid="style-preset-${presetId}"]`
        ) as HTMLButtonElement;
        expect(pill).not.toBeNull();

        act(() => {
          pill.click();
        });

        expect(specificStyleBtn.getAttribute('aria-pressed')).toBe('true');
        expect(pill.getAttribute('aria-pressed')).toBe('true');
        expect(latestConfig.stylePreset).toBe(presetId);
        const presetLabel = ART_STYLE_PRESET_OPTIONS.find((p) => p.id === presetId)!.label;
        expect(latestConfig.editablePromptText).toContain(presetLabel);
      }

      act(() => {
        triggerTextInputChange(customInput, 'Terracotta and raw sienna linen wash');
      });

      expect(latestConfig.customStyleNote).toBe('Terracotta and raw sienna linen wash');
      expect(latestConfig.editablePromptText).toContain(
        'Terracotta and raw sienna linen wash'
      );
      assertNoSecretOrModelTermsInVisibleDom(container);
    });

    it('renders "3. Describe What You\'re Looking For & Additional Details (Optional)" textarea and Quick Palette & Mood Presets (details-preset-chip-0..5) ([SPEC PATCH #14, #23, #26])', () => {
      let latestConfig = createInitialPromptConfiguration();

      act(() => {
        root.render(
          React.createElement(StatefulConfiguratorHarness, {
            onConfigSpy: (cfg) => {
              latestConfig = cfg;
            },
          })
        );
      });

      const detailsTextarea = container.querySelector(
        '[data-testid="additional-user-details-input"]'
      ) as HTMLTextAreaElement;
      const detailsPresetsContainer = container.querySelector(
        '[data-testid="additional-details-presets"]'
      );

      expect(detailsTextarea).not.toBeNull();
      expect(detailsPresetsContainer).not.toBeNull();
      expect(ADDITIONAL_DETAILS_MOOD_PRESETS).toHaveLength(6);

      // Click mood preset chips 0 and 1
      const chip0 = container.querySelector(
        '[data-testid="details-preset-chip-0"]'
      ) as HTMLButtonElement;
      const chip1 = container.querySelector(
        '[data-testid="details-preset-chip-1"]'
      ) as HTMLButtonElement;
      expect(chip0).not.toBeNull();
      expect(chip1).not.toBeNull();

      act(() => {
        chip0.click();
      });
      expect(latestConfig.additionalUserDetails).toContain(
        ADDITIONAL_DETAILS_MOOD_PRESETS[0]
      );
      expect(chip0.getAttribute('aria-pressed')).toBe('true');

      act(() => {
        chip1.click();
      });
      expect(latestConfig.additionalUserDetails).toContain(
        ADDITIONAL_DETAILS_MOOD_PRESETS[1]
      );

      const clearBtn = container.querySelector(
        '[data-testid="clear-additional-details-btn"]'
      ) as HTMLButtonElement;
      expect(clearBtn).not.toBeNull();

      act(() => {
        clearBtn.click();
      });

      expect(latestConfig.additionalUserDetails).toBe('');
      expect(detailsTextarea.value).toBe('');
      expect(latestConfig.editablePromptText).toBe(
        composeDefaultUiPrompt({
          engineId: latestConfig.engineId,
          placementAction: latestConfig.placementAction,
          placementLocationNote: latestConfig.placementLocationNote,
          artPieceCountMode: latestConfig.artPieceCountMode,
          styleMode: latestConfig.styleMode,
          stylePreset: latestConfig.stylePreset,
          customStyleNote: latestConfig.customStyleNote,
          additionalUserDetails: '',
        })
      );
    });

    it('renders the 4 Secret-Preserving Poetic Atelier Creation Steps (creation-step-1..4) in both AiPromptConfigurator and AtelierCreationProgressScreen with zero AI model names ([SPEC PATCH #18, #23])', () => {
      const onSubmitReimagine = vi.fn();
      const baseConfig = createInitialPromptConfiguration();

      expect(ATELIER_CREATION_STEPS).toHaveLength(4);
      expect(ATELIER_CREATION_STEPS[0].title).toBe('1. Absorbing the Room & Layout');
      expect(ATELIER_CREATION_STEPS[1].title).toBe('2. Sprinkling On Atelier Vue Magic');
      expect(ATELIER_CREATION_STEPS[2].title).toBe(
        '3. Harmonizing Spatial Balance & Room Fidelity'
      );
      expect(ATELIER_CREATION_STEPS[3].title).toBe('4. Finalizing the Art Piece(s)');

      const stages: Array<{
        stage: AiGenerationStage;
        expected: [string, string, string, string];
      }> = [
        {
          stage: 'reimagining-room',
          expected: ['active', 'pending', 'pending', 'pending'],
        },
        {
          stage: 'sprinkling-magic',
          expected: ['completed', 'active', 'pending', 'pending'],
        },
        {
          stage: 'verifying-room-preservation',
          expected: ['completed', 'completed', 'active', 'pending'],
        },
        {
          stage: 'detecting-and-cropping-art',
          expected: ['completed', 'completed', 'completed', 'active'],
        },
        {
          stage: 'generating-identical-print',
          expected: ['completed', 'completed', 'completed', 'active'],
        },
        {
          stage: 'completed',
          expected: ['completed', 'completed', 'completed', 'completed'],
        },
      ];

      for (const item of stages) {
        act(() => {
          root.render(
            React.createElement(AiPromptConfigurator, {
              config: baseConfig,
              onChangeConfig: vi.fn(),
              onSubmitReimagine,
              generationStage: item.stage,
              hasUploadedRoom: true,
            })
          );
        });

        const step1 = container.querySelector('[data-testid="creation-step-1"]');
        const step2 = container.querySelector('[data-testid="creation-step-2"]');
        const step3 = container.querySelector('[data-testid="creation-step-3"]');
        const step4 = container.querySelector('[data-testid="creation-step-4"]');

        expect(step1?.getAttribute('data-step-status')).toBe(item.expected[0]);
        expect(step2?.getAttribute('data-step-status')).toBe(item.expected[1]);
        expect(step3?.getAttribute('data-step-status')).toBe(item.expected[2]);
        expect(step4?.getAttribute('data-step-status')).toBe(item.expected[3]);
        assertNoSecretOrModelTermsInVisibleDom(container);
      }

      const submitBtn = container.querySelector(
        '[data-testid="reimagine-room-submit-btn"]'
      ) as HTMLButtonElement;
      expect(submitBtn).not.toBeNull();
      expect(submitBtn.textContent).toContain('Create Art Piece(s) for My Space →');

      act(() => {
        submitBtn.click();
      });
      expect(onSubmitReimagine).toHaveBeenCalledWith(baseConfig);

      // Also verify standalone AtelierCreationProgressScreen (Page 4)
      act(() => {
        root.render(
          React.createElement(AtelierCreationProgressScreen, {
            generationStage: 'sprinkling-magic',
            engineId: 'gemini-argon',
            artPieceCountMode: 'multi-piece-pair',
            roomAngleCount: 2,
          })
        );
      });

      const creationScreen = container.querySelector(
        '[data-testid="atelier-creation-progress-screen"]'
      );
      expect(creationScreen).not.toBeNull();
      expect(
        container.querySelector('[data-testid="creation-step-1"]')?.getAttribute(
          'data-step-status'
        )
      ).toBe('completed');
      expect(
        container.querySelector('[data-testid="creation-step-2"]')?.getAttribute(
          'data-step-status'
        )
      ).toBe('active');
      assertNoSecretOrModelTermsInVisibleDom(container);
    });
  });

  describe('3. ReimaginedVariationsStrip — Atelier Edition Provenance, Multi-Piece, Multi-Viewpoint & Zero AI Model Announcements ([SPEC PATCH #18, #19, #20, #23])', () => {
    const sampleVariations: ReimaginedRoomVariation[] = [
      {
        id: 'var-1',
        createdAt: 1700000001000,
        engineId: 'astra',
        engineModelName: 'GPT-6 Astra (openai/gpt-6-astra)',
        imageModelName: 'google/gemini-nano-banana-2.1',
        placementAction: 'both',
        styleMode: 'ai-curated',
        promptUsed: 'Internal instruction',
        originalRoomDataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
        reimaginedRoomDataUrl: SAMPLE_ROOM_PHOTOS[2].dataUrl,
        detectedCropBox: { ymin: 140, xmin: 320, ymax: 480, xmax: 680 },
        activeCropBox: { ymin: 140, xmin: 320, ymax: 480, xmax: 680 },
        croppedScreenshotDataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
        identicalPrintMasterDataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
        printMasterWidthPx: 2400,
        printMasterHeightPx: 3600,
        artworkTitle: 'Ochre & Raw Linen Relief Pair',
        artworkDescription: 'Sculptural impasto coordinated pair',
        roomStyleSummary: 'Harmonized to sunlit plaster walls and white oak flooring.',
        artPieces: [
          {
            id: 'piece-1',
            index: 0,
            title: 'Ochre Relief I',
            wallLocationLabel: 'Main Sofa Wall',
            description: 'Primary statement piece',
            identicalPrintMasterDataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
            printMasterWidthPx: 2400,
            printMasterHeightPx: 3600,
          },
          {
            id: 'piece-2',
            index: 1,
            title: 'Ochre Relief II',
            wallLocationLabel: 'Side Return Wall',
            description: 'Companion piece',
            identicalPrintMasterDataUrl: SAMPLE_ROOM_PHOTOS[2].dataUrl,
            printMasterWidthPx: 2400,
            printMasterHeightPx: 3600,
          },
        ],
        preservationVerification: {
          passed: true,
          furniturePreserved: true,
          roomDimensionsPreserved: true,
          onlyArtChanged: true,
          verifierModelId: 'openai/gpt-6-astra',
          summaryNote:
            'Studio Verified: Furniture & Room Dimensions Preserved — Only Wall Art Changed',
          attemptsUsed: 1,
        },
        viewpoints: [
          {
            angleId: 'angle-1',
            angleLabel: 'Angle 1 (Primary View)',
            originalRoomDataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
            reimaginedRoomDataUrl: SAMPLE_ROOM_PHOTOS[2].dataUrl,
            detectedCropBox: { ymin: 140, xmin: 320, ymax: 480, xmax: 680 },
            activeCropBox: { ymin: 140, xmin: 320, ymax: 480, xmax: 680 },
            croppedScreenshotDataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
            preservationVerification: {
              passed: true,
              furniturePreserved: true,
              roomDimensionsPreserved: true,
              onlyArtChanged: true,
              verifierModelId: 'openai/gpt-6-astra',
              summaryNote: 'Studio Verified Angle 1',
              attemptsUsed: 1,
            },
          },
          {
            angleId: 'angle-2',
            angleLabel: 'Angle 2 (Side Perspective)',
            originalRoomDataUrl: SAMPLE_ROOM_PHOTOS[1].dataUrl,
            reimaginedRoomDataUrl: SAMPLE_ROOM_PHOTOS[1].dataUrl,
            detectedCropBox: { ymin: 150, xmin: 340, ymax: 470, xmax: 660 },
            activeCropBox: { ymin: 150, xmin: 340, ymax: 470, xmax: 660 },
            croppedScreenshotDataUrl: SAMPLE_ROOM_PHOTOS[1].dataUrl,
            preservationVerification: {
              passed: true,
              furniturePreserved: true,
              roomDimensionsPreserved: true,
              onlyArtChanged: true,
              verifierModelId: 'openai/gpt-6-astra',
              summaryNote: 'Studio Verified Angle 2',
              attemptsUsed: 1,
            },
          },
        ],
      },
      {
        id: 'var-2',
        createdAt: 1700000002000,
        engineId: 'gemini-argon',
        engineModelName: 'Gemini 4 Argon (google/gemini-4-argon)',
        imageModelName: 'google/gemini-nano-banana-2.1',
        placementAction: 'replace-existing',
        styleMode: 'specific-style',
        promptUsed: 'Internal instruction',
        originalRoomDataUrl: SAMPLE_ROOM_PHOTOS[1].dataUrl,
        reimaginedRoomDataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
        detectedCropBox: { ymin: 120, xmin: 350, ymax: 460, xmax: 650 },
        activeCropBox: { ymin: 120, xmin: 350, ymax: 460, xmax: 650 },
        croppedScreenshotDataUrl: SAMPLE_ROOM_PHOTOS[1].dataUrl,
        identicalPrintMasterDataUrl: SAMPLE_ROOM_PHOTOS[1].dataUrl,
        printMasterWidthPx: 2400,
        printMasterHeightPx: 3600,
        artworkTitle: 'Walnut & Burnt Sienna Horizon',
        artworkDescription: 'Mid-century modernist geometric canvas',
        roomStyleSummary: 'Replaced dated study frame with warm walnut-toned canvas.',
      },
    ];

    it('renders variation cards with "Atelier Edition" badge (zero AI model names), multi-piece badges, viewpoint badges, preservation badges, and zero crop insets', () => {
      const onSelectVariation = vi.fn();
      const onReimagineAnother = vi.fn();
      const onSelectViewpoint = vi.fn();

      act(() => {
        root.render(
          React.createElement(ReimaginedVariationsStrip, {
            variations: sampleVariations,
            activeVariationId: 'var-1',
            onSelectVariation,
            onReimagineAnother,
            onSelectViewpoint,
          })
        );
      });

      const engineBadge1 = container.querySelector(
        '[data-testid="variation-engine-badge-var-1"]'
      );
      const engineBadge2 = container.querySelector(
        '[data-testid="variation-engine-badge-var-2"]'
      );
      expect(engineBadge1?.textContent).toBe('Atelier Edition');
      expect(engineBadge2?.textContent).toBe('Atelier Edition');

      const piecesBadge1 = container.querySelector(
        '[data-testid="variation-pieces-badge-var-1"]'
      );
      const piecesBadge2 = container.querySelector(
        '[data-testid="variation-pieces-badge-var-2"]'
      );
      expect(piecesBadge1?.textContent).toContain('2 Art Pieces');
      expect(piecesBadge2?.textContent).toContain('1 Art Piece');

      const viewpointsBadge1 = container.querySelector(
        '[data-testid="variation-viewpoints-badge-var-1"]'
      );
      const viewpointsBadge2 = container.querySelector(
        '[data-testid="variation-viewpoints-badge-var-2"]'
      );
      expect(viewpointsBadge1?.textContent).toContain('2 Viewpoints');
      expect(viewpointsBadge2?.textContent).toContain('1 Viewpoint');

      const preservationBadge1 = container.querySelector(
        '[data-testid="variation-preservation-badge-var-1"]'
      );
      expect(preservationBadge1).not.toBeNull();
      expect(preservationBadge1?.textContent).toContain('Only Art Changed');

      expect(container.querySelector('[data-testid^="variation-crop-inset-"]')).toBeNull();

      const vpStrip = container.querySelector('[data-testid="viewpoint-selector-strip"]');
      const vpPill0 = container.querySelector(
        '[data-testid="viewpoint-pill-0"]'
      ) as HTMLButtonElement;
      const vpPill1 = container.querySelector(
        '[data-testid="viewpoint-pill-1"]'
      ) as HTMLButtonElement;
      expect(vpStrip).not.toBeNull();
      expect(vpPill0).not.toBeNull();
      expect(vpPill1).not.toBeNull();

      act(() => {
        vpPill1.click();
      });
      expect(onSelectViewpoint).toHaveBeenCalledWith(1);
      expect(vpPill1.getAttribute('aria-pressed')).toBe('true');

      expect(container.querySelectorAll('a[href]').length).toBe(0);
      assertNoSecretOrModelTermsInVisibleDom(container);
    });

    it('calls onSelectVariation, calls onReimagineAnother, and toggles Original Room comparison', () => {
      const onSelectVariation = vi.fn();
      const onReimagineAnother = vi.fn();
      const onToggleOriginalRoom = vi.fn();

      act(() => {
        root.render(
          React.createElement(ReimaginedVariationsStrip, {
            variations: sampleVariations,
            activeVariationId: 'var-1',
            onSelectVariation,
            onReimagineAnother,
            onToggleOriginalRoom,
          })
        );
      });

      const card2 = container.querySelector(
        '[data-testid="variation-card-var-2"]'
      ) as HTMLButtonElement;
      const reimagineAnotherBtn = container.querySelector(
        '[data-testid="reimagine-another-option-btn"]'
      ) as HTMLButtonElement;
      const compareToggle = container.querySelector(
        '[data-testid="compare-original-room-toggle"]'
      ) as HTMLButtonElement;
      const thumb1 = container.querySelector(
        '[data-testid="variation-room-thumb-var-1"]'
      ) as HTMLImageElement;

      expect(thumb1.getAttribute('src')).toBe(sampleVariations[0].reimaginedRoomDataUrl);

      act(() => {
        card2.click();
      });
      expect(onSelectVariation).toHaveBeenCalledWith('var-2');

      act(() => {
        reimagineAnotherBtn.click();
      });
      expect(onReimagineAnother).toHaveBeenCalledTimes(1);

      act(() => {
        compareToggle.click();
      });
      expect(onToggleOriginalRoom).toHaveBeenCalledWith(true);
      expect(compareToggle.getAttribute('data-showing-original')).toBe('true');
      expect(thumb1.getAttribute('src')).toBe(sampleVariations[0].originalRoomDataUrl);
    });
  });

  describe('4. ScaleCalibrationPage — Sleek 1-Caliper-First Same-Wall Calibration & >5% Scale Discrepancy Check ([SPEC PATCH #27])', () => {
    it('starts with 1 sleek caliper (Caliper A), allows adding Caliper B (+ Add Another Measurement), flags a >5% scale inaccuracy error when measurements disagree, and calibrates frame/photo size when within <=5%', () => {
      const onUpdateQuestionAnswer = vi.fn();
      const onApplyScaleAndCreate = vi.fn();
      const onSkipScaleAndCreate = vi.fn();
      const onBackToCuration = vi.fn();

      function StatefulScalePageHarness() {
        const [questions, setQuestions] = useState<ScaleCalibrationQuestion[]>(() =>
          DEFAULT_SCALE_CALIBRATION_QUESTIONS.map((q) => ({ ...q }))
        );

        const recommendation = computeFallbackScaleRecommendation(questions);

        const handleUpdate = (questionId: string, valueInches: number | null) => {
          setQuestions((prev) =>
            prev.map((q) =>
              q.id === questionId ? { ...q, userAnswerInches: valueInches } : q
            )
          );
          onUpdateQuestionAnswer(questionId, valueInches);
        };

        return React.createElement(ScaleCalibrationPage, {
          roomImageDataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
          roomAngles: SAMPLE_ROOM_PHOTOS[0].angles,
          questions,
          scaleRecommendation: recommendation,
          onUpdateQuestionAnswer: handleUpdate,
          onApplyScaleAndCreate,
          onSkipScaleAndCreate,
          onBackToCuration,
        });
      }

      act(() => {
        root.render(React.createElement(StatefulScalePageHarness));
      });

      const scalePage = container.querySelector(
        '[data-testid="scale-calibration-page"]'
      );
      const headOnIndicator = container.querySelector(
        '[data-testid="sizing-head-on-photo-indicator"]'
      );
      const sameWallInstructions = container.querySelector(
        '[data-testid="same-wall-measurement-instructions"]'
      );
      const questionsList = container.querySelector(
        '[data-testid="scale-questions-list"]'
      );
      const recommendationPreview = container.querySelector(
        '[data-testid="scale-page-recommendation-preview"]'
      );
      const recommendedDimensionsLabel = container.querySelector(
        '[data-testid="scale-recommended-dimensions-label"]'
      );
      const skipTopBtn = container.querySelector(
        '[data-testid="skip-scale-page-btn"]'
      ) as HTMLButtonElement;
      const skipBottomBtn = container.querySelector(
        '[data-testid="skip-scale-page-bottom-btn"]'
      ) as HTMLButtonElement;
      const applyBtn = container.querySelector(
        '[data-testid="apply-scale-and-create-btn"]'
      ) as HTMLButtonElement;
      const backBtn = container.querySelector(
        '[data-testid="back-to-curation-from-scale-btn"]'
      ) as HTMLButtonElement;

      expect(scalePage).not.toBeNull();
      expect(headOnIndicator).not.toBeNull();
      expect(sameWallInstructions).not.toBeNull();
      expect(sameWallInstructions?.textContent).toContain('same wall');
      expect(questionsList).not.toBeNull();
      expect(recommendationPreview).not.toBeNull();
      expect(recommendedDimensionsLabel?.textContent).toContain('24" × 36"');
      expect(skipTopBtn).not.toBeNull();
      expect(skipBottomBtn).not.toBeNull();
      expect(applyBtn).not.toBeNull();
      expect(backBtn).not.toBeNull();

      // 1. Starts with ONLY 1 Caliper (Caliper A) visible on the image and in the question list
      expect(container.querySelector('[data-testid="image-caliper-0"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="scale-question-card-0"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="image-caliper-1"]')).toBeNull();
      expect(container.querySelector('[data-testid="scale-question-card-1"]')).toBeNull();

      // 2. User takes 1st measurement on Caliper A (e.g. 72") and leaves it
      const quickVal72 = container.querySelector(
        '[data-testid="scale-quick-val-0-72"]'
      ) as HTMLButtonElement;
      expect(quickVal72).not.toBeNull();

      act(() => {
        quickVal72.click();
      });
      expect(onUpdateQuestionAnswer).toHaveBeenCalledWith('reference-furniture-width', 72);

      // 3. User clicks "+ Add Another Measurement (Caliper B)" to add 2nd caliper
      const addSecondCaliperBtn = container.querySelector(
        '[data-testid="add-second-caliper-btn"]'
      ) as HTMLButtonElement;
      expect(addSecondCaliperBtn).not.toBeNull();

      act(() => {
        addSecondCaliperBtn.click();
      });

      expect(container.querySelector('[data-testid="image-caliper-1"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="scale-question-card-1"]')).not.toBeNull();

      // 4. Enter a 2nd measurement that differs in scale by > 5% (72" on span 580 vs 140" on span 774 -> ~45.6% diff)
      const input1 = container.querySelector(
        '[data-testid="scale-question-input-1"]'
      ) as HTMLInputElement;
      expect(input1).not.toBeNull();
      act(() => {
        triggerTextInputChange(input1, '140');
      });

      const errorBanner = container.querySelector(
        '[data-testid="scale-inaccuracy-error-banner"]'
      );
      expect(errorBanner).not.toBeNull();
      expect(errorBanner?.textContent).toContain('Measurement Inaccuracy Error');
      expect(applyBtn.disabled).toBe(true);

      // 5. Enter a 2nd measurement within <= 5% scale agreement (72" on span 580 and 96" on span 774 -> 0.1% diff)
      const quickValWall96 = container.querySelector(
        '[data-testid="scale-quick-val-1-96"]'
      ) as HTMLButtonElement;
      expect(quickValWall96).not.toBeNull();

      act(() => {
        quickValWall96.click();
      });

      expect(onUpdateQuestionAnswer).toHaveBeenCalledWith('target-wall-width', 96);
      expect(
        container.querySelector('[data-testid="scale-inaccuracy-error-banner"]')
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="scale-within-tolerance-badge"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="recommended-art-piece-details"]')
      ).not.toBeNull();
      expect(applyBtn.disabled).toBe(false);

      // 6. Verify Native Zoom (1x-4x), Pinpoint Caliper Edges, True Horizontal (0°) & True Vertical (90°) Angle Clipping, and Frame Box Corner Handles
      const zoomToolbar = container.querySelector('[data-testid="caliper-zoom-toolbar"]');
      const zoomPreset2 = container.querySelector('[data-testid="caliper-zoom-preset-2"]') as HTMLButtonElement;
      const zoomInBtn = container.querySelector('[data-testid="caliper-zoom-in-btn"]') as HTMLButtonElement;
      const zoomLevelBadge = container.querySelector('[data-testid="caliper-zoom-level-badge"]');
      const orthoSnapToggle = container.querySelector('[data-testid="caliper-ortho-snap-toggle"]') as HTMLButtonElement;
      const autoSnapFrameBtn = container.querySelector('[data-testid="auto-snap-frame-box-btn"]') as HTMLButtonElement;

      expect(zoomToolbar).not.toBeNull();
      expect(zoomPreset2).not.toBeNull();
      expect(zoomInBtn).not.toBeNull();
      expect(zoomLevelBadge?.textContent).toBe('100%');
      expect(orthoSnapToggle.getAttribute('aria-pressed')).toBe('true');
      expect(autoSnapFrameBtn).not.toBeNull();

      // Verify 4 pinpoint corner handles on the white frame box (`frame-box-handle-nw`, `ne`, `sw`, `se`)
      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        expect(container.querySelector(`[data-testid="frame-box-handle-${corner}"]`)).not.toBeNull();
      }

      // Click 2x Zoom preset -> canvas scales to 200%
      act(() => {
        zoomPreset2.click();
      });
      expect(zoomLevelBadge?.textContent).toBe('200%');
      const imageCanvas = container.querySelector('[data-testid="caliper-image-canvas"]') as HTMLElement;
      expect(imageCanvas.style.width).toBe('200%');

      // Click Zoom In (+) -> 250%
      act(() => {
        zoomInBtn.click();
      });
      expect(zoomLevelBadge?.textContent).toBe('250%');

      // Verify Caliper A is clipped to 0.0° True Horizontal and Caliper B is clipped to 90.0° True Vertical
      expect(container.querySelector('[data-testid="caliper-angle-status-0"]')?.textContent).toContain('0.0° True Horizontal');
      expect(container.querySelector('[data-testid="caliper-angle-status-1"]')?.textContent).toContain('90.0° True Vertical');
      expect(container.querySelector('[data-testid="caliper-ortho-guide-line-0"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="caliper-ortho-guide-line-1"]')).not.toBeNull();

      // Test 1-click "Clip Vertical (90°)" and "Clip Horizontal (0°)" buttons on Caliper A
      const snapVert0 = container.querySelector('[data-testid="snap-caliper-vertical-btn-0"]') as HTMLButtonElement;
      const snapHoriz0 = container.querySelector('[data-testid="snap-caliper-horizontal-btn-0"]') as HTMLButtonElement;
      act(() => {
        snapVert0.click();
      });
      expect(container.querySelector('[data-testid="caliper-angle-status-0"]')?.textContent).toContain('90.0° True Vertical');
      act(() => {
        snapHoriz0.click();
      });
      expect(container.querySelector('[data-testid="caliper-angle-status-0"]')?.textContent).toContain('0.0° True Horizontal');

      // Verify Skip, Apply, and Back buttons
      act(() => {
        skipTopBtn.click();
      });
      expect(onSkipScaleAndCreate).toHaveBeenCalledTimes(1);

      act(() => {
        applyBtn.click();
      });
      expect(onApplyScaleAndCreate).toHaveBeenCalledTimes(1);

      act(() => {
        backBtn.click();
      });
      expect(onBackToCuration).toHaveBeenCalledTimes(1);

      expect(container.querySelectorAll('a[href]').length).toBe(0);
      assertNoSecretOrModelTermsInVisibleDom(container);
    });
  });
});
