import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { RoomAsset, RoomPresetId, WallAnalysisResult } from '../../contracts/masterContract';
import {
  PRESET_ROOM_DEFINITIONS,
  renderPresetRoomToCanvas,
  synthesizePresetRoomImageData,
  createCapturedRoomAssetFromViewfinder,
  createRoomAssetFromUpload,
} from './roomPresetsAndCamera';
import { analyzeRoomImagePixels } from './wallColorimetryAnalyzer';

export interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureRoom: (room: RoomAsset) => void;
}

type CaptureMode = 'hardware-webcam' | 'simulated-viewfinder';
type LightingShiftMode = 'morning' | 'daylight' | 'warm-evening';
type CameraFacingMode = 'environment' | 'user';

interface ViewfinderTemplateOption {
  id: RoomPresetId;
  viewfinderTitle: string;
  presetName: string;
  architecturalSubtitle: string;
}

const VIEWFINDER_TEMPLATES: ReadonlyArray<ViewfinderTemplateOption> = [
  {
    id: 'nordic-linen-living',
    viewfinderTitle: 'Nordic Plaster Studio',
    presetName: 'Nordic Linen Living Room',
    architecturalSubtitle: 'Limewashed warm alabaster wall · Pale oak wainscoting',
  },
  {
    id: 'midcentury-walnut-study',
    viewfinderTitle: 'Mid-Century Sage Study',
    presetName: 'Mid-Century Walnut Study',
    architecturalSubtitle: 'Muted sage-olive boiserie · American walnut credenza',
  },
  {
    id: 'terracotta-sunlit-loft',
    viewfinderTitle: 'Sunlit Terracotta Loft',
    presetName: 'Terracotta Sunlit Dining Loft',
    architecturalSubtitle: 'Venetian plaster & warm clay · Diagonal clerestory sun',
  },
  {
    id: 'minimalist-concrete-bedroom',
    viewfinderTitle: 'Minimalist Concrete Gallery',
    presetName: 'Minimalist Concrete Gallery Bedroom',
    architecturalSubtitle: 'Board-formed architectural concrete · North skylight',
  },
];

const LIGHTING_OPTIONS: ReadonlyArray<{
  id: LightingShiftMode;
  label: string;
  kelvinHint: string;
}> = [
  { id: 'morning', label: 'Morning Sun', kelvinHint: '+Warm East Slant' },
  { id: 'daylight', label: 'Gallery Daylight', kelvinHint: 'Neutral Balanced' },
  { id: 'warm-evening', label: 'Warm Evening', kelvinHint: '2900K Sconce Glow' },
];

function sanitizeRoomName(raw: string): string {
  const cleaned = raw.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return 'Captured Living Room Wall';
  }
  return cleaned.slice(0, 72);
}

