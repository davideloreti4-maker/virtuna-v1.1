// Barrel for the Reading namespace (02-05). Named-export convention mirrors
// board/_kit/index.ts. The container is the public entry; the leaves are exported
// for Phase-3 (rich drill-downs), Phase-4 (stage-reveal), and Phase-5 (follow-up)
// reuse without reaching into individual files.

export { Reading } from './reading';

export { ScoreGauge } from './score-gauge';
export { PersonaCloud } from './persona-cloud';
export { ThumbnailStrip } from './thumbnail-strip';
export { AntiViralityHeader } from './anti-virality-header';
export { ReadingHero } from './reading-hero';
export { AudienceOrbit } from './audience-orbit';
export { AudienceBreakout } from './audience-breakout';
export { ReadingSection } from './reading-section';
export { ScoreDriversSection, AudienceContextSection } from './reading-accordion';
export { FixFirstList } from './fix-first-list';
export { RewriteItem } from './rewrite-item';
export { DeeperRead } from './deeper-read';
export { ReadingChat } from './reading-chat';
export { DrillSheet } from './drill-sheet';
export { RetentionScrubber } from './retention-scrubber';
export { PanelShell, LegendKey, PanelSection, PanelEmpty } from './panel-shell';
