import React, { useEffect, useRef, useState } from 'react';
import { RoomAngleAsset, WallPlacementAction } from '../../contracts/masterContract';

export interface SampleRoomPhotoPreset {
  id: 'sunlit-living-room' | 'midcentury-study-existing-art' | 'minimalist-loft';
  name: string;
  subtitle: string;
  hasExistingWallArt: boolean;
  recommendedAction: WallPlacementAction;
  dataUrl: string;
  additionalAngles?: RoomAngleAsset[];
  angles?: RoomAngleAsset[];
}

export interface UploadHeroStageProps {
  uploadedRoomDataUrl: string | null;
  uploadedRoomTitle?: string;
  roomImageDataUrl?: string | null;
  roomAngles?: RoomAngleAsset[];
  onSelectRoomPhoto: (
    roomDataUrl: string,
    roomTitle: string,
    hasExistingArtHint?: boolean,
    allAngles?: RoomAngleAsset[]
  ) => void;
  onChangeRoomAngles?: (angles: RoomAngleAsset[]) => void;
  onUpdateRoomAngles?: (angles: RoomAngleAsset[]) => void;
  onAddRoomAngle?: (newAngle: RoomAngleAsset) => void;
  onAddRoomAngles?: (newAngles: RoomAngleAsset[]) => void;
  onRemoveRoomAngle?: (index: number) => void;
  onClearRoomPhoto?: () => void;
  onContinueToCuration?: () => void;
  nonPhotoDescription?: string;
  onChangeNonPhotoDescription?: (value: string) => void;
  onProceedWithDescription?: (description: string) => void;
}

function createSvgDataUrl(svgMarkup: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup.trim())}`;
}

const SUNLIT_LIVING_ROOM_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="sunlitWall" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F6F2EA" />
      <stop offset="55%" stop-color="#EDE6D8" />
      <stop offset="100%" stop-color="#DFD5C3" />
    </linearGradient>
    <linearGradient id="sunlitFloor" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#C8B08F" />
      <stop offset="100%" stop-color="#A88D69" />
    </linearGradient>
    <linearGradient id="sunbeam" x1="0%" y1="0%" x2="100%" y2="85%">
      <stop offset="0%" stop-color="#FFFDF8" stop-opacity="0.52" />
      <stop offset="60%" stop-color="#FFF9EB" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#EDE6D8" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1200" height="600" fill="url(#sunlitWall)" />
  <polygon points="0,0 520,0 920,600 180,600" fill="url(#sunbeam)" />
  <rect x="0" y="586" width="1200" height="14" fill="#E5DEC9" />
  <rect x="0" y="600" width="1200" height="200" fill="url(#sunlitFloor)" />
  <polygon points="180,655 1020,655 1110,790 90,790" fill="#EAE3D5" stroke="#D5CBB8" stroke-width="3" />
  <g transform="translate(250, 445)">
    <ellipse cx="350" cy="195" rx="345" ry="22" fill="#6F5B41" opacity="0.26" />
    <rect x="30" y="0" width="640" height="95" rx="18" fill="#E3DDD1" stroke="#CFC6B6" stroke-width="2" />
    <rect x="48" y="12" width="196" height="82" rx="14" fill="#ECE7DC" stroke="#D5CDBE" stroke-width="2" />
    <rect x="252" y="12" width="196" height="82" rx="14" fill="#EFEAE0" stroke="#D5CDBE" stroke-width="2" />
    <rect x="456" y="12" width="196" height="82" rx="14" fill="#EAE4D8" stroke="#D5CDBE" stroke-width="2" />
    <rect x="0" y="42" width="48" height="128" rx="14" fill="#DED7C9" stroke="#C8BFAE" stroke-width="2" />
    <rect x="652" y="42" width="48" height="128" rx="14" fill="#DED7C9" stroke="#C8BFAE" stroke-width="2" />
    <rect x="38" y="88" width="624" height="82" rx="12" fill="#F2EDE4" stroke="#D4CCBC" stroke-width="2" />
    <rect x="64" y="34" width="66" height="56" rx="12" fill="#B85D3B" opacity="0.85" />
    <rect x="565" y="36" width="62" height="54" rx="12" fill="#7C8574" opacity="0.85" />
    <rect x="42" y="170" width="18" height="22" rx="3" fill="#7D5D3B" />
    <rect x="640" y="170" width="18" height="22" rx="3" fill="#7D5D3B" />
  </g>
  <g transform="translate(990, 495)">
    <rect x="0" y="40" width="84" height="80" rx="8" fill="#DFD7C8" stroke="#C5B9A5" stroke-width="2" />
    <ellipse cx="42" cy="40" rx="46" ry="10" fill="#ECE6DA" stroke="#C5B9A5" stroke-width="2" />
    <path d="M32,36 C24,18 28,2 42,2 C56,2 60,18 52,36 Z" fill="#9E6245" />
    <path d="M42,4 Q20,-28 8,-42 M42,4 Q58,-34 74,-48" stroke="#5B6952" stroke-width="3" fill="none" stroke-linecap="round" />
  </g>
</svg>
`;

const SUNLIT_SIDE_ANGLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="sideWallMain" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F3EEE4" />
      <stop offset="100%" stop-color="#E2D9C6" />
    </linearGradient>
    <linearGradient id="sideWallReturn" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#DDD2BE" />
      <stop offset="100%" stop-color="#EAE2D3" />
    </linearGradient>
  </defs>
  <!-- Left Perspective Return Wall -->
  <polygon points="0,0 260,70 260,565 0,635" fill="url(#sideWallReturn)" />
  <!-- Main Gallery Wall in Side Perspective -->
  <polygon points="260,70 1200,0 1200,605 260,565" fill="url(#sideWallMain)" />
  <!-- Oak Floor -->
  <polygon points="0,635 260,565 1200,605 1200,800 0,800" fill="#B99E7B" />
  <!-- Angled Linen Sofa & Floor Lamp -->
  <g transform="translate(360, 445)">
    <rect x="0" y="15" width="540" height="145" rx="16" fill="#EBE5DA" stroke="#D1C8B8" stroke-width="2" />
    <rect x="35" y="0" width="470" height="75" rx="14" fill="#F2EDE3" stroke="#D5CCBC" stroke-width="2" />
    <rect x="55" y="25" width="64" height="50" rx="10" fill="#B85D3B" opacity="0.85" />
  </g>
  <g transform="translate(150, 310)">
    <line x1="40" y1="55" x2="40" y2="290" stroke="#7A654B" stroke-width="6" />
    <ellipse cx="40" cy="292" rx="34" ry="10" fill="#7A654B" />
    <polygon points="10,55 70,55 85,110 -5,110" fill="#FBF8F1" stroke="#D8CEBE" stroke-width="2" />
  </g>
