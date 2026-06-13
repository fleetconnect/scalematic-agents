// Gmail Integration — wire up with Google OAuth tokens
// TODO: Implement with googleapis SDK after Google OAuth is configured

export async function getUnreadEmails(_limit = 20): Promise<unknown[]> {
  // TODO: Implement
  // const { google } = await import('googleapis');
  // const gmail = google.gmail({ version: 'v1', auth: getAuthClient() });
  console.warn('[gmail] Not yet implemented — add Google OAuth credentials');
  return [];
}

export async function sendEmail(_to: string, _subject: string, _body: string): Promise<void> {
  // TODO: Implement — requires human approval before calling
  console.warn('[gmail] Not yet implemented');
}

export async function getEmailThread(_threadId: string): Promise<unknown> {
  // TODO: Implement
  console.warn('[gmail] Not yet implemented');
  return null;
}
