import ejs from "ejs";
import { readFile } from "node:fs/promises";

import type {
  EmailTemplateRenderer,
  EmailVerificationTemplateData,
  RenderedEmail,
} from "#modules/outbox/application/ports/email-template-renderer.js";

export class EjsEmailTemplateRenderer implements EmailTemplateRenderer {
  private readonly templates: Promise<{
    html: string;
    text: string;
  }>;

  constructor() {
    this.templates = Promise.all([
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
  }

  async renderEmailVerification(
    data: EmailVerificationTemplateData,
  ): Promise<RenderedEmail> {
    const templates = await this.templates;

    return {
      html: ejs.render(templates.html, data),
      text: ejs.render(templates.text, data),
    };
  }
}
