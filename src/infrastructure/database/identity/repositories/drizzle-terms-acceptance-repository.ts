import { termsAcceptances } from "../../schema/identity.schema.js";
import type { DatabaseExecutor } from "../../client.js";
import { TermsAcceptance } from "../../../../modules/identity/domain/terms-acceptance.js";

export class DrizzleTermsAcceptanceRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(acceptance: TermsAcceptance): Promise<void> {
    await this.db.insert(termsAcceptances).values({
      id: acceptance.id,
      userId: acceptance.userId,
      document: acceptance.document,
      version: acceptance.version,
      acceptedAt: new Date(acceptance.acceptedAt),
    });
  }
}
