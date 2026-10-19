import { RoomAngleAsset, WallPlacementAction } from '../../contracts/masterContract';

export interface SampleRoomPhoto {
  id: string;
  name: string;
  subtitle: string;
  hasExistingWallArt: boolean;
  suggestedPlacementAction: WallPlacementAction;
  dataUrl: string;
  angles: RoomAngleAsset[];
}

interface RoomRenderBlueprint {
  id: string;
  name: string;
  subtitle: string;
  hasExistingWallArt: boolean;
  suggestedPlacementAction: WallPlacementAction;
  wallTopHex: string;
  wallBottomHex: string;
  wainscotHex: string;
  floorHex: string;
  floorPlankHex: string;
  furniturePrimaryHex: string;
  furnitureSecondaryHex: string;
  accentWoodHex: string;
  sunlightRgba: string;
  roomKind: 'linen-living' | 'walnut-study-existing-art' | 'limestone-lounge';
}

const SAMPLE_ROOM_BLUEPRINTS: RoomRenderBlueprint[] = [
  {
    id: 'sample-nordic-linen-living',
    name: 'Sunlit Linen Living Salon',
    subtitle: '2 Room Angles · Open Plaster Wall & Bouclé Sofa (Ideal for Add Art)',
    hasExistingWallArt: false,
    suggestedPlacementAction: 'add-only',
    wallTopHex: '#F3EFE6',
    wallBottomHex: '#E5DEC9',
    wainscotHex: '#DDD5C4',
    floorHex: '#C7AF8E',
    floorPlankHex: '#B29672',
    furniturePrimaryHex: '#EAE3D5',
    furnitureSecondaryHex: '#D6CCB8',
    accentWoodHex: '#8C6747',
    sunlightRgba: 'rgba(255, 248, 228, 0.38)',
    roomKind: 'linen-living',
  },
  {
    id: 'sample-walnut-gallery-study',
    name: 'Mid-Century Walnut Study',
    subtitle: '2 Room Angles · Includes Existing Framed Wall Art (Ideal for Replace or Both)',
    hasExistingWallArt: true,
    suggestedPlacementAction: 'replace-existing',
    wallTopHex: '#EAE4D8',
    wallBottomHex: '#D8CFC0',
    wainscotHex: '#CFC5B4',
    floorHex: '#8D6646',
    floorPlankHex: '#6E4D32',
    furniturePrimaryHex: '#5B3E29',
    furnitureSecondaryHex: '#3F2A1B',
    accentWoodHex: '#B6895B',
    sunlightRgba: 'rgba(255, 239, 205, 0.34)',
    roomKind: 'walnut-study-existing-art',
  },
  {
    id: 'sample-limestone-oak-lounge',
    name: 'Minimalist Limestone & Oak Lounge',
    subtitle: '2 Room Angles · Wide Architectural Gallery Wall (Ideal for Add Art)',
    hasExistingWallArt: false,
    suggestedPlacementAction: 'add-only',
    wallTopHex: '#EFECE6',
    wallBottomHex: '#DFDBD2',
    wainscotHex: '#D5D0C5',
    floorHex: '#CBB99F',
    floorPlankHex: '#B39F82',
    furniturePrimaryHex: '#C47D5B',
    furnitureSecondaryHex: '#A56343',
    accentWoodHex: '#7A5C43',
    sunlightRgba: 'rgba(255, 250, 238, 0.42)',
    roomKind: 'limestone-lounge',
  },
];

