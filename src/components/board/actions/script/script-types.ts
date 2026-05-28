// Phase 6 D-02: ScriptResult discriminated-union — single source of truth
// shared by /api/analyze/[id]/script (server) and ScriptBody/use-script (client).
// Per 06-CONTEXT.md D-02 + 06-RESEARCH.md Item 2.

export interface ScriptResultBody {
  opening_line: string;
  scene_order: string[];
  voiceover: string;
  captions: string[];
}

export type ScriptResult =
  | {
      is_empty_state: false;
      script: ScriptResultBody;
      engine_version: string;
      generated_at: string;
    }
  | {
      is_empty_state: true;
      opening_variants: string[];
      engine_version: string;
      generated_at: string;
    };
