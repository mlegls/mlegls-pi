/** A successful code landing, independent of the issue's globally stored stage.
 * into follows Chain.into: collector issue slug, or the absolute owner checkout path.
 * head is the destination's code head immediately after integration; at is ISO-8601. */
export interface Landing {
	into: string;
	head: string;
	at: string;
}
export type LandingLedger = Record<string, Landing>;
