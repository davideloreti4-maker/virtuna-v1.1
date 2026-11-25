/** atoms.ts — the small shapes several schemas share. Not part of the public surface. */
import { z } from "zod";

/** A six-digit colour, like "#ff6363". */
export const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** A fraction of the stage, 0 to 1. */
export const Unit = z.number().min(0).max(1);
/** A whole number of milliseconds, 0 or more, up to an hour. */
export const Ms = z.number().int().min(0).max(3_600_000);
/** The weights text may be set in: 400 (regular) to 900 (black), in hundreds (X122). */
export const WEIGHTS = [400, 500, 600, 700, 800, 900] as const;
/** One of `WEIGHTS`; its JSON Schema is an enum, which the catalogue writes 400|500|600|700|800|900. */
export const Weight = z.literal(WEIGHTS);
/** Words to show: no longer than `max`, and not blank. */
export const text = (max: number) => z.string().max(max).regex(/\S/, "is blank");