function hasNonZeroPixels(imageData: ImageData): boolean {
  const data = imageData.data;
  const step = Math.max(4, Math.floor(data.length / 200) * 4);
  for (let i = 0; i < data.length; i += step) {
    if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) {
      return true;
    }
  }
  return false;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCaptureRoom,
}) => {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('simulated-viewfinder');
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('environment');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Simulated Architectural Viewfinder Active — Ready to Capture'
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasHardwareStream, setHasHardwareStream] = useState<boolean>(false);
  const [selectedPresetId, setSelectedPresetId] = useState<RoomPresetId>('nordic-linen-living');
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [lightingShift, setLightingShift] = useState<LightingShiftMode>('daylight');
  const [customRoomName, setCustomRoomName] = useState<string>('Captured Living Room Wall');
  const [isDraggingViewfinder, setIsDraggingViewfinder] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  const stopActiveStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      const tracks = new Set<MediaStreamTrack>([
        ...(typeof stream.getTracks === 'function' ? stream.getTracks() : []),
        ...(typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks() : []),
      ]);
      tracks.forEach((track) => {
        try {
          if (typeof track.stop === 'function') {
            track.stop();
          }
        } catch {
          // Ignore track stop errors during cleanup
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        // Ignore in headless environments
      }
    }
    setHasHardwareStream(false);
  }, []);

  const acquireCameraStream = useCallback(
    async (targetFacing: CameraFacingMode): Promise<MediaStream | null> => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        return null;
      }

      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 840 },
          },
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'OverconstrainedError') {
          return await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: targetFacing,
              width: { ideal: 1280 },
              height: { ideal: 840 },
            },
          });
        }
        throw err;
      }
    },
    []
  );

  const requestHardwareCamera = useCallback(
    async (overrideFacing?: CameraFacingMode) => {
      const activeFacing = overrideFacing ?? facingMode;
      stopActiveStream();
      setUploadError(null);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setCaptureMode('simulated-viewfinder');
        setStatusMessage('Simulated Architectural Viewfinder Active — Ready to Capture');
        return;
      }

      try {
        const stream = await acquireCameraStream(activeFacing);

        if (!stream) {
          setCaptureMode('simulated-viewfinder');
          setStatusMessage('Simulated Architectural Viewfinder Active — Ready to Capture');
          return;
        }

        streamRef.current = stream;
        setHasHardwareStream(true);
        setCaptureMode('hardware-webcam');
        const lensLabel = activeFacing === 'environment' ? 'Rear Room Lens' : 'Front Lens';
        setStatusMessage(
          `Live Optical Camera Stream Active (${lensLabel}) — 57" Horizon Calibrated`
        );

        if (videoRef.current) {
          try {
            videoRef.current.srcObject = stream;
            const canPlay =
              typeof videoRef.current.play === 'function' &&
              ('mock' in videoRef.current.play ||
                !(
                  typeof navigator !== 'undefined' &&
                  typeof navigator.userAgent === 'string' &&
                  /jsdom/i.test(navigator.userAgent)
                ));
            if (canPlay) {
              await videoRef.current.play().catch(() => {
                // Autoplay in headless environment can safely resolve without throwing
              });
            }
          } catch {
            // Fallback if video element rejects srcObject in headless DOM
          }
        }
      } catch {
        stopActiveStream();
        setCaptureMode('simulated-viewfinder');
        setStatusMessage('Simulated Architectural Viewfinder Active — Ready to Capture');
      }
    },
    [acquireCameraStream, facingMode, stopActiveStream]
  );

  // Attempt hardware camera on open, with graceful immediate fallback to simulated viewfinder
  useEffect(() => {
    if (!isOpen) {
      stopActiveStream();
      return;
    }

    let isMounted = true;
    setUploadError(null);

    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      acquireCameraStream('environment')
        .then((stream) => {
          if (!isMounted || !stream) {
            if (stream && typeof stream.getTracks === 'function') {
              stream.getTracks().forEach((t) => t.stop());
            }
            return;
          }
          streamRef.current = stream;
          setHasHardwareStream(true);
          setCaptureMode('hardware-webcam');
          setStatusMessage(
            'Live Optical Camera Stream Active (Rear Room Lens) — 57" Horizon Calibrated'
          );
          if (videoRef.current) {
            try {
              videoRef.current.srcObject = stream;
              const canPlay =
                typeof videoRef.current.play === 'function' &&
                ('mock' in videoRef.current.play ||
                  !(
                    typeof navigator !== 'undefined' &&
                    typeof navigator.userAgent === 'string' &&
                    /jsdom/i.test(navigator.userAgent)
                  ));
              if (canPlay) {
                videoRef.current.play().catch(() => {});
              }
            } catch {
              // Ignore in headless environments
            }
          }
        })
        .catch(() => {
          if (!isMounted) return;
          setCaptureMode('simulated-viewfinder');
          setStatusMessage('Simulated Architectural Viewfinder Active — Ready to Capture');
        });
    } else {
      setCaptureMode('simulated-viewfinder');
      setStatusMessage('Simulated Architectural Viewfinder Active — Ready to Capture');
    }

    return () => {
      isMounted = false;
      stopActiveStream();
    };
  }, [isOpen, acquireCameraStream, stopActiveStream]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute live preview ImageData and live WallAnalysisResult whenever viewfinder controls change
  const liveAnalysis: WallAnalysisResult = useMemo(() => {
    const previewCanvas =
      typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let imgData: ImageData;
    if (previewCanvas) {
      previewCanvas.width = 320;
      previewCanvas.height = 210;
      imgData = renderPresetRoomToCanvas(previewCanvas, selectedPresetId, {
        panX,
        panY,
        lightingShift,
      });
    } else {
      imgData = synthesizePresetRoomImageData(selectedPresetId, 320, 210, {
        panX,
        panY,
        lightingShift,
      });
    }
    return analyzeRoomImagePixels(
      imgData,
      `viewfinder-preview-${selectedPresetId}-${lightingShift}`
    );
  }, [selectedPresetId, panX, panY, lightingShift]);

  // Render interactive 640x420 canvas preview whenever open or parameters change
  useEffect(() => {
    if (!isOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = 640;
    canvas.height = 420;
    renderPresetRoomToCanvas(canvas, selectedPresetId, {
      panX,
      panY,
      lightingShift,
    });
  }, [isOpen, selectedPresetId, panX, panY, lightingShift, captureMode]);

  const handleSelectMode = (nextMode: CaptureMode) => {
    setUploadError(null);
    if (nextMode === 'simulated-viewfinder') {
      stopActiveStream();
      setCaptureMode('simulated-viewfinder');
      setStatusMessage('Simulated Architectural Viewfinder Active — Ready to Capture');
    } else {
      void requestHardwareCamera(facingMode);
    }
  };

  const handleFlipCamera = () => {
    const nextFacing: CameraFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    setUploadError(null);
    if (
      captureMode === 'hardware-webcam' ||
      (typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function')
    ) {
      void requestHardwareCamera(nextFacing);
    } else {
      const lensLabel = nextFacing === 'environment' ? 'Rear Room Lens' : 'Front Lens';
      setStatusMessage(
        `Simulated Architectural Viewfinder Active (${lensLabel}) — Ready to Capture`
      );
    }
  };

  const handleNativeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      setStatusMessage('Analyzing uploaded room photograph...');
      const uploadedRoom = await createRoomAssetFromUpload(file);
      stopActiveStream();
      onCaptureRoom(uploadedRoom);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unable to process room photo upload.';
      setUploadError(msg);
      setStatusMessage(msg);
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panX,
      initialPanY: panY,
    };
    setIsDraggingViewfinder(true);
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore in headless environments
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const refWidth = rect.width > 0 ? rect.width : 640;
    const refHeight = rect.height > 0 ? rect.height : 420;
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    const nextPanX = Math.max(
      -0.25,
      Math.min(0.25, Number((dragStateRef.current.initialPanX + (dx / refWidth) * 0.5).toFixed(2)))
    );
    const nextPanY = Math.max(
      -0.2,
      Math.min(0.2, Number((dragStateRef.current.initialPanY + (dy / refHeight) * 0.4).toFixed(2)))
    );
    setPanX(nextPanX);
    setPanY(nextPanY);
  };

  const handleCanvasPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    setIsDraggingViewfinder(false);
    try {
      if (dragStateRef.current.pointerId !== null) {
        e.currentTarget.releasePointerCapture?.(dragStateRef.current.pointerId);
      }
    } catch {
      // Ignore in headless environments
    }
  };

  const handleShutterCapture = () => {
    const cleanName = sanitizeRoomName(customRoomName);

    // 1. Check if we are in live hardware webcam mode with valid video dimensions
    if (
      captureMode === 'hardware-webcam' &&
      hasHardwareStream &&
      videoRef.current &&
      videoRef.current.videoWidth > 0 &&
      videoRef.current.videoHeight > 0
    ) {
      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = 1280;
        offscreen.height = 840;
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 1280, 840);
          const videoPixels = ctx.getImageData(0, 0, 1280, 840);
          if (hasNonZeroPixels(videoPixels)) {
            const roomId = `custom-room-webcam-${Date.now()}`;
            const analysis = analyzeRoomImagePixels(videoPixels, roomId);
            let dataUrl = '';
            try {
              dataUrl = offscreen.toDataURL('image/jpeg', 0.92);
            } catch {
              dataUrl = '';
            }
            const webcamRoom: RoomAsset = {
              id: roomId,
              name: cleanName,
              architecturalStyle: 'Live Optical Camera Capture',
              wallWidthInches: 120,
              eyeLevelRatioY: 0.46,
              isCustomUpload: true,
              imageDataUrl:
                dataUrl ||
                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="840"></svg>',
              analysis,
              createdAt: Date.now(),
            };
            stopActiveStream();
            onCaptureRoom(webcamRoom);
            onClose();
            return;
          }
        }
      } catch {
        // Fall through to deterministic viewfinder capture
      }
    }

    // 2. Simulated Architectural Viewfinder capture (or headless fallback)
    const capturedRoom = createCapturedRoomAssetFromViewfinder({
      basePresetId: selectedPresetId,
      customName: cleanName,
      panX,
      panY,
      lightingShift,
    });

    stopActiveStream();
    onCaptureRoom(capturedRoom);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const activePresetMeta =
    PRESET_ROOM_DEFINITIONS.find(
      (p: { id: RoomPresetId; wallWidthInches: number; eyeLevelRatioY: number }) =>
        p.id === selectedPresetId
    ) ?? PRESET_ROOM_DEFINITIONS[0];

  const wallZone = liveAnalysis.detectedWallZone;
  const zoneLeftPct = Math.max(8, Math.min(82, (wallZone.centerX - wallZone.widthRatio / 2) * 100));
  const zoneTopPct = Math.max(8, Math.min(72, (wallZone.centerY - wallZone.heightRatio / 2) * 100));
  const zoneWidthPct = Math.max(20, Math.min(75, wallZone.widthRatio * 100));
  const zoneHeightPct = Math.max(20, Math.min(60, wallZone.heightRatio * 100));
  const eyeLevelTopPct = (activePresetMeta?.eyeLevelRatioY ?? 0.46) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      style={{
        backgroundColor: 'rgba(22, 21, 20, 0.72)',
        backdropFilter: 'blur(6px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-capture-modal-title"
      data-testid="camera-capture-modal"
    >
      <div
        data-testid="camera-modal-sheet"
        className="w-full max-w-5xl rounded-t-[12px] md:rounded-[6px] max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl transition-all"
        style={{
          backgroundColor: '#F6F4EF',
          color: '#161514',
          border: '1px solid #E2DDD3',
        }}
      >
        {/* Hidden Native Mobile OS Camera / Photo Roll File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          data-testid="camera-native-file-input"
          aria-label="Upload Room Photo or Capture from Mobile Camera"
          onChange={handleNativeFileChange}
          className="sr-only"
        />

        {/* Sticky Top Architectural Header Bar */}
        <div
          className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4"
          style={{
            backgroundColor: '#EFECE6',
            borderBottom: '1px solid #E2DDD3',
          }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    captureMode === 'hardware-webcam' && hasHardwareStream
                      ? '#2E4A3E'
                      : '#B85D3B',
                }}
              />
              <span
                className="text-[11px] font-medium uppercase tracking-[0.14em]"
                style={{ color: '#5C5852' }}
              >
                Atelier Vue · Optical Room Acquisition &amp; Wall Calibration
              </span>
            </div>
            <h2
              id="camera-capture-modal-title"
              className="mt-0.5 text-lg md:text-xl font-normal tracking-tight"
              style={{
                fontFamily: '"Playfair Display", "Instrument Serif", Georgia, serif',
                color: '#161514',
              }}
            >
              Capture &amp; Analyze Architectural Wall Space
            </h2>
          </div>

          {/* Mode Toggle, Flip Facing Mode & Close Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex p-0.5"
              style={{
                backgroundColor: '#F6F4EF',
                border: '1px solid #E2DDD3',
                borderRadius: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => handleSelectMode('simulated-viewfinder')}
                data-testid="camera-mode-simulated-btn"
                className="min-h-[44px] min-w-[44px] px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    captureMode === 'simulated-viewfinder' ? '#161514' : 'transparent',
                  color: captureMode === 'simulated-viewfinder' ? '#F6F4EF' : '#5C5852',
                  borderRadius: '3px',
                }}
              >
                Simulated Viewfinder
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode('hardware-webcam')}
                data-testid="camera-mode-hardware-btn"
                className="min-h-[44px] min-w-[44px] px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    captureMode === 'hardware-webcam' ? '#161514' : 'transparent',
                  color: captureMode === 'hardware-webcam' ? '#F6F4EF' : '#5C5852',
                  borderRadius: '3px',
                }}
              >
                Live Hardware Camera
              </button>
            </div>

            <button
              type="button"
              onClick={handleFlipCamera}
              data-testid="camera-flip-facing-btn"
              data-facing-mode={facingMode}
              aria-label="Flip Camera Facing Mode"
              className="min-h-[44px] min-w-[44px] px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#161514',
                border: '1px solid #E2DDD3',
                borderRadius: '4px',
              }}
            >
              {facingMode === 'environment' ? 'Lens: Rear Room' : 'Lens: Front User'}
            </button>

            <button
              type="button"
              onClick={() => {
                stopActiveStream();
                onClose();
              }}
              data-testid="camera-modal-close-btn"
              aria-label="Close Camera Modal"
              className="min-h-[44px] min-w-[44px] px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#161514',
                border: '1px solid #E2DDD3',
                borderRadius: '4px',
              }}
            >
              Close (Esc)
            </button>
          </div>
        </div>

        {/* Sticky Editorial Status Pill Bar */}
        <div
          className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6 md:py-2.5 text-xs"
          style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2DDD3',
          }}
        >
          <div className="flex flex-wrap items-center gap-2" data-testid="camera-status-pill">
            <span
              className="px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: uploadError ? '#FDF2F0' : '#EFECE6',
                color: uploadError ? '#9E2A2B' : '#2E4A3E',
                border: `1px solid ${uploadError ? '#E09F9A' : '#E2DDD3'}`,
                borderRadius: '3px',
              }}
            >
              {statusMessage}
            </span>
            {uploadError && (
              <span
                role="alert"
                data-testid="camera-upload-error"
                className="px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: '#FDF2F0',
                  color: '#9E2A2B',
                  border: '1px solid #E09F9A',
                  borderRadius: '3px',
                }}
              >
                {uploadError}
              </span>
            )}
          </div>
          <div
            className="hidden sm:block text-[11px]"
            style={{
              color: '#5C5852',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            CAPTURE MASTER: 1280×840 PX · K-MEANS (k=6) + SOBEL 3×3 WALL DETECTOR
          </div>
        </div>

        {/* Scrollable Middle Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left 7 Columns: Live Optical / Simulated Architectural Viewfinder Stage */}
            <div
              className="relative flex flex-col justify-between p-4 md:p-5 lg:col-span-7"
              style={{
                backgroundColor: '#161514',
              }}
            >
              {/* Viewfinder Frame Container (640x420 aspect ratio) */}
              <div
                className="relative mx-auto w-full overflow-hidden"
                style={{
                  aspectRatio: '640 / 420',
                  border: '1px solid rgba(226, 221, 211, 0.28)',
                  borderRadius: '4px',
                  backgroundColor: '#1E1D1B',
                }}
              >
                {/* Simulated Viewfinder Canvas (Supports Touch / Pointer Drag-to-Pan) */}
                <canvas
                  ref={previewCanvasRef}
                  width={640}
                  height={420}
                  data-testid="camera-viewfinder-canvas"
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerEnd}
                  onPointerCancel={handleCanvasPointerEnd}
                  className={`h-full w-full object-cover touch-none select-none ${
                    isDraggingViewfinder ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                  style={{ touchAction: 'none' }}
                />

                {/* Hardware WebRTC Video Element (Shown when hardware stream is active) */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  data-testid="camera-hardware-video"
                  className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${
                    captureMode === 'hardware-webcam' && hasHardwareStream ? 'block' : 'hidden'
                  }`}
                />

                {/* Overlaid Architectural Viewfinder Reticle & 57" Horizon */}
                <div className="pointer-events-none absolute inset-0">
                  {/* Subtle Rule-of-Thirds Grid */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(246,244,239,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(246,244,239,0.12) 1px, transparent 1px)',
                      backgroundSize: '33.333% 33.333%',
                    }}
                  />

                  {/* 57" Museum Eye-Level Alignment Horizon Line */}
                  <div
                    className="absolute left-0 right-0 flex items-center justify-between px-3"
                    style={{
                      top: `${eyeLevelTopPct}%`,
                      borderTop: '1px dashed rgba(200, 169, 126, 0.85)',
                    }}
                  >
                    <span
                      className="-mt-5 px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase"
                      style={{
                        backgroundColor: 'rgba(22, 21, 20, 0.78)',
                        color: '#DFC59E',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: '"JetBrains Mono", monospace',
                        borderRadius: '2px',
                      }}
                    >
                      57&quot; Eye-Level Centerline
                    </span>
                    <span
                      className="-mt-5 px-1.5 py-0.5 text-[10px]"
                      style={{
                        backgroundColor: 'rgba(22, 21, 20, 0.78)',
                        color: '#F6F4EF',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: '"JetBrains Mono", monospace',
                        borderRadius: '2px',
                      }}
                    >
                      Ref Width: {activePresetMeta?.wallWidthInches ?? 120}&quot;
                    </span>
                  </div>

                  {/* Detected Open-Wall Target Frame */}
                  <div
                    className="absolute transition-all duration-150"
                    style={{
                      left: `${zoneLeftPct}%`,
                      top: `${zoneTopPct}%`,
                      width: `${zoneWidthPct}%`,
                      height: `${zoneHeightPct}%`,
                      border: '1.5px solid rgba(184, 93, 59, 0.9)',
                      backgroundColor: 'rgba(184, 93, 59, 0.06)',
                      borderRadius: '2px',
                    }}
                  >
                    <div
                      className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                      style={{
                        backgroundColor: 'rgba(22, 21, 20, 0.84)',
                        color: '#F6F4EF',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      Open-Wall Target · {Math.round(wallZone.confidence * 100)}% Lock
                    </div>
                  </div>

                  {/* Live Exposure / Kelvin HUD Meter Overlay at Top-Left */}
                  <div
                    className="absolute left-3 top-3 flex items-center gap-2 px-2.5 py-1 text-[11px]"
                    style={{
                      backgroundColor: 'rgba(22, 21, 20, 0.82)',
                      color: '#F6F4EF',
                      border: '1px solid rgba(226, 221, 211, 0.25)',
                      borderRadius: '3px',
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    <span>WB {liveAnalysis.estimatedKelvin}K</span>
                    <span>·</span>
                    <span>LUX {Math.round(liveAnalysis.averageLuminance * 100)}%</span>
                    <span>·</span>
                    <span>
                      LIGHT {Math.round(liveAnalysis.lightVector.azimuthDeg)}°/
                      {Math.round(liveAnalysis.lightVector.elevationDeg)}°
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Live Telemetry Badges Bar */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div
                  className="p-2.5"
                  style={{
                    backgroundColor: '#22201E',
                    border: '1px solid rgba(226, 221, 211, 0.18)',
                    borderRadius: '4px',
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: '#A39E93' }}
                  >
                    Estimated Kelvin
                  </div>
                  <div
                    data-testid="telemetry-kelvin-badge"
                    className="mt-0.5 text-xs sm:text-sm font-semibold"
                    style={{
                      color: '#F6F4EF',
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {liveAnalysis.estimatedKelvin}K ·{' '}
                    {liveAnalysis.temperatureCategory.toUpperCase()}
                  </div>
                </div>

                <div
                  className="p-2.5"
                  style={{
                    backgroundColor: '#22201E',
                    border: '1px solid rgba(226, 221, 211, 0.18)',
                    borderRadius: '4px',
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: '#A39E93' }}
                  >
                    Wall Luminance
                  </div>
                  <div
                    data-testid="telemetry-luminance-badge"
                    className="mt-0.5 text-xs sm:text-sm font-semibold"
                    style={{
                      color: '#F6F4EF',
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {Math.round(liveAnalysis.averageLuminance * 100)}% Reflectance
                  </div>
                </div>

                <div
                  className="p-2.5"
                  style={{
                    backgroundColor: '#22201E',
                    border: '1px solid rgba(226, 221, 211, 0.18)',
                    borderRadius: '4px',
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: '#A39E93' }}
                  >
                    Open-Wall Lock
                  </div>
                  <div
                    data-testid="telemetry-wall-lock-badge"
                    className="mt-0.5 text-xs sm:text-sm font-semibold"
                    style={{
                      color: '#DFC59E',
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {Math.round(wallZone.confidence * 100)}% Confidence
                  </div>
                </div>
              </div>

              {/* Live Extracted 6-Swatch Strip */}
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {liveAnalysis.dominantSwatches.map((swatch, idx) => (
                  <div
                    key={`${swatch.hex}-${idx}`}
                    className="flex items-center gap-1.5 px-2 py-1"
                    style={{
                      backgroundColor: '#22201E',
                      border: '1px solid rgba(226, 221, 211, 0.16)',
                      borderRadius: '3px',
                    }}
                    title={`${swatch.label} (${swatch.hex})`}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0"
                      style={{
                        backgroundColor: swatch.hex,
                        border: '1px solid rgba(255,255,255,0.25)',
                        borderRadius: '2px',
                      }}
                    />
                    <span
                      className="truncate text-[10px]"
                      style={{
                        color: '#E2DDD3',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {swatch.hex}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 5 Columns: Interactive Viewfinder Aiming & Architecture Controls */}
            <div
              className="flex flex-col justify-between p-4 md:p-6 lg:col-span-5"
              style={{
                backgroundColor: '#F6F4EF',
                borderLeft: '1px solid #E2DDD3',
              }}
            >
              <div className="space-y-5">
                {/* 1. Room Architecture Template Selector */}
                <div>
                  <label
                    className="block text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: '#5C5852' }}
                  >
                    1. Target Room Architecture Template
                  </label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {VIEWFINDER_TEMPLATES.map((tpl) => {
                      const isSelected = selectedPresetId === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          data-testid={`viewfinder-template-${tpl.id}`}
                          onClick={() => {
                            setSelectedPresetId(tpl.id);
                            setCustomRoomName(`Captured ${tpl.viewfinderTitle}`);
                          }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-between px-3 py-2 text-left transition-colors"
                          style={{
                            backgroundColor: isSelected ? '#FFFFFF' : '#EFECE6',
                            border: isSelected ? '1.5px solid #B85D3B' : '1px solid #E2DDD3',
                            borderRadius: '4px',
                          }}
                        >
                          <div>
                            <div
                              className="text-xs font-semibold"
                              style={{ color: '#161514' }}
                            >
                              {tpl.viewfinderTitle}
                            </div>
                            <div
                              className="text-[11px]"
                              style={{ color: '#5C5852' }}
                            >
                              {tpl.architecturalSubtitle}
                            </div>
                          </div>
                          <span
                            className="text-[10px] font-medium uppercase px-1.5 py-0.5"
                            style={{
                              backgroundColor: isSelected ? '#B85D3B' : '#E2DDD3',
                              color: isSelected ? '#FFFFFF' : '#5C5852',
                              borderRadius: '3px',
                            }}
                          >
                            {isSelected ? 'Aimed' : 'Select'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Camera Pan & Tilt Framing Controls */}
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: '#5C5852' }}
                    >
                      2. Pan &amp; Aim Viewfinder Framing
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPanX(0);
                        setPanY(0);
                      }}
                      data-testid="camera-reset-pan-btn"
                      className="min-h-[44px] min-w-[44px] px-2 text-[11px] underline"
                      style={{ color: '#5C5852' }}
                    >
                      Reset Center (0, 0)
                    </button>
                  </div>

                  <div
                    className="mt-1 space-y-3 p-3"
                    style={{
                      backgroundColor: '#EFECE6',
                      border: '1px solid #E2DDD3',
                      borderRadius: '4px',
                    }}
                  >
                    <div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#161514' }}>Horizontal Camera Pan (X)</span>
                        <span
                          style={{
                            color: '#5C5852',
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: '"JetBrains Mono", monospace',
                          }}
                        >
                          {panX > 0 ? `+${panX.toFixed(2)}` : panX.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-0.25}
                        max={0.25}
                        step={0.01}
                        value={panX}
                        aria-label="Horizontal Camera Pan"
                        data-testid="camera-pan-x-slider"
                        onChange={(e) => setPanX(parseFloat(e.target.value))}
                        className="mt-1 min-h-[44px] w-full cursor-pointer accent-[#B85D3B]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#161514' }}>Vertical Elevation Tilt (Y)</span>
                        <span
                          style={{
                            color: '#5C5852',
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: '"JetBrains Mono", monospace',
                          }}
                        >
                          {panY > 0 ? `+${panY.toFixed(2)}` : panY.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-0.2}
                        max={0.2}
                        step={0.01}
                        value={panY}
                        aria-label="Vertical Camera Pan"
                        data-testid="camera-pan-y-slider"
                        onChange={(e) => setPanY(parseFloat(e.target.value))}
                        className="mt-1 min-h-[44px] w-full cursor-pointer accent-[#B85D3B]"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Ambient Lighting Condition */}
                <div>
                  <label
                    className="block text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: '#5C5852' }}
                  >
                    3. Ambient Room Illumination Condition
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {LIGHTING_OPTIONS.map((opt) => {
                      const isSelected = lightingShift === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`camera-lighting-${opt.id}`}
                          onClick={() => setLightingShift(opt.id)}
                          className="min-h-[44px] min-w-[44px] px-2.5 py-2 text-left transition-colors"
                          style={{
                            backgroundColor: isSelected ? '#161514' : '#EFECE6',
                            color: isSelected ? '#F6F4EF' : '#161514',
                            border: '1px solid #E2DDD3',
                            borderRadius: '4px',
                          }}
                        >
                          <div className="text-xs font-medium">{opt.label}</div>
                          <div
                            className="text-[10px]"
                            style={{ color: isSelected ? '#DFC59E' : '#5C5852' }}
                          >
                            {opt.kelvinHint}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Custom Room Name Input (16px text-base to prevent iOS Safari auto-zoom) */}
                <div>
                  <label
                    htmlFor="camera-room-name-input"
                    className="block text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: '#5C5852' }}
                  >
                    4. Captured Room Studio Label
                  </label>
                  <input
                    id="camera-room-name-input"
                    type="text"
                    value={customRoomName}
                    onChange={(e) => setCustomRoomName(e.target.value)}
                    data-testid="camera-room-name-input"
                    aria-label="Captured Room Name"
                    placeholder="e.g., Captured Living Room Wall"
                    className="mt-1.5 min-h-[44px] w-full px-3 py-2 text-base"
                    style={{
                      backgroundColor: '#FFFFFF',
                      color: '#161514',
                      border: '1px solid #E2DDD3',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar: Native Upload / OS Camera Roll + Primary Shutter CTA */}
        <div
          className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 py-3 md:px-6 md:py-4"
          style={{
            backgroundColor: '#EFECE6',
            borderTop: '1px solid #E2DDD3',
          }}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="camera-native-upload-btn"
            aria-label="Upload Room Photo or Open OS Camera Roll"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#161514',
              border: '1px solid #E2DDD3',
              borderRadius: '4px',
            }}
          >
            <span>Upload / OS Camera Roll</span>
          </button>

          <button
            type="button"
            onClick={handleShutterCapture}
            data-testid="camera-shutter-capture-btn"
            aria-label="Capture & Analyze Wall"
            className="min-h-[44px] min-w-[44px] flex flex-1 sm:flex-initial items-center justify-center gap-2 px-5 py-3 text-sm font-medium tracking-wide transition-opacity hover:opacity-95"
            style={{
              backgroundColor: '#B85D3B',
              color: '#FFFFFF',
              borderRadius: '4px',
            }}
          >
            <span>Capture &amp; Analyze Wall</span>
            <span
              className="text-xs opacity-90"
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              ({liveAnalysis.estimatedKelvin}K · 1280×840)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