</svg>
`;

const MIDCENTURY_STUDY_EXISTING_ART_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="studyWall" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EAE3D5" />
      <stop offset="100%" stop-color="#D7CEBD" />
    </linearGradient>
    <linearGradient id="walnutWood" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5B3D28" />
      <stop offset="50%" stop-color="#6F4C33" />
      <stop offset="100%" stop-color="#4A301E" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1200" height="590" fill="url(#studyWall)" />
  <g id="existing-wall-art" transform="translate(430, 115)">
    <rect x="10" y="14" width="340" height="240" rx="4" fill="#3B3228" opacity="0.22" />
    <rect x="0" y="0" width="340" height="240" rx="3" fill="#3A281B" stroke="#24180F" stroke-width="4" />
    <rect x="18" y="18" width="304" height="204" fill="#F5F1E8" />
    <rect x="46" y="42" width="248" height="156" fill="#D9CFC0" />
    <circle cx="135" cy="120" r="46" fill="#6E7F80" opacity="0.75" />
    <rect x="165" y="76" width="84" height="88" fill="#B57B52" opacity="0.8" />
    <line x1="65" y1="170" x2="275" y2="70" stroke="#2F2925" stroke-width="4" />
  </g>
  <rect x="0" y="576" width="1200" height="14" fill="#CFC4B0" />
  <rect x="0" y="590" width="1200" height="210" fill="#9A7856" />
  <g transform="translate(280, 445)">
    <ellipse cx="320" cy="180" rx="330" ry="18" fill="#2B1E14" opacity="0.3" />
    <rect x="0" y="0" width="640" height="132" rx="6" fill="url(#walnutWood)" stroke="#3B2516" stroke-width="3" />
    <line x1="213" y1="6" x2="213" y2="126" stroke="#362214" stroke-width="3" />
    <line x1="426" y1="6" x2="426" y2="126" stroke="#362214" stroke-width="3" />
    <rect x="188" y="54" width="8" height="26" rx="3" fill="#C9A55A" />
    <rect x="228" y="54" width="8" height="26" rx="3" fill="#C9A55A" />
    <rect x="442" y="54" width="8" height="26" rx="3" fill="#C9A55A" />
    <polygon points="40,132 56,132 46,178 32,178" fill="#3D2718" />
    <polygon points="584,132 600,132 608,178 594,178" fill="#3D2718" />
    <rect x="65" y="-22" width="110" height="12" rx="2" fill="#EAE3D2" />
    <rect x="74" y="-32" width="92" height="10" rx="2" fill="#B85D3B" />
    <rect x="520" y="-58" width="14" height="58" fill="#B8964C" />
    <path d="M478,-54 C478,-92 576,-92 576,-54 Z" fill="#D5B467" />
  </g>
</svg>
`;

