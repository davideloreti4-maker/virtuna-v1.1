/**
 * render-engine.d.ts — the one entry of the pinned package that ships no types of its own.
 * Only what the edit tests call. `openfilm/film-doc` and `openfilm/host` bring their own.
 */
declare module "openfilm/render" {
  export function render(
    args: string[],
    opts?: {
      out?: string;
      scale?: number;
      workers?: number;
      fps?: number;
      loudness?: number;
      hardware?: boolean;
      onProgress?: (done: number, total: number) => void;
      signal?: AbortSignal;
    },
  ): Promise<{ out: string; encoder: string; lines: string[] }>;
}
