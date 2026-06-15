// Barrel for the Reading namespace (02-05). Named-export convention mirrors
// board/_kit/index.ts. The container is the public entry; the leaves are exported
// for Phase-3 (rich drill-downs), Phase-4 (stage-reveal), and Phase-5 (follow-up)
// reuse without reaching into individual files.

export { Reading } from './reading';
export { ReadingThread } from './reading-thread';
export { FollowUpThread } from './follow-up-thread';
export { FollowUpProvider, useFollowUp } from './follow-up-context';

export { ScoreGauge } from './score-gauge';
export { PersonaCloud } from './persona-cloud';
export { ThumbnailStrip } from './thumbnail-strip';
export { AntiViralityHeader } from './anti-virality-header';
export { DriverRows } from './driver-rows';
export { FixFirstList } from './fix-first-list';
export { RewriteItem } from './rewrite-item';
export { DeeperRead } from './deeper-read';
export { DrillSheet } from './drill-sheet';
