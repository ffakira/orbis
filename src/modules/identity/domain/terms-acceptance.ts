export type LegalDocument = "terms_of_service";

export interface RecordTermsAcceptance {
  id: string;
  userId: string;
  document: LegalDocument;
  version: string;
  acceptedAt: string;
}

export class TermsAcceptance {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly document: LegalDocument,
    public readonly version: string,
    public readonly acceptedAt: string,
  ) {}

  static record(props: RecordTermsAcceptance): TermsAcceptance {
    const version = props.version.trim();

    if (version.length === 0 || version.length > 64) {
      throw new Error(
        "Terms version must contain between 1 and 64 characters.",
      );
    }

    if (!Number.isFinite(Date.parse(props.acceptedAt))) {
      throw new Error("Terms acceptance timestamp must be a valid date.");
    }

    return new TermsAcceptance(
      props.id,
      props.userId,
      props.document,
      version,
      props.acceptedAt,
    );
  }
}
