import { Resend } from "resend";

type SendCampaignEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
};

type SendCampaignEmailResult = {
  success: boolean;
  provider: "resend";
  externalId?: string;
  response?: unknown;
  error?: string;
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  return new Resend(apiKey);
}

function getFromAddress(fromName?: string) {
  const configuredFrom = process.env.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM_EMATL;
  if (configuredFrom) return configuredFrom;

  const safeName = fromName?.trim() || "Curry Pasta";
  return `${safeName} <no-reply@currypasta.com.br>`;
}

export async function sendCampaignEmail(input: SendCampaignEmailInput): Promise<SendCampaignEmailResult> {
  try {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: getFromAddress(input.fromName),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (result.error) {
      return {
        success: false,
        provider: "resend",
        response: result,
        error: result.error.message,
      };
    }

    return {
      success: true,
      provider: "resend",
      externalId: result.data?.id,
      response: result,
    };
  } catch (error) {
    return {
      success: false,
      provider: "resend",
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar email.",
    };
  }
}
