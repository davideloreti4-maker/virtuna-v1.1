/** Strip markdown code fences and Qwen/DeepSeek <think> blocks from LLM output. */
export function stripModelOutput(text: string): string {
  // Remove <think>...</think> blocks (Qwen thinking-mode output)
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Remove markdown code fences
  const fenced = out.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  out = fenced ? fenced[1]!.trim() : out;
  // Extract the first balanced JSON value and discard any trailing content.
  // Some models (e.g. qwen3.5-omni-flash) append prose / a second object after a
  // complete JSON object despite response_format:json_object — strict JSON.parse
  // then throws "Unexpected non-whitespace character after JSON". Slicing to the
  // first balanced {...}/[...] is a no-op for clean output and salvages the rest.
  return extractFirstJsonValue(out);
}

/**
 * Return the first balanced top-level JSON value ({...} or [...]) in `s`,
 * discarding any leading or trailing non-JSON content. String-aware (braces
 * inside string literals don't affect depth). Returns `s` unchanged when no
 * JSON opener is found, or from the opener onward when brackets never balance
 * (so a genuinely malformed payload still surfaces a meaningful parse error).
 */
function extractFirstJsonValue(s: string): string {
  const start = s.search(/[{[]/);
  if (start === -1) return s;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return s.slice(start);
}
