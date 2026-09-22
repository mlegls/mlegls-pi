// Bases views over docs/issues/ frontmatter. The Base's own filters choose which issues are visible;
// readiness is computed over every issue note in the vault so subtree rollups survive filtering.
import { Plugin, type BasesViewConfig } from "obsidian";
import { TrackerView, MODES } from "./view.ts";

export default class TrackerPlugin extends Plugin {
  onload() {
    this.registerHoverLinkSource("tracker", { display: "Tracker", defaultMod: true });
    this.registerBasesView("tracker", {
      name: "Tracker",
      icon: "lucide-list-tree",
      factory: (controller, containerEl) => new TrackerView(controller, containerEl, this),
      options: (config: BasesViewConfig) => [
        { type: "dropdown", key: "mode", displayName: "Mode", default: "tree", options: Object.fromEntries(MODES.map((m) => [m, m])) },
        { type: "toggle", key: "showDone", displayName: "Show done", default: false, shouldHide: () => !["tree", "graph", "all"].includes(String(config.get("mode") ?? "tree")) },
        { type: "toggle", key: "includeDeferred", displayName: "Include deferred", default: false, shouldHide: () => !["frontier", "mine"].includes(String(config.get("mode") ?? "tree")) },
      ],
    });
  }
}