function buildSvgFallbackDataUrl(
  blueprint: RoomRenderBlueprint,
  angleVariant: 'main' | 'side' = 'main'
): string {
  const isSide = angleVariant === 'side';
  const shiftX = isSide ? 76 : 0;

  const existingArtSvg = blueprint.hasExistingWallArt
    ? `
      <g id="existing-wall-art-${angleVariant}">
        <rect x="${468 + shiftX}" y="138" width="344" height="252" rx="3" fill="rgba(28, 22, 16, 0.18)" transform="translate(8, 12)" />
        <rect x="${468 + shiftX}" y="138" width="344" height="252" rx="2" fill="#3A281B" stroke="#24180F" stroke-width="4" />
        <rect x="${484 + shiftX}" y="154" width="312" height="220" fill="#F4EFE6" />
        <rect x="${512 + shiftX}" y="180" width="256" height="168" fill="#D9CEBE" />
        <circle cx="${600 + shiftX}" cy="252" r="46" fill="#7D8C89" opacity="0.75" />
        <path d="M${512 + shiftX} 318 Q${585 + shiftX} 268 ${655 + shiftX} 305 T${768 + shiftX} 292 L${768 + shiftX} 348 L${512 + shiftX} 348 Z" fill="#546360" opacity="0.82" />
      </g>
    `
    : '';

  const sideCornerSvg = isSide
    ? `<polygon points="0,0 185,48 185,595 0,630" fill="rgba(110, 98, 82, 0.14)" />
       <line x1="185" y1="0" x2="185" y2="630" stroke="rgba(90, 78, 64, 0.25)" stroke-width="2" />`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 860" width="1280" height="860">
    <defs>
      <linearGradient id="wallGrad-${blueprint.id}-${angleVariant}" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stop-color="${blueprint.wallTopHex}" />
        <stop offset="100%" stop-color="${blueprint.wallBottomHex}" />
      </linearGradient>
      <linearGradient id="floorGrad-${blueprint.id}-${angleVariant}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${blueprint.floorHex}" />
        <stop offset="100%" stop-color="${blueprint.floorPlankHex}" />
      </linearGradient>
    </defs>
    <!-- Main architectural wall -->
    <rect x="0" y="0" width="1280" height="630" fill="url(#wallGrad-${blueprint.id}-${angleVariant})" />
    ${sideCornerSvg}
    <!-- Diagonal window sunlight beam -->
    <polygon points="${isSide ? '185,0 740,0 1080,630 280,630' : '0,0 560,0 920,630 140,630'}" fill="${blueprint.sunlightRgba}" />
    <!-- Wainscoting / architectural molding -->
    <rect x="0" y="545" width="1280" height="85" fill="${blueprint.wainscotHex}" />
    <line x1="0" y1="545" x2="1280" y2="545" stroke="#FAF7F0" stroke-width="3" opacity="0.7" />
    <!-- Hardwood / travertine floor -->
    <rect x="0" y="630" width="1280" height="230" fill="url(#floorGrad-${blueprint.id}-${angleVariant})" />
    ${existingArtSvg}
    <!-- Furniture anchor (sofa / credenza) -->
    <rect x="${270 + shiftX}" y="555" width="740" height="165" rx="22" fill="rgba(25,20,15,0.16)" transform="translate(10, 14)" />
    <rect x="${270 + shiftX}" y="555" width="740" height="150" rx="20" fill="${blueprint.furniturePrimaryHex}" />
    <rect x="${295 + shiftX}" y="505" width="690" height="72" rx="18" fill="${blueprint.furnitureSecondaryHex}" />
    <rect x="${330 + shiftX}" y="705" width="18" height="36" rx="4" fill="${blueprint.accentWoodHex}" />
    <rect x="${932 + shiftX}" y="705" width="18" height="36" rx="4" fill="${blueprint.accentWoodHex}" />
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function renderRoomOnCanvas(
  blueprint: RoomRenderBlueprint,
  angleVariant: 'main' | 'side' = 'main'
): string {
  if (typeof document === 'undefined') {
    return buildSvgFallbackDataUrl(blueprint, angleVariant);
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 860;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return buildSvgFallbackDataUrl(blueprint, angleVariant);
    }

    const width = canvas.width;
    const height = canvas.height;
    const floorTopY = 632;
    const isSide = angleVariant === 'side';
    const shiftX = isSide ? 76 : 0;

    // 1. Architectural wall gradient
    const wallGrad = ctx.createLinearGradient(0, 0, width * 0.25, floorTopY);
    wallGrad.addColorStop(0, blueprint.wallTopHex);
    wallGrad.addColorStop(1, blueprint.wallBottomHex);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, floorTopY);

    // Optional side-angle architectural return wall on the left
    if (isSide) {
      ctx.fillStyle = 'rgba(110, 96, 80, 0.13)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(185, 0);
      ctx.lineTo(185, floorTopY);
      ctx.lineTo(0, floorTopY + 35);
      ctx.closePath();
      ctx.fill();

      // Side window architectural frame on left return wall
      ctx.fillStyle = 'rgba(255, 250, 238, 0.58)';
      ctx.fillRect(28, 86, 112, 340);
      ctx.strokeStyle = 'rgba(120, 106, 90, 0.35)';
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 86, 112, 340);
    }

    // 2. Subtle plaster & architectural panel molding lines
    ctx.strokeStyle = 'rgba(120, 108, 92, 0.14)';
    ctx.lineWidth = 2;
    const panelMargins = [90 + shiftX, 390 + shiftX, 890 + shiftX, 1190];
    for (let i = 0; i < panelMargins.length; i += 2) {
      const left = panelMargins[i];
      const right = panelMargins[i + 1];
      if (right > left + 40) {
        ctx.strokeRect(left, 56, right - left, 456);
      }
    }

    // 3. Natural diagonal window sunlight wash across wall
    ctx.save();
    const sunGrad = ctx.createLinearGradient(120 + shiftX, 0, 880 + shiftX, floorTopY);
    sunGrad.addColorStop(0, blueprint.sunlightRgba);
    sunGrad.addColorStop(0.65, 'rgba(255, 248, 232, 0.14)');
    sunGrad.addColorStop(1, 'rgba(255, 248, 232, 0.0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.moveTo(40 + shiftX, 0);
    ctx.lineTo(620 + shiftX, 0);
    ctx.lineTo(1010 + shiftX, floorTopY);
    ctx.lineTo(220 + shiftX, floorTopY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Wainscot / Baseboard dado rail
    ctx.fillStyle = blueprint.wainscotHex;
    ctx.fillRect(0, 548, width, floorTopY - 548);
    ctx.fillStyle = 'rgba(255, 252, 246, 0.65)';
    ctx.fillRect(0, 546, width, 3);
    ctx.fillStyle = 'rgba(85, 72, 58, 0.18)';
    ctx.fillRect(0, 549, width, 2);

    // 5. Hardwood / Limestone floor with perspective planks
    const floorGrad = ctx.createLinearGradient(0, floorTopY, 0, height);
    floorGrad.addColorStop(0, blueprint.floorHex);
    floorGrad.addColorStop(1, blueprint.floorPlankHex);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorTopY, width, height - floorTopY);

    ctx.strokeStyle = 'rgba(58, 42, 28, 0.14)';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 10; i++) {
      const topX = 140 + i * 115 + shiftX * 0.4;
      const bottomX = -120 + i * 165 + shiftX * 0.6;
      ctx.beginPath();
      ctx.moveTo(topX, floorTopY);
      ctx.lineTo(bottomX, height);
      ctx.stroke();
    }

    // Soft woven area rug
    ctx.fillStyle = 'rgba(244, 239, 229, 0.72)';
    ctx.fillRect(190 + shiftX * 0.6, 708, 900, 136);
    ctx.strokeStyle = 'rgba(160, 145, 126, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(198 + shiftX * 0.6, 714, 884, 124);

    // 6. If Room #2 (hasExistingWallArt === true), render an existing framed wall print at eye level
    if (blueprint.hasExistingWallArt) {
      const frameX = 468 + shiftX;
      const frameY = 136;
      const frameW = 344;
      const frameH = 252;

      // Cast wall shadow
      ctx.fillStyle = 'rgba(28, 22, 16, 0.22)';
      ctx.fillRect(frameX + 10, frameY + 14, frameW, frameH);

      // Outer walnut frame
      ctx.fillStyle = '#3B281A';
      ctx.fillRect(frameX, frameY, frameW, frameH);

      // Archival matboard
      ctx.fillStyle = '#F3EFE6';
      ctx.fillRect(frameX + 16, frameY + 16, frameW - 32, frameH - 32);

      // Inner existing muted vintage print (to be replaced by AI)
      const innerX = frameX + 42;
      const innerY = frameY + 38;
      const innerW = frameW - 84;
      const innerH = frameH - 76;

      ctx.fillStyle = '#D9CEBE';
      ctx.fillRect(innerX, innerY, innerW, innerH);

      // Muted geometric horizon inside existing art
      ctx.fillStyle = '#7E8E8A';
      ctx.beginPath();
      ctx.arc(innerX + innerW * 0.38, innerY + innerH * 0.44, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#53625F';
      ctx.beginPath();
      ctx.moveTo(innerX, innerY + innerH * 0.76);
      ctx.quadraticCurveTo(
        innerX + innerW * 0.45,
        innerY + innerH * 0.52,
        innerX + innerW,
        innerY + innerH * 0.7
      );
      ctx.lineTo(innerX + innerW, innerY + innerH);
      ctx.lineTo(innerX, innerY + innerH);
      ctx.closePath();
      ctx.fill();
    }

    // 7. Architectural Furniture Anchor (Sofa or Mid-Century Credenza)
    if (blueprint.roomKind === 'walnut-study-existing-art') {
      const credenzaX = 300 + shiftX;
      const credenzaY = 515;
      const credenzaW = 680;
      const credenzaH = 148;

      ctx.fillStyle = 'rgba(22, 16, 10, 0.24)';
      ctx.fillRect(credenzaX + 12, credenzaY + 16, credenzaW, credenzaH + 28);

      ctx.fillStyle = '#3A2618';
      ctx.fillRect(credenzaX + 36, credenzaY + credenzaH, 16, 52);
      ctx.fillRect(credenzaX + credenzaW - 52, credenzaY + credenzaH, 16, 52);

      ctx.fillStyle = blueprint.furniturePrimaryHex;
      ctx.fillRect(credenzaX, credenzaY, credenzaW, credenzaH);

      ctx.strokeStyle = blueprint.furnitureSecondaryHex;
      ctx.lineWidth = 3;
      ctx.strokeRect(credenzaX + 12, credenzaY + 12, credenzaW - 24, credenzaH - 24);
      ctx.beginPath();
      ctx.moveTo(credenzaX + credenzaW / 3, credenzaY + 12);
      ctx.lineTo(credenzaX + credenzaW / 3, credenzaY + credenzaH - 12);
      ctx.moveTo(credenzaX + (credenzaW * 2) / 3, credenzaY + 12);
      ctx.lineTo(credenzaX + (credenzaW * 2) / 3, credenzaY + credenzaH - 12);
      ctx.stroke();

      ctx.fillStyle = '#E8E0D2';
      ctx.beginPath();
      ctx.ellipse(credenzaX + 110, credenzaY - 26, 26, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#C9B99F';
      ctx.fillRect(credenzaX + credenzaW - 180, credenzaY - 18, 120, 18);
    } else {
      const sofaX = 250 + shiftX;
      const sofaY = 500;
      const sofaW = 780;

      ctx.fillStyle = 'rgba(25, 20, 15, 0.22)';
      ctx.fillRect(sofaX + 14, sofaY + 185, sofaW - 10, 42);

      ctx.fillStyle = blueprint.furnitureSecondaryHex;
      ctx.fillRect(sofaX + 28, sofaY, sofaW - 56, 105);

      ctx.fillStyle = blueprint.furniturePrimaryHex;
      ctx.fillRect(sofaX, sofaY + 62, 48, 138);
      ctx.fillRect(sofaX + sofaW - 48, sofaY + 62, 48, 138);
      ctx.fillRect(sofaX + 40, sofaY + 86, sofaW - 80, 114);

      ctx.strokeStyle = 'rgba(90, 75, 60, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sofaX + sofaW / 2, sofaY + 4);
      ctx.lineTo(sofaX + sofaW / 2, sofaY + 200);
      ctx.stroke();

      ctx.fillStyle = blueprint.accentWoodHex;
      ctx.fillRect(sofaX + 34, sofaY + 200, 18, 22);
      ctx.fillRect(sofaX + sofaW - 52, sofaY + 200, 18, 22);
    }

    // 8. Architectural indoor olive/ficus plant
    const plantBaseX = isSide ? 188 : 92;
    ctx.fillStyle = '#D8CFC0';
    ctx.fillRect(plantBaseX, 578, 86, 98);
    ctx.fillStyle = '#4B6048';
    const leafCenters: Array<[number, number, number]> = [
      [plantBaseX + 43, 515, 34],
      [plantBaseX + 13, 540, 28],
      [plantBaseX + 73, 538, 30],
      [plantBaseX + 33, 478, 26],
      [plantBaseX + 62, 492, 24],
    ];
    for (const [lx, ly, lr] of leafCenters) {
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 128) {
      return buildSvgFallbackDataUrl(blueprint, angleVariant);
    }
    return dataUrl;
  } catch {
    return buildSvgFallbackDataUrl(blueprint, angleVariant);
  }
}

