/** Strip markdown code fences and Qwen/DeepSeek <think> blocks from LLM output. */
export function stripModelOutput(text: string): string {
  // Remove <think>...</think> blocks (Qwen thinking-mode output)
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Remove markdown code fences
  const fenced = out.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : out;
}
