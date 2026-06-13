// Google Calendar Integration
// TODO: Wire up with googleapis SDK after Google OAuth is configured

export async function getUpcomingEvents(_daysAhead = 7): Promise<unknown[]> {
  // TODO: Implement
  // const { google } = await import('googleapis');
  // const calendar = google.calendar({ version: 'v3', auth: getAuthClient() });
  console.warn('[googleCalendar] Not yet implemented — add Google OAuth credentials');
  return [];
}

export async function getEventDetails(_eventId: string): Promise<unknown> {
  // TODO: Implement
  console.warn('[googleCalendar] Not yet implemented');
  return null;
}