let cachedSampleRooms: SampleRoomPhoto[] | null = null;

export function generateSampleRoomPhotos(): SampleRoomPhoto[] {
  if (cachedSampleRooms && cachedSampleRooms.length === 3) {
    return cachedSampleRooms.map((room) => ({
      ...room,
      angles: room.angles.map((angle) => ({ ...angle })),
    }));
  }

  const generated: SampleRoomPhoto[] = SAMPLE_ROOM_BLUEPRINTS.map((blueprint) => {
    const mainWallDataUrl = renderRoomOnCanvas(blueprint, 'main');
    const sidePerspectiveDataUrl = renderRoomOnCanvas(blueprint, 'side');

    const angles: RoomAngleAsset[] = [
      {
        id: `${blueprint.id}-angle-1`,
        label: 'Angle 1 (Main Wall)',
        dataUrl: mainWallDataUrl,
        hasExistingWallArt: blueprint.hasExistingWallArt,
      },
      {
        id: `${blueprint.id}-angle-2`,
        label: 'Angle 2 (Side Perspective)',
        dataUrl: sidePerspectiveDataUrl,
        hasExistingWallArt: blueprint.hasExistingWallArt,
      },
    ];

    return {
      id: blueprint.id,
      name: blueprint.name,
      subtitle: blueprint.subtitle,
      hasExistingWallArt: blueprint.hasExistingWallArt,
      suggestedPlacementAction: blueprint.suggestedPlacementAction,
      dataUrl: mainWallDataUrl,
      angles,
    };
  });

  cachedSampleRooms = generated;
  return generated.map((room) => ({
    ...room,
    angles: room.angles.map((angle) => ({ ...angle })),
  }));
}
