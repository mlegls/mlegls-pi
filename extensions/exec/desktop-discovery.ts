// Read-only projections of public tool details; no backend state or ref allocation.
export function captureSummary(details: any) {
 if (!details || typeof details !== "object") return undefined;
 const c = details.capture;
 return Object.fromEntries(Object.entries({ stateId: c?.stateId ?? details.stateId, lookId: details.outline?.lookId ?? details.lookId, target: details.target && { app: details.target.app, windowTitle: details.target.windowTitle, windowRef: details.target.windowRef }, width: c?.width, height: c?.height, scaleFactor: c?.scaleFactor, returned: details.returned, totalMatches: details.totalMatches, hasMore: details.hasMore, complete: details.complete }).filter(([, v]) => v !== undefined));
}
