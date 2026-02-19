/**
 * Mock LLM service — echoes user input.
 * Replace this with a real Claude API call when ready.
 */
export async function sendMessage(text: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return `Echo: ${text}`;
}
