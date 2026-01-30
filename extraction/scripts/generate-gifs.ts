/**
 * GIF Generation Script
 *
 * Converts recorded videos to GIFs using ffmpeg.
 * Run after extraction tests complete.
 *
 * Prerequisites:
 *   brew install ffmpeg
 *
 * Usage:
 *   npx tsx extraction/scripts/generate-gifs.ts
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const VIDEOS_DIR = path.join(__dirname, '..', 'test-results');
const GIFS_DIR = path.join(__dirname, '..', 'gifs');

// GIF generation configs - extract specific segments from flow videos
const GIF_CONFIGS = [
  {
    pattern: '01-complete-test-flow',
    output: 'loading-phases.gif',
    fps: 12,
    width: 720,
    startTime: 35, // Start at simulation loading
    duration: 15,
  },
  {
    pattern: '01-complete-test-flow',
    output: 'results-expand.gif',
    fps: 10,
    width: 720,
    startTime: 55, // Start at results
    duration: 12,
  },
  {
    pattern: '02-society-management',
    output: 'society-creation.gif',
    fps: 12,
    width: 720,
    startTime: 20,
    duration: 15,
  },
  {
    pattern: '03-settings-navigation',
    output: 'settings-tabs.gif',
    fps: 10,
    width: 720,
    startTime: 5,
    duration: 20,
  },
  {
    pattern: '04-history-management',
    output: 'history-delete.gif',
    fps: 12,
    width: 720,
    startTime: 15,
    duration: 12,
  },
];

function checkFfmpeg(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function findVideo(pattern: string): string | null {
  // Search recursively in test-results
  function searchDir(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = searchDir(fullPath);
        if (found) return found;
      } else if (entry.name.includes(pattern) && entry.name.endsWith('.webm')) {
        return fullPath;
      }
    }
    return null;
  }

  return searchDir(VIDEOS_DIR);
}

function generateGif(config: typeof GIF_CONFIGS[0]): void {
  const inputPath = findVideo(config.pattern);
  if (!inputPath) {
    console.log(`[!] Video not found for pattern: ${config.pattern}`);
    return;
  }

  const outputPath = path.join(GIFS_DIR, config.output);
  const palettePath = path.join(GIFS_DIR, `palette-${Date.now()}.png`);

  try {
    console.log(`\n[Video] Processing: ${config.pattern} -> ${config.output}`);
    console.log(`   Source: ${inputPath}`);

    // Generate palette for better colors
    const paletteCmd = [
      'ffmpeg', '-y',
      '-ss', String(config.startTime),
      '-t', String(config.duration),
      '-i', `"${inputPath}"`,
      '-vf', `"fps=${config.fps},scale=${config.width}:-1:flags=lanczos,palettegen"`,
      `"${palettePath}"`,
    ].join(' ');

    execSync(paletteCmd, { stdio: 'pipe' });

    // Generate GIF using palette
    const gifCmd = [
      'ffmpeg', '-y',
      '-ss', String(config.startTime),
      '-t', String(config.duration),
      '-i', `"${inputPath}"`,
      '-i', `"${palettePath}"`,
      '-lavfi', `"fps=${config.fps},scale=${config.width}:-1:flags=lanczos [x]; [x][1:v] paletteuse"`,
      `"${outputPath}"`,
    ].join(' ');

    execSync(gifCmd, { stdio: 'pipe' });

    // Clean up palette
    fs.unlinkSync(palettePath);

    const stats = fs.statSync(outputPath);
    console.log(`[OK] Created: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error(`[ERROR] Failed to generate ${config.output}:`, error);
    // Clean up palette if it exists
    if (fs.existsSync(palettePath)) {
      fs.unlinkSync(palettePath);
    }
  }
}

function main() {
  console.log('[GIF] GIF Generation Script');
  console.log('========================\n');

  // Check ffmpeg
  if (!checkFfmpeg()) {
    console.error('[ERROR] ffmpeg not found. Install with: brew install ffmpeg');
    process.exit(1);
  }

  // Ensure GIFs directory exists
  fs.mkdirSync(GIFS_DIR, { recursive: true });

  // Check for videos directory
  if (!fs.existsSync(VIDEOS_DIR)) {
    console.error(`[ERROR] Test results directory not found: ${VIDEOS_DIR}`);
    console.error('   Run extraction tests first: pnpm extraction:all');
    process.exit(1);
  }

  // Generate GIFs
  let generated = 0;
  for (const config of GIF_CONFIGS) {
    generateGif(config);
    generated++;
  }

  console.log(`\n[Done] GIF generation complete! (${generated} attempted)`);
  console.log(`   Output directory: ${GIFS_DIR}`);
}

main();
