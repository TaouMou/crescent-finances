/**
 * Google Drive sync client.
 *
 * Auth: Google Identity Services (GIS) — loaded on demand, no SDK bundle.
 * Scope: drive.file — only files created by this app are accessible.
 * Backup lives at: My Drive / Crescent Finances / crescent-backup.json
 *
 * Folder and file IDs are cached in localStorage to avoid re-querying Drive
 * on every sync. Access tokens are short-lived (1 hour); GIS silent-renews
 * them when the user has already consented.
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Crescent Finances';
const BACKUP_FILENAME = 'crescent-backup.json';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const KEY_TOKEN = 'crescent.gdrive.token';
const KEY_CLIENT_ID = 'crescent.gdrive.clientId';
const KEY_FOLDER_ID = 'crescent.gdrive.folderId';
const KEY_FILE_ID = 'crescent.gdrive.fileId';

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

interface StoredToken {
  access_token: string;
  expires_at: number; // epoch ms
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(KEY_TOKEN);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    return Date.now() < t.expires_at - 60_000 ? t : null; // 60 s safety margin
  } catch {
    return null;
  }
}

function storeToken(access_token: string, expiresIn: number): string {
  const t: StoredToken = { access_token, expires_at: Date.now() + expiresIn * 1000 };
  try { localStorage.setItem(KEY_TOKEN, JSON.stringify(t)); } catch {}
  return access_token;
}

// ---------------------------------------------------------------------------
// Google Identity Services (GIS)
// ---------------------------------------------------------------------------

let gisReady = false;

async function loadGis(): Promise<void> {
  if (gisReady) return;
  if ((window as any).google?.accounts?.oauth2) { gisReady = true; return; }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => { gisReady = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load Google Identity Services. Check your network connection.'));
    document.head.appendChild(s);
  });
}

function gisRequest(clientId: string, prompt: '' | 'consent'): Promise<string> {
  const gapi = (window as any).google?.accounts?.oauth2;
  if (!gapi) throw new Error('Google Identity Services not loaded');
  return new Promise((resolve, reject) => {
    const client = gapi.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description ?? resp.error));
          return;
        }
        resolve(storeToken(resp.access_token, parseInt(resp.expires_in, 10)));
      },
      error_callback: (err: any) => reject(new Error(err.message ?? 'OAuth failed'))
    });
    client.requestAccessToken({ prompt });
  });
}

// ---------------------------------------------------------------------------
// Public auth API
// ---------------------------------------------------------------------------

export function loadClientId(): string | null {
  try { return localStorage.getItem(KEY_CLIENT_ID); } catch { return null; }
}

export function isConnected(): boolean {
  return loadClientId() !== null;
}

/** First-time connect: always shows the Google consent screen. */
export async function connect(clientId: string): Promise<string> {
  await loadGis();
  try { localStorage.setItem(KEY_CLIENT_ID, clientId); } catch {}
  return gisRequest(clientId, 'consent');
}

/**
 * Get a valid access token. Uses the cached token if still fresh; otherwise
 * attempts a silent re-auth (no popup if the user has already consented).
 */
export async function getToken(clientId: string): Promise<string> {
  const stored = readToken();
  if (stored) return stored.access_token;
  await loadGis();
  return gisRequest(clientId, '');
}

/** Revoke the token and wipe all Drive state from localStorage. */
export function disconnect(): void {
  const t = readToken();
  if (t) {
    try { (window as any).google?.accounts?.oauth2?.revoke(t.access_token, () => {}); } catch {}
  }
  for (const k of [KEY_TOKEN, KEY_CLIENT_ID, KEY_FOLDER_ID, KEY_FILE_ID]) {
    try { localStorage.removeItem(k); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Drive REST helpers
// ---------------------------------------------------------------------------

async function driveJson(token: string, path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${DRIVE_API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive ${path}: HTTP ${res.status}`);
  return res.json();
}

async function driveMedia(token: string, fileId: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Drive download: HTTP ${res.status}`);
  return res.text();
}

async function driveCreate(token: string, meta: object): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(meta)
  });
  if (!res.ok) throw new Error(`Drive create folder: HTTP ${res.status}`);
  return (await res.json()).id as string;
}

async function driveUpload(token: string, meta: object, content: string, fileId?: string): Promise<string> {
  const boundary = 'crescent_boundary_7f3a9b';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(meta),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`
  ].join('\r\n');

  const url = fileId
    ? `${UPLOAD_API}/files/${fileId}?uploadType=multipart`
    : `${UPLOAD_API}/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!res.ok) throw new Error(`Drive upload: HTTP ${res.status} — ${await res.text()}`);
  return (await res.json()).id as string;
}

// ---------------------------------------------------------------------------
// Folder & file management
// ---------------------------------------------------------------------------

async function ensureFolderId(token: string): Promise<string> {
  const cached = localStorage.getItem(KEY_FOLDER_ID);
  if (cached) {
    try {
      const f = await driveJson(token, `/files/${cached}`, { fields: 'id,trashed' });
      if (!f.trashed) return cached;
    } catch {}
  }

  const res = await driveJson(token, '/files', {
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive'
  });
  if (res.files?.length > 0) {
    const id = res.files[0].id as string;
    try { localStorage.setItem(KEY_FOLDER_ID, id); } catch {}
    return id;
  }

  const id = await driveCreate(token, {
    name: FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder'
  });
  try { localStorage.setItem(KEY_FOLDER_ID, id); } catch {}
  return id;
}

async function findFileInFolder(token: string, folderId: string): Promise<string | null> {
  const res = await driveJson(token, '/files', {
    q: `name='${BACKUP_FILENAME}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive'
  });
  return (res.files?.[0]?.id as string) ?? null;
}

// ---------------------------------------------------------------------------
// Public sync API
// ---------------------------------------------------------------------------

/** Download the backup JSON string from Drive, or null if none exists yet. */
export async function downloadBackup(token: string): Promise<string | null> {
  let fileId = localStorage.getItem(KEY_FILE_ID);

  if (!fileId) {
    const folderId = localStorage.getItem(KEY_FOLDER_ID);
    if (!folderId) return null;
    fileId = await findFileInFolder(token, folderId);
    if (!fileId) return null;
    try { localStorage.setItem(KEY_FILE_ID, fileId); } catch {}
  }

  try {
    return await driveMedia(token, fileId);
  } catch {
    // File was deleted from Drive; clear the stale ID and return null.
    try { localStorage.removeItem(KEY_FILE_ID); } catch {}
    return null;
  }
}

/** Create or update the backup file on Drive. */
export async function uploadBackup(token: string, content: string): Promise<void> {
  const folderId = await ensureFolderId(token);

  let fileId = localStorage.getItem(KEY_FILE_ID);
  if (fileId) {
    // Confirm it still exists
    try {
      await driveJson(token, `/files/${fileId}`, { fields: 'id,trashed' });
    } catch {
      fileId = null;
    }
  }
  if (!fileId) {
    fileId = await findFileInFolder(token, folderId);
  }

  const meta: Record<string, unknown> = { name: BACKUP_FILENAME, mimeType: 'application/json' };
  if (!fileId) meta.parents = [folderId];

  const newId = await driveUpload(token, meta, content, fileId ?? undefined);
  try { localStorage.setItem(KEY_FILE_ID, newId); } catch {}
}
