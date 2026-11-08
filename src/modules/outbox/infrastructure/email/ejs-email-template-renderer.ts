import { readFile } from "node:fs/promises";

import ejs from "ejs";

import type {
  EmailTemplateRenderer,
  EmailVerificationTemplateData,
  PasswordResetTemplateData,
  RenderedEmail,
} from "#modules/outbox/application/ports/email-template-renderer.js";

export class EjsEmailTemplateRenderer implements EmailTemplateRenderer {
  private readonly verificationTemplates: Promise<{
    html: string;
    text: string;
  }>;

  private readonly passwordResetTemplates: Promise<{
    html: string;
    text: string;
  }>;

  constructor() {
    this.verificationTemplates = Promise.all([
      readFile(
        new URL(
          "./templates/email-verification/email-verification.html.ejs",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "./templates/email-verification/email-verification.text.ejs",
          import.meta.url,
        ),
        "utf8",
      ),
    ]).then(([html, text]) => ({ html, text }));

    this.passwordResetTemplates = Promise.all([
      readFile(
        new URL(
          "./templates/password-reset/password-reset.html.ejs",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "./templates/password-reset/password-reset.text.ejs",
          import.meta.url,
        ),
        "utf8",
      ),
    ]).then(([html, text]) => ({ html, text }));
  }

  async renderEmailVerification(
    data: EmailVerificationTemplateData,
  ): Promise<RenderedEmail> {
    const templates = await this.verificationTemplates;

    return {
      html: ejs.render(templates.html, data),
      text: ejs.render(templates.text, data),
    };
  }

  async renderPasswordReset(
    data: PasswordResetTemplateData,
  ): Promise<RenderedEmail> {
    const templates = await this.passwordResetTemplates;

    return {
      html: ejs.render(templates.html, data),
      text: ejs.render(templates.text, data),
    };
  }
}
