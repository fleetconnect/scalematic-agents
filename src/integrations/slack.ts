// Slack Integration — human approval delivery layer
// TODO: Add SLACK_BOT_TOKEN and SLACK_APPROVAL_CHANNEL to .env

export async function sendApprovalRequest(
  _content: Record<string, unknown>,
  _approvalId: string
): Promise<void> {
  // TODO: Implement with @slack/web-api
  // const { WebClient } = await import('@slack/web-api');
  // const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  // await slack.chat.postMessage({ channel: process.env.SLACK_APPROVAL_CHANNEL, blocks: [...] });
  console.warn('[slack] Not yet implemented — add SLACK_BOT_TOKEN to .env');
}

export async function sendNotification(_message: string, _channel?: string): Promise<void> {
  // TODO: Implement
  console.warn('[slack] Not yet implemented');
}
