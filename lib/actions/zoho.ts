"use server";

import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import {
  exchangeAuthCode,
  getAccessToken,
  getPrimaryAccount,
  createDraft,
  uploadAttachment,
  ZohoAttachment,
} from "@/lib/zoho";
import { generateProposalPdf } from "@/lib/proposalPdf";
import { revalidatePath } from "next/cache";

async function loadConfig() {
  return prisma.zohoConfig.findUnique({ where: { id: 1 } });
}

/** One-time connect: exchange a Self Client authorization code for a refresh token. */
export async function connectZoho(input: {
  region: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri?: string;
}): Promise<ActionResult> {
  try {
    if (!input.clientId.trim() || !input.clientSecret.trim() || !input.code.trim()) {
      return { success: false, error: "Client ID, Client Secret, and the authorization code are all required." };
    }
    const { refreshToken, accessToken } = await exchangeAuthCode({
      region: input.region,
      clientId: input.clientId.trim(),
      clientSecret: input.clientSecret.trim(),
      code: input.code.trim(),
      redirectUri: input.redirectUri?.trim() || undefined,
    });
    const { accountId, fromAddress } = await getPrimaryAccount(input.region, accessToken);

    await prisma.zohoConfig.upsert({
      where: { id: 1 },
      update: {
        region: input.region,
        clientId: input.clientId.trim(),
        clientSecret: input.clientSecret.trim(),
        refreshToken,
        accountId,
        fromAddress,
        connected: true,
        lastError: "",
      },
      create: {
        id: 1,
        region: input.region,
        clientId: input.clientId.trim(),
        clientSecret: input.clientSecret.trim(),
        refreshToken,
        accountId,
        fromAddress,
        connected: true,
      },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e?.message ?? "Failed to connect to Zoho." };
  }
}

/** Update editable fields (send address, region) without re-auth. */
export async function updateZohoConfig(input: {
  fromAddress?: string;
  accountId?: string;
}): Promise<ActionResult> {
  try {
    await prisma.zohoConfig.update({
      where: { id: 1 },
      data: {
        ...(input.fromAddress !== undefined && { fromAddress: input.fromAddress.trim() }),
        ...(input.accountId !== undefined && { accountId: input.accountId.trim() }),
      },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: "Failed to save Zoho settings." };
  }
}

export async function disconnectZoho(): Promise<ActionResult> {
  try {
    await prisma.zohoConfig.upsert({
      where: { id: 1 },
      update: { refreshToken: "", accountId: "", connected: false, lastError: "" },
      create: { id: 1, connected: false },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: "Failed to disconnect." };
  }
}

/** Verify the stored credentials still work (mints a token + reads accounts). */
export async function testZoho(): Promise<ActionResult> {
  try {
    const cfg = await loadConfig();
    if (!cfg || !cfg.connected || !cfg.refreshToken) {
      return { success: false, error: "Zoho is not connected." };
    }
    const token = await getAccessToken({
      region: cfg.region,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      refreshToken: cfg.refreshToken,
    });
    await getPrimaryAccount(cfg.region, token);
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e?.message ?? "Zoho test failed." };
  }
}

/** Create a draft in the connected Zoho mailbox, attaching the proposal PDF. */
export async function createZohoDraft(input: {
  proposalId: number;
  to: string;
  subject: string;
  body: string;
  cc?: string;
}): Promise<ActionResult<{ attached: boolean }>> {
  try {
    const cfg = await loadConfig();
    if (!cfg || !cfg.connected || !cfg.refreshToken) {
      return { success: false, error: "Zoho Mail isn't connected. Set it up in Settings → Zoho Mail." };
    }
    if (!cfg.fromAddress) {
      return { success: false, error: "No Zoho send address configured. Add one in Settings → Zoho Mail." };
    }
    if (!input.to.trim()) {
      return { success: false, error: "This customer has no email address on file." };
    }
    const token = await getAccessToken({
      region: cfg.region,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      refreshToken: cfg.refreshToken,
    });

    // Build the proposal PDF and upload it as an attachment.
    const attachments: ZohoAttachment[] = [];
    let attached = false;
    try {
      const pdf = await generateProposalPdf(input.proposalId);
      if (pdf) {
        const ref = await uploadAttachment({
          region: cfg.region,
          accessToken: token,
          accountId: cfg.accountId,
          fileName: pdf.filename,
          bytes: pdf.buffer,
          contentType: "application/octet-stream",
        });
        attachments.push(ref);
        attached = true;
      }
    } catch (attErr: any) {
      console.error("Proposal PDF attachment failed:", attErr);
      // Continue without the attachment rather than failing the whole draft.
    }

    await createDraft({
      region: cfg.region,
      accessToken: token,
      accountId: cfg.accountId,
      fromAddress: cfg.fromAddress,
      toAddress: input.to.trim(),
      subject: input.subject,
      content: input.body,
      cc: input.cc?.trim() || undefined,
      attachments,
    });
    return { success: true, data: { attached } };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e?.message ?? "Failed to create Zoho draft." };
  }
}
