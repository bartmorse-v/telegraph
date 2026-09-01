import Anthropic from "@anthropic-ai/sdk";

/**
 * Identity-linked API keys are scoped to a workspace and reject any request
 * that does not say which one it acts in, with a 400 naming the header. Keys
 * that are not identity-linked ignore it, so setting it when present is always
 * safe and omitting it when absent is correct.
 */
export function createClient(): Anthropic {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic(
    workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {},
  );
}

/**
 * Turns the two failures that actually happen on a first run into something
 * that says what to do, rather than a raw API error.
 */
export function explainError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("anthropic-workspace-id")) {
    return [
      "Your API key is identity-linked, so requests must name a workspace.",
      "",
      "Find the id in the Anthropic Console: open the workspace and read it from",
      "the address bar — platform.claude.com/workspaces/<THIS PART>/...",
      "",
      "Then add it:  npm run setup",
    ].join("\n");
  }

  if (/authentication|invalid x-api-key|401/i.test(message)) {
    return [
      "The API key was rejected.",
      "",
      "If you recently revoked or rotated it, set the new one:  npm run setup",
    ].join("\n");
  }

  return message;
}