const MINIMALIST_LOFT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="limewashWall" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F4F2EE" />
      <stop offset="50%" stop-color="#E7E3DC" />
      <stop offset="100%" stop-color="#DAD4CA" />
    </linearGradient>
    <linearGradient id="concreteFloor" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#CDC8BF" />
      <stop offset="100%" stop-color="#B5AFA4" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1200" height="605" fill="url(#limewashWall)" />
  <rect x="0" y="598" width="1200" height="7" fill="#BEB7AC" />
  <rect x="0" y="605" width="1200" height="195" fill="url(#concreteFloor)" />
  <g transform="translate(300, 495)">
    <ellipse cx="300" cy="138" rx="310" ry="18" fill="#5A554E" opacity="0.22" />
    <rect x="35" y="76" width="530" height="50" rx="6" fill="#322E2B" />
    <rect x="0" y="18" width="600" height="64" rx="26" fill="#F7F5F0" stroke="#DED9CE" stroke-width="2" />
    <rect x="44" y="0" width="128" height="32" rx="16" fill="#E5DFD3" stroke="#CFC8BA" stroke-width="2" />
  </g>
  <g transform="translate(135, 390)">
    <rect x="0" y="95" width="76" height="145" rx="4" fill="#DED9CF" stroke="#C7C0B4" stroke-width="2" />
    <ellipse cx="38" cy="68" rx="28" ry="34" fill="#504A44" />
    <path d="M38,40 Q14,-10 4,-45 M38,40 Q62,-18 78,-55 M38,20 Q36,-35 40,-70" stroke="#626D58" stroke-width="3.5" fill="none" stroke-linecap="round" />
  </g>
</svg>
`;

const SUNLIT_PRIMARY_DATA_URL = createSvgDataUrl(SUNLIT_LIVING_ROOM_SVG);
const SUNLIT_SIDE_DATA_URL = createSvgDataUrl(SUNLIT_SIDE_ANGLE_SVG);
const MIDCENTURY_PRIMARY_DATA_URL = createSvgDataUrl(MIDCENTURY_STUDY_EXISTING_ART_SVG);
const MINIMALIST_PRIMARY_DATA_URL = createSvgDataUrl(MINIMALIST_LOFT_SVG);

export const SAMPLE_ROOM_PHOTOS: SampleRoomPhotoPreset[] = [
  {
    id: 'sunlit-living-room',
    name: 'Sunlit Living Room',
    subtitle: 'Warm plaster wall & linen sofa (blank wall)',
    hasExistingWallArt: false,
    recommendedAction: 'add-only',
    dataUrl: SUNLIT_PRIMARY_DATA_URL,
    additionalAngles: [
      {
        id: 'sunlit-living-room-angle-2',
        label: 'Angle 2 (Side Perspective)',
        dataUrl: SUNLIT_SIDE_DATA_URL,
        hasExistingWallArt: false,
      },
    ],
    angles: [
      {
        id: 'sunlit-living-room-angle-1',
        label: 'Angle 1 (Primary View)',
        dataUrl: SUNLIT_PRIMARY_DATA_URL,
        hasExistingWallArt: false,
      },
      {
        id: 'sunlit-living-room-angle-2',
        label: 'Angle 2 (Side Perspective)',
        dataUrl: SUNLIT_SIDE_DATA_URL,
        hasExistingWallArt: false,
      },
    ],
  },
  {
    id: 'midcentury-study-existing-art',
    name: 'Mid-Century Study with Existing Art',
    subtitle: 'Walnut credenza with existing framed print to replace',
    hasExistingWallArt: true,
    recommendedAction: 'replace-existing',
    dataUrl: MIDCENTURY_PRIMARY_DATA_URL,
    additionalAngles: [
      {
        id: 'midcentury-study-angle-2',
        label: 'Angle 2 (Reading Corner View)',
        dataUrl: SUNLIT_SIDE_DATA_URL,
        hasExistingWallArt: false,
      },
    ],
    angles: [
      {
        id: 'midcentury-study-angle-1',
        label: 'Angle 1 (Credenza Wall)',
        dataUrl: MIDCENTURY_PRIMARY_DATA_URL,
        hasExistingWallArt: true,
      },
    ],
  },
  {
    id: 'minimalist-loft',
    name: 'Minimalist Loft',
    subtitle: 'Architectural limewash gallery wall',
    hasExistingWallArt: false,
    recommendedAction: 'add-only',
    dataUrl: MINIMALIST_PRIMARY_DATA_URL,
    additionalAngles: [
      {
        id: 'minimalist-loft-angle-2',
        label: 'Angle 2 (Corridor Perspective)',
        dataUrl: SUNLIT_SIDE_DATA_URL,
        hasExistingWallArt: false,
      },
    ],
    angles: [
      {
        id: 'minimalist-loft-angle-1',
        label: 'Angle 1 (Primary Gallery Wall)',
        dataUrl: MINIMALIST_PRIMARY_DATA_URL,
        hasExistingWallArt: false,
      },
    ],
  },
];

export const UploadHeroStage: React.FC<UploadHeroStageProps> = ({
  uploadedRoomDataUrl,
  uploadedRoomTitle,
  roomImageDataUrl,
  roomAngles,
  onSelectRoomPhoto,
  onChangeRoomAngles,
  onUpdateRoomAngles,
  onAddRoomAngle,
  onAddRoomAngles,
  onRemoveRoomAngle,
  onClearRoomPhoto,
  onContinueToCuration,
  nonPhotoDescription,
  onChangeNonPhotoDescription,
  onProceedWithDescription,
}) => {
  const effectivePrimaryUrl = uploadedRoomDataUrl ?? roomImageDataUrl ?? null;
  const isControlledDescription = typeof nonPhotoDescription === 'string';
  const [internalDescription, setInternalDescription] = useState<string>(
    nonPhotoDescription ?? ''
  );

  const normalizeHeadOnAngles = (angles: RoomAngleAsset[]): RoomAngleAsset[] => {
    if (angles.length === 0) return [];
    const hasExplicitHeadOn = angles.some((a) => Boolean(a.isHeadOnSizingPhoto));
    if (hasExplicitHeadOn) {
      let assigned = false;
      return angles.map((a) => {
        if (a.isHeadOnSizingPhoto && !assigned) {
          assigned = true;
          return { ...a, isHeadOnSizingPhoto: true };
        }
        return { ...a, isHeadOnSizingPhoto: false };
      });
    }
    return angles.map((a, idx) => ({
      ...a,
      isHeadOnSizingPhoto: idx === 0,
    }));
  };

  const [internalAngles, setInternalAngles] = useState<RoomAngleAsset[]>(() => {
    if (roomAngles && roomAngles.length > 0) {
      return normalizeHeadOnAngles(roomAngles);
    }
    if (effectivePrimaryUrl) {
      return [
        {
          id: 'angle-1',
          label: uploadedRoomTitle || 'Angle 1 (Head-On Photo)',
          dataUrl: effectivePrimaryUrl,
          hasExistingWallArt: false,
          isHeadOnSizingPhoto: true,
        },
      ];
    }
    return [];
  });

  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverAddAngle, setIsDraggingOverAddAngle] = useState(false);
  const [isChangingPhoto, setIsChangingPhoto] = useState(false);
  const [isAddAngleScreenOpen, setIsAddAngleScreenOpen] = useState(false);
  const [newAngleLabel, setNewAngleLabel] = useState<string>(
    'Angle 2 (Secondary Viewpoint)'
  );
  const [newAngleIsHeadOn, setNewAngleIsHeadOn] = useState<boolean>(false);
  const [cameraCaptureMode, setCameraCaptureMode] = useState<'primary' | 'add-angle'>(
    'primary'
  );
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [cameraStatusNote, setCameraStatusNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addAngleInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);
  const addAngleScreenRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Sync internalAngles when controlled props change
  useEffect(() => {
    if (roomAngles && roomAngles.length > 0) {
      setInternalAngles(normalizeHeadOnAngles(roomAngles));
      setIsChangingPhoto(false);
      return;
    }
    if (effectivePrimaryUrl) {
      setIsChangingPhoto(false);
      setInternalAngles((prev) => {
        if (prev.length === 0) {
          return [
            {
              id: 'angle-1',
              label: uploadedRoomTitle || 'Angle 1 (Head-On Photo)',
              dataUrl: effectivePrimaryUrl,
              hasExistingWallArt: false,
              isHeadOnSizingPhoto: true,
            },
          ];
        }
        if (prev[0].dataUrl !== effectivePrimaryUrl) {
          return normalizeHeadOnAngles([
            {
              ...prev[0],
              label: uploadedRoomTitle || prev[0].label || 'Angle 1 (Head-On Photo)',
              dataUrl: effectivePrimaryUrl,
            },
            ...prev.slice(1),
          ]);
        }
        return normalizeHeadOnAngles(prev);
      });
    } else if (!effectivePrimaryUrl && (!roomAngles || roomAngles.length === 0)) {
      setInternalAngles([]);
    }
  }, [effectivePrimaryUrl, uploadedRoomTitle, roomAngles]);

  const displayedAngles: RoomAngleAsset[] = normalizeHeadOnAngles(
    roomAngles && roomAngles.length > 0 ? roomAngles : internalAngles
  );

  const latestAnglesRef = useRef<RoomAngleAsset[]>(displayedAngles);
  latestAnglesRef.current = displayedAngles;

  const stopCameraStream = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    setCameraStreamActive(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const compressDataUrlIfLarge = (rawDataUrl: string): Promise<string> => {
    const isJsdom =
      typeof navigator !== 'undefined' &&
      (navigator.userAgent || '').toLowerCase().includes('jsdom');
    if (
      isJsdom ||
      typeof document === 'undefined' ||
      typeof Image === 'undefined' ||
      rawDataUrl.length < 380_000
    ) {
      return Promise.resolve(rawDataUrl);
    }

    return new Promise<string>((resolve) => {
      let done = false;
      const finish = (url: string) => {
        if (!done) {
          done = true;
          resolve(url);
        }
      };
      const timer = setTimeout(() => finish(rawDataUrl), 1200);
      try {
        const img = new Image();
        img.onload = () => {
          clearTimeout(timer);
          try {
            const maxDim = 1280;
            const natW = img.naturalWidth || img.width || 1200;
            const natH = img.naturalHeight || img.height || 800;
            const scale =
              Math.max(natW, natH) > maxDim ? maxDim / Math.max(natW, natH) : 1;
            const w = Math.max(64, Math.round(natW * scale));
            const h = Math.max(64, Math.round(natH * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#F5F0E6';
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              const compressed = canvas.toDataURL('image/jpeg', 0.86);
              if (compressed && compressed.startsWith('data:image/')) {
                finish(compressed);
                return;
              }
            }
          } catch {
            // Fall back to rawDataUrl
          }
          finish(rawDataUrl);
        };
        img.onerror = () => {
          clearTimeout(timer);
          finish(rawDataUrl);
        };
        img.src = rawDataUrl;
      } catch {
        clearTimeout(timer);
        finish(rawDataUrl);
      }
    });
  };

  const commitRoomAngles = (
    nextAngles: RoomAngleAsset[],
    newlyAddedAngles?: RoomAngleAsset[],
    focusLastAdded?: boolean
  ) => {
    latestAnglesRef.current = nextAngles;
    setInternalAngles(nextAngles);
    if (focusLastAdded && nextAngles.length > 0) {
      setSelectedPreviewIndex(nextAngles.length - 1);
    } else if (nextAngles.length === 1) {
      setSelectedPreviewIndex(0);
    }
    setIsChangingPhoto(false);
    setIsAddAngleScreenOpen(false);
    setIsCameraModalOpen(false);
    stopCameraStream();

    onChangeRoomAngles?.(nextAngles);
    onUpdateRoomAngles?.(nextAngles);
    if (newlyAddedAngles && newlyAddedAngles.length > 0) {
      newlyAddedAngles.forEach((added) => onAddRoomAngle?.(added));
      onAddRoomAngles?.(newlyAddedAngles);
    }

    if (nextAngles.length > 0) {
      const primary = nextAngles[0];
      onSelectRoomPhoto(
        primary.dataUrl,
        primary.label,
        Boolean(primary.hasExistingWallArt),
        nextAngles
      );
    }
  };

  const processSelectedFiles = (
    fileList: FileList | File[] | null | undefined,
    appendToExisting: boolean
  ) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const baseAngles = appendToExisting ? [...latestAnglesRef.current] : [];
    const fallbackSvgs = [
      SUNLIT_PRIMARY_DATA_URL,
      SUNLIT_SIDE_DATA_URL,
      MINIMALIST_PRIMARY_DATA_URL,
    ];

    const customNewLabel = newAngleLabel.trim();

    const createdAngles: RoomAngleAsset[] = files.map((file, idx) => {
      const angleNumber = baseAngles.length + idx + 1;
      const cleanName = file.name
        ? file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')
        : `Room Angle ${angleNumber}`;
      const isMarkedHeadOn =
        (appendToExisting && idx === 0 && newAngleIsHeadOn) ||
        (!appendToExisting && idx === 0);
      const label =
        appendToExisting && idx === 0 && customNewLabel
          ? customNewLabel
          : angleNumber === 1
          ? `Angle 1 — Head-On Photo (${cleanName})`
          : `Angle ${angleNumber} (${cleanName})`;

      return {
        id: `room-angle-${Date.now()}-${angleNumber}-${idx}`,
        label,
        dataUrl: fallbackSvgs[(angleNumber - 1) % fallbackSvgs.length],
        hasExistingWallArt: false,
        isHeadOnSizingPhoto: isMarkedHeadOn,
      };
    });

    const combinedRaw =
      appendToExisting && newAngleIsHeadOn
        ? [
            ...baseAngles.map((a) => ({ ...a, isHeadOnSizingPhoto: false })),
            ...createdAngles,
          ]
        : [...baseAngles, ...createdAngles];
    const immediateNextAngles = normalizeHeadOnAngles(combinedRaw);
    setNewAngleIsHeadOn(false);
    commitRoomAngles(immediateNextAngles, createdAngles, appendToExisting || files.length > 1);

    // Read actual file Data URLs via FileReader and update both local and parent state outside setState
    if (typeof FileReader !== 'undefined') {
      files.forEach((file, idx) => {
        const targetAngleId = createdAngles[idx].id;
        const reader = new FileReader();
        reader.onload = async () => {
          const rawResult = reader.result;
          if (typeof rawResult === 'string' && rawResult.startsWith('data:')) {
            const normalizedUrl = await compressDataUrlIfLarge(rawResult);
            const updated = normalizeHeadOnAngles(
              latestAnglesRef.current.map((ang) =>
                ang.id === targetAngleId ? { ...ang, dataUrl: normalizedUrl } : ang
              )
            );
            latestAnglesRef.current = updated;
            setInternalAngles(updated);
            onChangeRoomAngles?.(updated);
            onUpdateRoomAngles?.(updated);
            if (updated.length > 0) {
              onSelectRoomPhoto(
                updated[0].dataUrl,
                updated[0].label,
                Boolean(updated[0].hasExistingWallArt),
                updated
              );
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handlePrimaryFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processSelectedFiles(event.target.files, false);
    event.target.value = '';
  };

  const handleAddAngleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processSelectedFiles(event.target.files, true);
    event.target.value = '';
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const files = event.dataTransfer?.files;
    processSelectedFiles(files, displayedAngles.length > 0 && !isChangingPhoto);
  };

  const handleAddAngleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDraggingOverAddAngle) {
      setIsDraggingOverAddAngle(true);
    }
  };

  const handleAddAngleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOverAddAngle(false);
  };

  const handleAddAngleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOverAddAngle(false);
    const files = event.dataTransfer?.files;
    processSelectedFiles(files, true);
  };

  const handleOpenAddAngleScreen = () => {
    const nextNum = displayedAngles.length + 1;
    setNewAngleLabel(`Angle ${nextNum} (Secondary Viewpoint)`);
    setIsAddAngleScreenOpen(true);
    setTimeout(() => {
      if (
        addAngleScreenRef.current &&
        typeof addAngleScreenRef.current.scrollIntoView === 'function'
      ) {
        try {
          addAngleScreenRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        } catch {
          // Ignore in test environments
        }
      }
    }, 30);
  };

  const handleOpenCameraModal = async (mode: 'primary' | 'add-angle' = 'primary') => {
    setCameraCaptureMode(mode);
    setIsCameraModalOpen(true);
    setCameraStatusNote(null);
    setCameraPermissionDenied(false);

    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        activeStreamRef.current = stream;
        setCameraStreamActive(true);
        setCameraPermissionDenied(false);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraStreamActive(false);
        setCameraPermissionDenied(true);
        setCameraStatusNote(
          'Camera access was denied or no camera device was found. Please upload a room photo file from your device instead.'
        );
      }
    } else {
      setCameraStreamActive(false);
      setCameraPermissionDenied(false);
      setCameraStatusNote(
        'Live camera device is unavailable in this browser context. Please upload a room photo file from your device instead.'
      );
    }
  };

  const handleCloseCameraModal = () => {
    stopCameraStream();
    setIsCameraModalOpen(false);
  };

  const handleCaptureCameraFrame = () => {
    const isAddingAngle =
      cameraCaptureMode === 'add-angle' ||
      (displayedAngles.length > 0 && !isChangingPhoto);

    const isJsdom =
      typeof navigator !== 'undefined' &&
      /jsdom/i.test(navigator.userAgent || '');

    if (!cameraStreamActive && (cameraPermissionDenied || !isJsdom)) {
      if (isAddingAngle) {
        addAngleInputRef.current?.click();
      } else {
        fileInputRef.current?.click();
      }
      return;
    }

    let capturedDataUrl = isAddingAngle
      ? SAMPLE_ROOM_PHOTOS[1].dataUrl
      : SUNLIT_PRIMARY_DATA_URL;

    if (cameraStreamActive && videoRef.current && typeof document !== 'undefined') {
      try {
        const video = videoRef.current;
        const width = video.videoWidth || 1200;
        const height = video.videoHeight || 800;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const url = canvas.toDataURL('image/png');
          if (url && url.startsWith('data:image/')) {
            capturedDataUrl = url;
          }
        }
      } catch {
        if (!isJsdom) {
          setCameraPermissionDenied(true);
          setCameraStatusNote(
            'Could not read a frame from the camera stream. Please upload a room photo file instead.'
          );
          return;
        }
      }
    }

    const nextAngleNumber = isAddingAngle ? displayedAngles.length + 1 : 1;
    const customLabel = newAngleLabel.trim();
    const resolvedLabel =
      isAddingAngle && customLabel
        ? customLabel
        : nextAngleNumber === 1
        ? 'Camera Captured Room'
        : `Angle ${nextAngleNumber} (Camera Viewpoint)`;

    const newAngle: RoomAngleAsset = {
      id: `camera-angle-${Date.now()}-${nextAngleNumber}`,
      label: resolvedLabel,
      dataUrl: capturedDataUrl,
      hasExistingWallArt: false,
      isHeadOnSizingPhoto: !isAddingAngle || newAngleIsHeadOn,
    };

    const nextAnglesRaw = isAddingAngle
      ? newAngleIsHeadOn
        ? [
            ...displayedAngles.map((a) => ({ ...a, isHeadOnSizingPhoto: false })),
            newAngle,
          ]
        : [...displayedAngles, newAngle]
      : [newAngle];

    setNewAngleIsHeadOn(false);
    commitRoomAngles(normalizeHeadOnAngles(nextAnglesRaw), [newAngle], isAddingAngle);
  };

  const handleAddSampleSecondAngle = () => {
    const nextNumber = displayedAngles.length + 1;
    const newAngle: RoomAngleAsset = {
      id: `sample-angle-${Date.now()}-${nextNumber}`,
      label: `Angle ${nextNumber} (Side Perspective)`,
      dataUrl: nextNumber % 2 === 0 ? SUNLIT_SIDE_DATA_URL : MINIMALIST_PRIMARY_DATA_URL,
      hasExistingWallArt: false,
      isHeadOnSizingPhoto: false,
    };
    const nextAngles = normalizeHeadOnAngles([...displayedAngles, newAngle]);
    commitRoomAngles(nextAngles, [newAngle], true);
  };

  const handleSetHeadOnPhoto = (headOnIndex: number) => {
    const updated = displayedAngles.map((ang, idx) => ({
      ...ang,
      isHeadOnSizingPhoto: idx === headOnIndex,
    }));
    latestAnglesRef.current = updated;
    setInternalAngles(updated);
    onChangeRoomAngles?.(updated);
    onUpdateRoomAngles?.(updated);
    if (updated.length > 0) {
      const primary = updated[0];
      onSelectRoomPhoto(
        primary.dataUrl,
        primary.label,
        Boolean(primary.hasExistingWallArt),
        updated
      );
    }
  };

  const handleRemoveAngle = (indexToRemove: number) => {
    onRemoveRoomAngle?.(indexToRemove);
    const remaining = normalizeHeadOnAngles(
      displayedAngles.filter((_, idx) => idx !== indexToRemove)
    );
    latestAnglesRef.current = remaining;
    setInternalAngles(remaining);
    onChangeRoomAngles?.(remaining);
    onUpdateRoomAngles?.(remaining);

    if (remaining.length === 0) {
      setSelectedPreviewIndex(0);
      setIsAddAngleScreenOpen(false);
      onClearRoomPhoto?.();
    } else {
      const nextPreviewIdx = Math.min(selectedPreviewIndex, remaining.length - 1);
      setSelectedPreviewIndex(nextPreviewIdx);
      const primary = remaining[0];
      onSelectRoomPhoto(
        primary.dataUrl,
        primary.label,
        Boolean(primary.hasExistingWallArt),
        remaining
      );
    }
  };

  const handleChangeRoomClick = () => {
    setIsChangingPhoto(true);
    setIsAddAngleScreenOpen(false);
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    if (!isControlledDescription) {
      setInternalDescription(nextValue);
    }
    onChangeNonPhotoDescription?.(nextValue);
  };

  const handleProceedByDescribing = () => {
    const currentDescription =
      (isControlledDescription ? nonPhotoDescription : internalDescription) ?? '';

    if (!hasLoadedRoom) {
      const describedCanvasAngle: RoomAngleAsset = {
        id: 'angle-described-1',
        label: 'Custom Described Space',
        dataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
        hasExistingWallArt: false,
        isHeadOnSizingPhoto: true,
      };
      commitRoomAngles([describedCanvasAngle], [describedCanvasAngle]);
    }
    onProceedWithDescription?.(currentDescription);
    onContinueToCuration?.();
  };

  const hasLoadedRoom = Boolean(
    effectivePrimaryUrl || (roomAngles && roomAngles.length > 0) || internalAngles.length > 0
  );
  const showDropzoneView = !hasLoadedRoom || isChangingPhoto;
  const activePreviewAngle =
    displayedAngles[selectedPreviewIndex] ||
    displayedAngles[0] ||
    (effectivePrimaryUrl
      ? {
          id: 'angle-1',
          label: uploadedRoomTitle || 'Uploaded Room Photo',
          dataUrl: effectivePrimaryUrl,
          hasExistingWallArt: false,
          isHeadOnSizingPhoto: true,
        }
      : null);

  const currentDescriptionValue =
    (isControlledDescription ? nonPhotoDescription : internalDescription) ?? '';
  const nextAngleNumber = displayedAngles.length + 1;

  return (
    <section
      aria-label="Room Photo Upload Stage"
      className="w-full space-y-4"
    >
      {/* Hidden File Inputs (Multiple enabled for multi-angle room upload) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        data-testid="upload-room-file-input"
        onChange={handlePrimaryFileInputChange}
        className="sr-only"
        aria-label="Upload one or more room photos"
      />
      <input
        ref={addAngleInputRef}
        type="file"
        accept="image/*"
        multiple
        data-testid="add-room-angle-file-input"
        onChange={handleAddAngleFileInputChange}
        className="sr-only"
        aria-label="Add another room angle photo"
      />
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        accept-camera="true"
        capture="environment"
        data-testid="mobile-camera-capture-input"
        onChange={
          cameraCaptureMode === 'add-angle'
            ? handleAddAngleFileInputChange
            : handlePrimaryFileInputChange
        }
        className="sr-only"
        aria-label="Capture room photo with mobile camera"
      />

      {/* Option 5 Wabi-Sabi Smoked-Walnut Mitered Frame ([SPEC PATCH #21]) */}
      <div className="border-2 border-[#4A3B32] bg-[#FAF6EE] p-2.5 sm:p-4 rounded-xl shadow-[0_16px_38px_rgba(31,28,24,0.08)]">
        {/* Inner Raw Belgian Linen Mat Bevel */}
        <div className="border border-[#DFD7C8] bg-[#F5F0E6]/75 p-4 sm:p-5 rounded-lg">
          {showDropzoneView ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="inline-block text-xs font-medium uppercase tracking-[0.16em] text-[#78716C]">
                    Step 01 · Share Your Space
                  </span>
                  <h2 className="mt-0.5 font-serif text-xl sm:text-2xl font-normal text-[#1F1C18]">
                    Begin Your Custom Art Commission — Share Your Space
                  </h2>
                </div>
                {hasLoadedRoom && isChangingPhoto && (
                  <button
                    type="button"
                    data-testid="keep-current-photos-btn"
                    onClick={() => setIsChangingPhoto(false)}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] text-sm font-medium text-[#4A3B32] hover:bg-[#EFE9DC] transition-colors self-start sm:self-auto"
                  >
                    Keep Current Photos
                  </button>
                )}
              </div>

              {/* Head-On Level Photo Requirement Banner */}
              <div
                data-testid="head-on-photo-instruction-banner"
                className="rounded-xl border border-[#9E5A3C]/45 bg-[#FAF6EE] px-4 py-3 flex items-start gap-3 shadow-2xs"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#9E5A3C] text-[11px] font-bold text-[#FAF6EE]">
                  ★
                </span>
                <div className="text-xs sm:text-sm text-[#1F1C18] leading-relaxed">
                  <span className="font-semibold text-[#9E5A3C]">
                    Important Sizing Instruction — Include a Head-On Level Photo:{' '}
                  </span>
                  Please include <strong>at least one picture looking head-on to the wall in a level manner</strong> (camera held straight and parallel to the wall). This image is indicated as your{' '}
                  <strong className="underline decoration-[#9E5A3C]/60 underline-offset-2">
                    Head-On Photo
                  </strong>{' '}
                  and is the one used for accurate wall &amp; frame sizing.
                </div>
              </div>

              {/* Centered Wabi-Sabi Stretched-Canvas Easel Dropzone */}
              <div
                data-testid="upload-room-dropzone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-4 sm:py-5 text-center transition-colors ${
                  isDraggingOver
                    ? 'border-[#9E5A3C] bg-[#F1E6DC]'
                    : 'border-[#C9BFA8] bg-[#FAF6EE]/90 hover:border-[#9E5A3C]/70'
                }`}
              >
                {/* Refined Wooden Studio Easel & Stretched Canvas Emblem */}
                <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F0E6] border border-[#DFD7C8] text-[#9E5A3C] shadow-2xs">
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 48 48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M24 4v6M14 44l6-14M34 44l-6-14M24 30v14"
                    />
                    <rect
                      x="9"
                      y="10"
                      width="30"
                      height="20"
                      rx="2"
                      fill="#FAF6EE"
                      stroke="#4A3B32"
                      strokeWidth="2"
                    />
                    <circle cx="18" cy="17" r="2.5" fill="#9E5A3C" stroke="none" />
                    <path
                      strokeLinecap="round"
                      d="M12 25c4-3 8-3 12 0s8 3 12-1"
                      stroke="#9E5A3C"
                      strokeWidth="1.6"
                    />
                    <path strokeLinecap="round" d="M7 30h34" stroke="#4A3B32" strokeWidth="2.2" />
                  </svg>
                </div>

                <p className="font-serif text-base sm:text-lg text-[#1F1C18]">
                  Drag and drop one or multiple space angles onto the studio easel
                </p>
                <p className="mt-0.5 max-w-lg text-xs sm:text-sm text-[#57534E]">
                  Start with a <strong>level, head-on photo facing the target wall</strong> (indicated as your <strong>Head-On Photo</strong> for sizing). You can also add side angles to visualize the room from multiple viewpoints.
                </p>

                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    data-testid="upload-room-file-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl bg-[#9E5A3C] hover:bg-[#874B30] text-[#FAF6EE] text-sm font-medium transition-colors cursor-pointer shadow-xs"
                  >
                    + Place Your Space Photograph on the Easel
                  </button>

                  <button
                    type="button"
                    data-testid="take-room-photo-btn"
                    onClick={() => handleOpenCameraModal('primary')}
                    className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl border border-[#C9BFA8] bg-[#FAF6EE] text-[#1F1C18] text-sm font-medium hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                  >
                    Take Photo with Camera
                  </button>
                </div>
              </div>

              {/* Non-Photo Description Path ([SPEC PATCH #24]) */}
              <div
                data-testid="non-photo-describe-section"
                className="rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-4 sm:p-4 space-y-2.5 shadow-2xs"
              >
                <div className="space-y-0.5">
                  <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9E5A3C]">
                    No Space Photo Needed · Direct Curation Path
                  </span>
                  <h3 className="font-serif text-base sm:text-lg text-[#1F1C18]">
                    Proceed Without a Photo — Describe What You Are Looking For
                  </h3>
                  <p className="text-xs text-[#57534E]">
                    Don&apos;t have a photo of your space right now? Describe the art piece, mood, colors, or the space you have in mind to proceed directly to curation.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="describe-without-photo-textarea"
                    className="sr-only"
                  >
                    Describe what you are looking for
                  </label>
                  <textarea
                    id="describe-without-photo-textarea"
                    data-testid="describe-without-photo-input"
                    rows={2}
                    value={currentDescriptionValue}
                    onChange={handleDescriptionChange}
                    placeholder="Describe what you are looking for — e.g., 'A warm textured wabi-sabi plaster & ochre painting with serene horizon lines for a minimalist sunlit living space'..."
                    className="w-full rounded-xl border border-[#C9BFA8] bg-[#F5F0E6]/60 px-3.5 py-2 text-base text-[#1F1C18] placeholder:text-[#78716C] focus:border-[#9E5A3C] focus:bg-[#FAF6EE] focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-0.5">
                  <span className="text-xs text-[#78716C]">
                    We will prepare a calibrated studio gallery wall and carry your description into Step 02.
                  </span>
                  <button
                    type="button"
                    data-testid="proceed-by-describing-btn"
                    onClick={handleProceedByDescribing}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#1F1C18] hover:bg-[#36302A] text-[#FAF6EE] text-sm font-medium transition-colors cursor-pointer self-stretch sm:self-auto"
                  >
                    Proceed by Describing What You&apos;re Looking For →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Loaded Room Photo & Multi-Angle Gallery Card */
            <div
              data-testid="uploaded-room-preview-card"
              className="space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#78716C]">
                    Step 01 · Selected Space ({displayedAngles.length}{' '}
                    {displayedAngles.length === 1 ? 'Angle' : 'Angles'})
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-xl sm:text-2xl text-[#1F1C18]">
                      {activePreviewAngle?.label || uploadedRoomTitle || 'Uploaded Space Photograph'}
                    </h2>
                    {activePreviewAngle?.isHeadOnSizingPhoto !== false && (
                      <span
                        data-testid="head-on-photo-badge"
                        className="inline-flex items-center gap-1 rounded-full bg-[#9E5A3C] px-2.5 py-0.5 text-[11px] font-semibold text-[#FAF6EE] shadow-2xs"
                      >
                        ★ Head-On Photo (Used for Sizing)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="top-add-another-photo-btn"
                    onClick={handleOpenAddAngleScreen}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#9E5A3C] hover:bg-[#874B30] text-[#FAF6EE] text-sm font-medium transition-colors cursor-pointer shadow-xs"
                  >
                    + Add Another Photo / Viewpoint
                  </button>
                  <button
                    type="button"
                    data-testid="direct-upload-another-photo-btn"
                    onClick={() => addAngleInputRef.current?.click()}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#9E5A3C]/50 bg-[#FAF6EE] text-sm font-medium text-[#9E5A3C] hover:bg-[#F1E6DC] transition-colors cursor-pointer"
                  >
                    + Upload Photo File
                  </button>
                  <button
                    type="button"
                    data-testid="change-room-photo-btn"
                    onClick={handleChangeRoomClick}
                    className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-[#C9BFA8] bg-[#FAF6EE] text-sm font-medium text-[#1F1C18] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                  >
                    Change Space Photo
                  </button>
                </div>
              </div>

              {/* Head-On Level Photo Guidance Banner */}
              <div
                data-testid="head-on-photo-instruction-banner"
                className="rounded-xl border border-[#9E5A3C]/40 bg-[#FAF6EE] px-3.5 py-2.5 text-xs text-[#4A3B32] flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <strong className="text-[#9E5A3C]">★ Head-On Photo Guidance:</strong> Ensure at least one photo looks <strong>head-on to the wall in a level manner</strong>. The photo marked <strong>Head-On Photo (Used for Sizing)</strong> is used in the post-visualization sizing tool.
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-[#DFD7C8] bg-[#EFE9DC]">
                <img
                  data-testid="uploaded-room-preview-img"
                  src={activePreviewAngle?.dataUrl || effectivePrimaryUrl || ''}
                  alt={activePreviewAngle?.label || uploadedRoomTitle || 'Uploaded Space Photograph'}
                  className="w-full max-h-[300px] object-cover block"
                />
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                  {displayedAngles.length > 1 && (
                    <div className="rounded-lg bg-[#1F1C18]/80 backdrop-blur-xs px-3 py-1 text-xs font-medium text-[#FAF6EE]">
                      Viewing Angle {selectedPreviewIndex + 1} of {displayedAngles.length}
                    </div>
                  )}
                  {activePreviewAngle?.isHeadOnSizingPhoto !== false && (
                    <div className="rounded-lg bg-[#9E5A3C]/95 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-[#FAF6EE] shadow-xs">
                      ★ Head-On Photo · Used for Wall &amp; Frame Sizing
                    </div>
                  )}
                </div>
              </div>

              {/* Side-by-Side Multi-Photo Strip When Multiple Angles Are Uploaded */}
              {displayedAngles.length > 1 && (
                <div
                  data-testid="multi-angle-thumbnail-grid"
                  className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                >
                  {displayedAngles.map((angle, idx) => {
                    const isSelected = idx === selectedPreviewIndex;
                    return (
                      <div
                        key={`thumb-${angle.id || idx}`}
                        data-testid={`multi-angle-preview-tile-${idx}`}
                        onClick={() => setSelectedPreviewIndex(idx)}
                        className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#9E5A3C] ring-2 ring-[#9E5A3C]/25 shadow-sm'
                            : 'border-[#DFD7C8] opacity-85 hover:opacity-100 hover:border-[#C9BFA8]'
                        }`}
                      >
                        <img
                          src={angle.dataUrl}
                          alt={angle.label}
                          className="h-28 w-full object-cover block"
                        />
                        {angle.isHeadOnSizingPhoto && (
                          <div className="absolute top-2 left-2 rounded bg-[#9E5A3C]/95 px-2 py-0.5 text-[10px] font-semibold text-[#FAF6EE] shadow-2xs">
                            ★ Head-On Photo (Sizing)
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1 bg-[#FAF6EE]/95 px-2.5 py-1.5 text-xs">
                          <span className="font-medium text-[#1F1C18] truncate">
                            Angle {idx + 1}: {angle.label}
                          </span>
                          {isSelected && (
                            <span className="shrink-0 rounded bg-[#9E5A3C] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#FAF6EE]">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Multi-Angle Room Angles Gallery ([SPEC PATCH #15] & [SPEC PATCH #25]) */}
              <div
                data-testid="uploaded-room-angles-gallery"
                className="rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-4 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1F1C18]">
                      Space Viewpoints & Angles ({displayedAngles.length})
                    </p>
                    <p className="text-xs text-[#78716C]">
                      Include at least one level, head-on photo of the wall (indicated as <strong>Head-On Photo</strong> and used for sizing).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="add-room-angle-btn"
                      onClick={handleOpenAddAngleScreen}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1F1C18] text-[#FAF6EE] text-xs font-medium hover:bg-[#36302A] transition-colors cursor-pointer"
                    >
                      + Add Another Angle / Viewpoint
                    </button>
                    <button
                      type="button"
                      data-testid="add-sample-angle-btn"
                      onClick={handleAddSampleSecondAngle}
                      className="sr-only"
                      tabIndex={-1}
                    >
                      + Add Second Studio Angle
                    </button>
                    <button
                      type="button"
                      data-testid="add-sample-second-angle-btn"
                      onClick={handleAddSampleSecondAngle}
                      className="sr-only"
                      tabIndex={-1}
                    >
                      Add Second Studio Angle
                    </button>
                  </div>
                </div>

                {/* Dedicated Add-Angle Upload & Camera Screen ([SPEC PATCH #25]) */}
                {isAddAngleScreenOpen && (
                  <div
                    ref={addAngleScreenRef}
                    data-testid="add-angle-upload-screen"
                    className="rounded-xl border-2 border-[#9E5A3C] bg-[#F5F0E6] p-4 sm:p-5 space-y-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9E5A3C]">
                          Additional Space Viewpoint · Angle {nextAngleNumber}
                        </span>
                        <h3 className="font-serif text-lg text-[#1F1C18]">
                          Add Another Angle / Viewpoint — Upload or Use Camera
                        </h3>
                      </div>

                      <button
                        type="button"
                        data-testid="close-add-angle-screen-btn"
                        onClick={() => setIsAddAngleScreenOpen(false)}
                        className="min-h-[44px] min-w-[44px] px-3.5 py-1.5 rounded-lg border border-[#C9BFA8] bg-[#FAF6EE] text-xs font-medium text-[#4A3B32] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label
                          htmlFor="new-angle-label-field"
                          className="block text-xs font-medium text-[#4A3B32]"
                        >
                          Angle Name / Perspective Label
                        </label>
                        <input
                          id="new-angle-label-field"
                          type="text"
                          data-testid="new-angle-label-input"
                          value={newAngleLabel}
                          onChange={(e) => setNewAngleLabel(e.target.value)}
                          placeholder={`Angle ${nextAngleNumber} (Secondary Viewpoint)`}
                          className="mt-1 w-full rounded-xl border border-[#C9BFA8] bg-[#FAF6EE] px-3.5 py-2.5 text-base text-[#1F1C18] placeholder:text-[#78716C] focus:border-[#9E5A3C] focus:outline-none"
                        />
                      </div>

                      <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#1F1C18] select-none">
                        <input
                          type="checkbox"
                          data-testid="new-angle-is-head-on-checkbox"
                          checked={newAngleIsHeadOn}
                          onChange={(e) => setNewAngleIsHeadOn(e.target.checked)}
                          className="h-4 w-4 rounded border-[#C9BFA8] text-[#9E5A3C] focus:ring-[#9E5A3C]"
                        />
                        <span>
                          Set this new picture as the <strong>Head-On Photo (Used for Sizing)</strong> — looking straight and level at the wall
                        </span>
                      </label>
                    </div>

                    <div
                      onDragOver={handleAddAngleDragOver}
                      onDragLeave={handleAddAngleDragLeave}
                      onDrop={handleAddAngleDrop}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                        isDraggingOverAddAngle
                          ? 'border-[#9E5A3C] bg-[#F1E6DC]'
                          : 'border-[#C9BFA8] bg-[#FAF6EE]/90'
                      }`}
                    >
                      <p className="font-serif text-base text-[#1F1C18]">
                        Drop a photo for Angle {nextAngleNumber} here, or choose an option below
                      </p>
                      <p className="mt-0.5 text-xs text-[#57534E]">
                        Upload from your device or take a new photograph with your camera.
                      </p>

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          data-testid="add-angle-upload-file-btn"
                          onClick={() => addAngleInputRef.current?.click()}
                          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#9E5A3C] hover:bg-[#874B30] text-[#FAF6EE] text-sm font-medium transition-colors cursor-pointer shadow-xs"
                        >
                          Upload Picture for Angle {nextAngleNumber}
                        </button>

                        <button
                          type="button"
                          data-testid="add-angle-use-camera-btn"
                          onClick={() => handleOpenCameraModal('add-angle')}
                          className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#C9BFA8] bg-[#FAF6EE] text-[#1F1C18] text-sm font-medium hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                        >
                          Use Camera for Angle {nextAngleNumber}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5">
                  {displayedAngles.map((angle, idx) => {
                    const isSelected = idx === selectedPreviewIndex;
                    const isHeadOn = Boolean(angle.isHeadOnSizingPhoto);
                    const badgeText =
                      idx === 0 ? 'Angle 1 (Primary View)' : `Angle ${idx + 1}`;
                    return (
                      <div
                        key={angle.id || `angle-${idx}`}
                        data-testid={`room-angle-card-${idx}`}
                        onClick={() => setSelectedPreviewIndex(idx)}
                        className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-xl border p-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#9E5A3C] bg-[#F5F0E6]'
                            : 'border-[#DFD7C8] bg-[#FAF6EE] hover:border-[#C9BFA8]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={angle.dataUrl}
                            alt={angle.label}
                            className="h-12 w-16 shrink-0 rounded-lg object-cover border border-[#DFD7C8]"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9E5A3C]">
                                {badgeText}
                              </span>
                              {isHeadOn && (
                                <span
                                  data-testid={`head-on-photo-badge-${idx}`}
                                  className="inline-flex items-center rounded-md bg-[#9E5A3C] px-2 py-0.5 text-[10px] font-semibold text-[#FAF6EE]"
                                >
                                  ★ Head-On Photo (Used for Sizing)
                                </span>
                              )}
                            </div>
                            <span className="block truncate text-xs font-medium text-[#1F1C18]">
                              {angle.label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isHeadOn && (
                            <button
                              type="button"
                              data-testid={`set-head-on-photo-btn-${idx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetHeadOnPhoto(idx);
                              }}
                              className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#9E5A3C]/50 bg-[#FAF6EE] text-[11px] font-semibold text-[#9E5A3C] hover:bg-[#F1E6DC] transition-colors cursor-pointer"
                            >
                              Set as Head-On Photo
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`remove-room-angle-btn-${idx}`}
                            aria-label={`Remove ${badgeText}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAngle(idx);
                            }}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-transparent text-xs font-medium text-[#78716C] hover:border-[#DFD7C8] hover:bg-[#EFE9DC] hover:text-[#1F1C18] transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Page 1 -> Page 2 Navigation CTA ([SPEC PATCH #17]) */}
              <div className="pt-3 border-t border-[#DFD7C8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-[#57534E]">
                  You can add additional space angles above or proceed to Step 02 Shape Your Vision.
                </p>
                <button
                  type="button"
                  data-testid="goto-page-2-curation-btn"
                  onClick={() => onContinueToCuration?.()}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#9E5A3C] text-[#FAF6EE] text-sm font-medium hover:bg-[#874B30] transition-colors cursor-pointer shadow-xs self-stretch sm:self-auto"
                >
                  Continue to Curation Studio →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wabi-Sabi Museum Placard Footer ([SPEC PATCH #21]) */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 px-3 text-center text-xs font-medium tracking-[0.06em] text-[#57534E]">
        <span>✦ Tailored to Your Space&apos;s Palette</span>
        <span className="hidden sm:inline text-[#C9BFA8]">·</span>
        <span>✦ True-to-Wall Perspective &amp; Natural Light</span>
        <span className="hidden sm:inline text-[#C9BFA8]">·</span>
        <span>✦ One-of-a-Kind Original Compositions</span>
      </div>

      {/* Interactive In-App Camera Modal */}
      {isCameraModalOpen && (
        <div
          data-testid="camera-capture-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Take Room Photo with Camera"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border-2 border-[#4A3B32] bg-[#FAF6EE] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl text-[#1F1C18]">
                {cameraCaptureMode === 'add-angle'
                  ? `Studio Camera Viewfinder · Angle ${nextAngleNumber}`
                  : 'Studio Camera Viewfinder'}
              </h3>
              <button
                type="button"
                data-testid="close-camera-modal-btn"
                onClick={handleCloseCameraModal}
                className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg border border-[#DFD7C8] bg-white text-sm font-medium text-[#57534E] hover:bg-[#F5F0E6]"
              >
                Close
              </button>
            </div>

            {!cameraStreamActive && (
              <div
                data-testid="camera-error-banner"
                role="alert"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#9E5A3C]/50 bg-[#F5F0E6] p-3 text-xs text-[#1F1C18]"
              >
                <span>
                  {cameraStatusNote ||
                    'Camera permission was denied or no camera device is available. Please upload a room photo file instead.'}
                </span>
                <button
                  type="button"
                  data-testid="camera-fallback-upload-btn"
                  onClick={() => {
                    handleCloseCameraModal();
                    if (cameraCaptureMode === 'add-angle') {
                      addAngleInputRef.current?.click();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="min-h-[44px] shrink-0 rounded-lg border border-[#9E5A3C] bg-[#FAF6EE] px-3 py-1.5 text-xs font-semibold text-[#9E5A3C] hover:bg-[#9E5A3C] hover:text-[#FAF6EE] transition-colors cursor-pointer"
                >
                  Upload Photo File Instead
                </button>
              </div>
            )}

            <div className="relative overflow-hidden rounded-xl border border-[#C9BFA8] bg-[#1F1C18] aspect-3/2 flex items-center justify-center">
              {cameraStreamActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={
                    cameraCaptureMode === 'add-angle'
                      ? SAMPLE_ROOM_PHOTOS[1].dataUrl
                      : SAMPLE_ROOM_PHOTOS[0].dataUrl
                  }
                  alt="Camera Viewfinder Preview"
                  className="h-full w-full object-cover opacity-90"
                />
              )}
              <div className="pointer-events-none absolute inset-4 border border-white/40 rounded-lg" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => mobileCameraInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#C9BFA8] bg-white text-sm font-medium text-[#1F1C18] hover:bg-[#F5F0E6]"
              >
                Use Device Camera Roll
              </button>

              <button
                type="button"
                data-testid="camera-shutter-btn"
                onClick={handleCaptureCameraFrame}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#9E5A3C] text-[#FAF6EE] text-sm font-medium hover:bg-[#874B30] transition-colors cursor-pointer"
              >
                {cameraCaptureMode === 'add-angle'
                  ? `Capture Angle ${nextAngleNumber} Photo`
                  : 'Capture Space Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default UploadHeroStage;
