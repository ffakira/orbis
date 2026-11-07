export interface EmailVerificationTemplateData {
  firstName: string;
  verificationUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export interface EmailTemplateRenderer {
  renderEmailVerification(
    data: EmailVerificationTemplateData,
  ): Promise<RenderedEmail>;
}