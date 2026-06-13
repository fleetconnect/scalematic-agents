// Google Drive Integration
// TODO: Wire up with googleapis SDK after Google OAuth is configured

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export async function listFiles(_folderId?: string): Promise<DriveFile[]> {
  // TODO: const { google } = await import('googleapis');
  console.warn('[googleDrive] Not yet implemented — add Google OAuth credentials');
  return [];
}

export async function readFileContent(_fileId: string): Promise<string> {
  // TODO: Export Docs as plain text, download Sheets as CSV
  console.warn('[googleDrive] Not yet implemented');
  return '';
}

export async function uploadFile(
  _name: string,
  _content: string,
  _mimeType: string,
  _folderId?: string
): Promise<string> {
  // TODO: Returns the created file ID
  console.warn('[googleDrive] Not yet implemented');
  return '';
}
