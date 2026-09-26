/** Cheap models bypass paid read filtering; match families across model versions. */
export function filterReads(model: { id: string } | undefined): boolean {
	return /sol|astra|opus|fable|sonnet/i.test(model?.id ?? "");
}
