import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { agenda } from '../vault.ts';

export function install(pi: ExtensionAPI) {
  pi.registerCommand('record', {
    description: 'Write session conclusions back to vault discussions (/record [note.md])',
    handler: async (args, ctx) => {
      if (!ctx.isIdle()) { ctx.ui.notify('Wait for the discussion to finish.', 'warning'); return; }
      const items = agenda(args.trim() ? [args.trim()] : undefined);
      if (!items.length) { ctx.ui.notify('No vault agenda items.', 'info'); return; }
      pi.sendUserMessage([
        'Record conclusions from THIS session for the agenda below. Only record items actually discussed; do not invent resolutions.',
        'Use vault.record(item, conclusion, {fold?, complete?}) from lib/vault.ts via exec. Pass each exact agenda item snapshot. Process bottom-up within each note. With fold:true, conclusion is the entire replacement block without the bullet marker or workflow tag: title on its first line, body on subsequent lines; preserve ticket:: and other metadata.',
        'Default: concise comment; fold only when the user asked to fold into the bullet. For #to-spec, grow the spec in the thread body using fold:true, retaining #to-spec unless the session established a complete actionable spec (complete:true flips to #implement). Leave unresolved items alone. Report what was written.',
        JSON.stringify(items),
      ].join('\n\n'));
    },
  });
}

export { install as default };
