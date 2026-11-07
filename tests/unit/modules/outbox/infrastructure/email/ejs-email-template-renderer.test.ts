import { describe, expect, it } from "vitest";

import { EjsEmailTemplateRenderer } from "#modules/outbox/infrastructure/email/ejs-email-template-renderer.js";

describe("EjsEmailTemplateRenderer", () => {
  const renderer = new EjsEmailTemplateRenderer();

  it("renders the HTML and plain-text email templates", async () => {
    const result = await renderer.renderEmailVerification({
      firstName: "Alex",
      verificationUrl: "https://example.test/verify?token=synthetic-token",
    });

    expect(result.html).toContain("Hello Alex,");
    expect(result.html).toContain("Verify email address");
    expect(result.html).toContain(
      'href="https://example.test/verify?token=synthetic-token"',
    );

    expect(result.text).toContain("Hello Alex,");
    expect(result.text).toContain(
      "https://example.test/verify?token=synthetic-token",
    );
  });

  it("escapes HTML characters in template data", async () => {
    const result = await renderer.renderEmailVerification({
      firstName: "Alex <Admin> & Associates",
      verificationUrl: "https://example.test/verify?token=abc&source=email",
    });

    expect(result.html).toContain(
      "Alex &lt;Admin&gt; &amp; Associates",
    );

    expect(result.html).toContain(
      'href="https://example.test/verify?token=abc&amp;source=email"',
    );

    expect(result.html).not.toContain(
      "Alex <Admin> & Associates",
    );
  });

  it("preserves plain-text content without HTML escaping", async () => {
    const result = await renderer.renderEmailVerification({
      firstName: "Alex & Associates",
      verificationUrl: "https://example.test/verify?token=abc&source=email",
    });

    expect(result.text).toContain("Hello Alex & Associates,");

    expect(result.text).toContain(
      "https://example.test/verify?token=abc&source=email",
    );

    expect(result.text).not.toContain("&amp;");
  });

  it("renders different data across consecutive calls", async () => {
    const first = await renderer.renderEmailVerification({
      firstName: "Alex",
      verificationUrl: "https://example.test/verify?token=first",
    });

    const second = await renderer.renderEmailVerification({
      firstName: "Jordan",
      verificationUrl: "https://example.test/verify?token=second",
    });

    expect(first.html).toContain("Hello Alex,");
    expect(first.html).not.toContain("Hello Jordan,");

    expect(second.html).toContain("Hello Jordan,");
    expect(second.html).not.toContain("Hello Alex,");

    expect(first.text).toContain("token=first");
    expect(second.text).toContain("token=second");
  });
});
