/**
 * Board design-system kit — shared primitives every frame composes so the board
 * speaks one visual language (hero + tiles + tabs). See
 * .planning/quick/260531-board-redesign-v2/PLAN.md for the design contract.
 */
export { Delta, type DeltaProps } from './Delta';
export { FrameHero, type FrameHeroProps, type HeroTone } from './FrameHero';
export { StatTile, StatTileRow, type StatTileData } from './StatTile';
export { FrameTabs, FrameTabPanel, type FrameTab, type FrameTabsProps } from './FrameTabs';
export { TrendChart, type TrendChartProps, type TrendPoint } from './TrendChart';
export { MiniSparkline, type MiniSparklineProps } from './MiniSparkline';
export { DataTable, type DataColumn, type DataTableProps } from './DataTable';
export { PersonaGraph, type PersonaGraphProps, type PersonaNode } from './PersonaGraph';
export { KeyframeImage, type KeyframeImageProps } from './KeyframeImage';
export { resolveKeyframeUrl, type KeyframeSegmentLike } from './keyframe';
