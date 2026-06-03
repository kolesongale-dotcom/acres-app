/**
 * Zoho Mail API helpers (server-only).
 *
 * Flow: a stored long-lived refresh_token is exchanged for a short-lived
 * access_token, which authorizes Zoho Mail API calls (get accounts, create
 * draft). Credentials live in the ZohoConfig singleton row.
 *
 * Docs:
 *  - OAuth token:  POST https://accounts.zoho.<dc>/oauth/v2/token
 *  - Accounts:     GET  https://mail.zoho.<dc>/api/accounts
 *  - Save draft:   POST https://mail.zoho.<dc>/api/accounts/{accountId}/messages  (mode: "draft")
 */

export interface ZohoHosts {
  accounts: string; // e.g. https://accounts.zoho.com
  mail: string; // e.g. https://mail.zoho.com
}

export const ZOHO_REGIONS: { value: string; label: string }[] = [
  { value: "com", label: "United States (.com)" },
  { value: "eu", label: "Europe (.eu)" },
  { value: "in", label: "India (.in)" },
  { value: "com.au", label: "Australia (.com.au)" },
  { value: "jp", label: "Japan (.jp)" },
  { value: "ca", label: "Canada (.ca)" },
  { value: "sa", label: "Saudi Arabia (.sa)" },
];

export function zohoHosts(region: string): ZohoHosts {
  const r = (region || "com").toLowerCase();
  if (r === "ca") {
    return { accounts: "https://accounts.zohocloud.ca", mail: "https://mail.zohocloud.ca" };
  }
  return { accounts: `https://accounts.zoho.${r}`, mail: `https://mail.zoho.${r}` };
}

export const ZOHO_SCOPES = "ZohoMail.accounts.READ,ZohoMail.messages.CREATE";

/** Exchange an authorization (grant) code for tokens. Used during connect. */
export async function exchangeAuthCode(opts: {
  region: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri?: string;
}): Promise<{ refreshToken: string; accessToken: string }> {
  const { accounts } = zohoHosts(opts.region);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code: opts.code,
  });
  if (opts.redirectUri) body.set("redirect_uri", opts.redirectUri);

  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (data.error || !data.refresh_token) {
    throw new Error(
      zohoError(data) ||
        "Could not exchange the authorization code. Make sure it is fresh (codes expire in minutes) and the region/scopes are correct."
    );
  }
  return { refreshToken: data.refresh_token, accessToken: data.access_token };
}

/** Mint a fresh access token from the stored refresh token. */
export async function getAccessToken(opts: {
  region: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const { accounts } = zohoHosts(opts.region);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    refresh_token: opts.refreshToken,
  });
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (data.error || !data.access_token) {
    throw new Error(zohoError(data) || "Could not refresh the Zoho access token. Re-connect in Settings.");
  }
  return data.access_token;
}

/** Fetch the primary mail account (accountId + send address). */
export async function getPrimaryAccount(
  region: string,
  accessToken: string
): Promise<{ accountId: string; fromAddress: string }> {
  const { mail } = zohoHosts(region);
  const res = await fetch(`${mail}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  const list: any[] = data?.data ?? [];
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("No Zoho mail accounts were returned for these credentials.");
  }
  const acct = list[0];
  const accountId = String(acct.accountId ?? acct.accountID ?? "");
  // Pick the primary send address if present.
  let fromAddress = "";
  const sendAddrs: any[] = acct.sendMailDetails ?? [];
  const primary = sendAddrs.find((s) => s.sendMailId || s.fromAddress);
  fromAddress = primary?.fromAddress ?? primary?.sendMailId ?? acct.primaryEmailAddress ?? acct.mailboxAddress ?? "";
  return { accountId, fromAddress };
}

export interface ZohoAttachment {
  storeName: string;
  attachmentName: string;
  attachmentPath: string;
}

/** Upload a single file to Zoho's file store; returns the attachment reference. */
export async function uploadAttachment(opts: {
  region: string;
  accessToken: string;
  accountId: string;
  fileName: string;
  bytes: Buffer;
  contentType?: string;
}): Promise<ZohoAttachment> {
  const { mail } = zohoHosts(opts.region);
  const url = `${mail}/api/accounts/${opts.accountId}/messages/attachments?fileName=${encodeURIComponent(opts.fileName)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${opts.accessToken}`,
      "Content-Type": opts.contentType || "application/octet-stream",
      Accept: "application/json",
    },
    body: new Uint8Array(opts.bytes),
  });
  const data = await res.json().catch(() => ({}));
  const d = data?.data;
  const att = Array.isArray(d) ? d[0] : d;
  if (!res.ok || !att?.storeName || !att?.attachmentPath) {
    throw new Error(data?.status?.description || zohoError(data) || `Zoho attachment upload failed (HTTP ${res.status}).`);
  }
  return {
    storeName: att.storeName,
    attachmentName: att.attachmentName ?? opts.fileName,
    attachmentPath: att.attachmentPath,
  };
}

/** Create a draft message in the user's mailbox. Returns nothing on success. */
export async function createDraft(opts: {
  region: string;
  accessToken: string;
  accountId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  content: string;
  cc?: string;
  attachments?: ZohoAttachment[];
}): Promise<void> {
  const { mail } = zohoHosts(opts.region);
  const payload: Record<string, unknown> = {
    mode: "draft",
    fromAddress: opts.fromAddress,
    toAddress: opts.toAddress,
    subject: opts.subject,
    content: opts.content,
    mailFormat: "plaintext",
  };
  if (opts.cc) payload.ccAddress = opts.cc;
  if (opts.attachments && opts.attachments.length) payload.attachments = opts.attachments;

  const res = await fetch(`${mail}/api/accounts/${opts.accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${opts.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  const code = data?.status?.code;
  if (!res.ok || (code && code !== 200)) {
    throw new Error(data?.status?.description || zohoError(data) || `Zoho draft failed (HTTP ${res.status}).`);
  }
}

function zohoError(data: any): string {
  if (!data) return "";
  if (typeof data.error === "string") return data.error;
  if (data.error?.message) return data.error.message;
  if (data?.status?.description) return data.status.description;
  return "";
}
