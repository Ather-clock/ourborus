export type ProjectMode = 'presentation' | 'whiteboard';
export type AspectRatio = '16:9' | '4:3' | '1:1';
export type SlideTransition = 'none' | 'fade' | 'slide';

export type ElementType =
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'star'
  | 'hexagon'
  | 'callout'
  | 'sticky'
  | 'text'
  | 'freedraw'
  | 'line'
  | 'arrow'
  | 'image'
  | 'symbol'
  | 'frame';

export type ToolType = 'select' | 'hand' | 'highlighter' | 'eraser' | ElementType;

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid' | 'zigzag' | 'dots' | 'none';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FontFamily = 'sketch' | 'sans' | 'serif' | 'mono';
export type TextAlign = 'left' | 'center' | 'right';
export type ArrowCurveType = 'straight' | 'curved' | 'elbow';
export type ArrowHeadType = 'none' | 'arrow' | 'dot' | 'diamond' | 'bar';
export type PortSide = 'top' | 'right' | 'bottom' | 'left' | 'center';
export type GridType = 'dots' | 'lines' | 'none';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface ElementBinding {
  elementId: string;
  port: PortSide;
}

export interface StickyReaction {
  label: string;
  count: number;
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  strokeColor: string;
  fillColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number; // 0 = Clean Vector, 1.2 = Hand-Drawn (default), 2.4 = Extra Sketchy
  cornerRadius: number;
  seed: number;
  locked?: boolean;
  hidden?: boolean;
  groupId?: string | null;
  frameId?: string | null;

  // Typography & Labels
  text?: string;
  fontFamily?: FontFamily;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: TextAlign;
  textColor?: string;

  // Linear & Freedraw
  points?: Point[];
  isHighlighter?: boolean;
  startBinding?: ElementBinding | null;
  endBinding?: ElementBinding | null;
  startArrowhead?: ArrowHeadType;
  endArrowhead?: ArrowHeadType;
  curveType?: ArrowCurveType;

  // Media
  imageUrl?: string;
  imageName?: string;

  // Symbols
  symbolId?: string;
  symbolPaths?: string[];
  symbolViewBox?: number;

  // Miro Sticky Reactions
  reactions?: StickyReaction[];
}

export interface Slide {
  id: string;
  title: string;
  background: string;
  elements: CanvasElement[];
  notes: string;
  transition: SlideTransition;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface GridSettings {
  enabled: boolean;
  snap: boolean;
  size: number;
  type: GridType;
}

export interface CustomSymbol {
  id: string;
  name: string;
  category: 'custom';
  tags: string[];
  elements: CanvasElement[];
  createdAt: number;
}

export interface ProjectDocument {
  id: string;
  title: string;
  mode: ProjectMode;
  aspectRatio: AspectRatio;
  createdAt: number;
  updatedAt: number;
  slides: Slide[];
  activeSlideId: string;
  boardElements: CanvasElement[];
  boardBackground: string;
  viewport: ViewportState;
  grid: GridSettings;
}

export interface SymbolDefinition {
  id: string;
  name: string;
  category: 'flowchart' | 'cloud' | 'wireframe' | 'miro' | 'accents';
  tags: string[];
  viewBox: number;
  paths: string[];
  defaultFill?: string;
  defaultStroke?: string;
}

export interface TemplateDefinition {
  id: string;
  title: string;
  subtitle: string;
  mode: ProjectMode;
  aspectRatio: AspectRatio;
  category: string;
  createProject: () => ProjectDocument;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
}

export interface SmartGuide {
  axis: 'x' | 'y';
  position: number;
  start: number;
  end: number;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

export interface SearchResultItem {
  id: string;
  kind: 'element' | 'slide' | 'symbol' | 'template';
  title: string;
  subtitle: string;
  targetId: string;
  slideId?: string;
}
