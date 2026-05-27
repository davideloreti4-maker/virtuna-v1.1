import { describe, it } from 'vitest';
import { STREAMING_FIXTURE } from './fixtures/streaming-fixture';

// @ts-expect-error -- created in Plan 04-04
import type { UseAudienceChoreographyResult } from '../use-audience-choreography';

void STREAMING_FIXTURE; // ensures fixture import resolves

describe('useAudienceChoreography (streaming)', () => {
  it.todo('row transitions skeleton → streaming on pass2_persona_start');
  it.todo('row transitions streaming → filling → complete on pass2_persona_end');
});
