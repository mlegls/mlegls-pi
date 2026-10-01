import AppKit
import GhosttyTerminal

/// Ghostty bindings (cmd+n, cmd+d, cmd+[ …) would otherwise eat the app's thread shortcuts:
/// the menu gets the first look at key equivalents, then the terminal.
final class ThreadSurface: AppTerminalView {
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if NSApp.mainMenu?.performKeyEquivalent(with: event) == true { return true }
        return super.performKeyEquivalent(with: event)
    }
}

/// The window: thread sidebar beside one terminal attached to the shown thread.
@MainActor
final class Controller: NSObject, NSApplicationDelegate, NSOutlineViewDataSource, NSOutlineViewDelegate,
    NSSearchFieldDelegate, NSMenuItemValidation, TerminalSurfaceCloseDelegate, TerminalSurfaceTitleDelegate
{
    var saved = Saved.load()
    var rows: [ThreadRow] = []
    var roots: [Node] = []
    var nodes: [String: Node] = [:]
    var shown: String?
    var hovered: String?
    var busy = false
    var reloading = false

    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1400, height: 900),
                          styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
    let outline = PassiveOutline()
    let search = NSSearchField()
    let modes = NSSegmentedControl(labels: ["spawn", "merge"], trackingMode: .selectOne, target: nil, action: nil)
    let where_ = NSTextField(labelWithString: "")
    let status = NSTextField(labelWithString: "")
    let main = NSView()
    let placeholder = NSTextField(labelWithString: "Choose a thread")
    let ghostty = TerminalController(configFilePath: NSHomeDirectory() + "/.config/ghostty/config")
    var surface: ThreadSurface?

    override init() {
        super.init()
        build()
        if let id = saved.shown { shown = nil; Task { await refresh(); if rows.contains(where: { $0.id == id }) { open(id) } } }
        else { Task { await refresh() } }
        Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { if let self, !self.busy { Task { await self.refresh() } } }
        }
    }

    // MARK: layout

    func build() {
        modes.selectedSegment = saved.mode == "merge" ? 1 : 0
        modes.target = self; modes.action = #selector(modeChanged)
        modes.segmentDistribution = .fillEqually
        modes.controlSize = .small
        search.placeholderString = "Filter"
        search.delegate = self
        search.controlSize = .small
        for label in [where_, status] {
            label.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
            label.textColor = .secondaryLabelColor
            label.lineBreakMode = .byTruncatingMiddle
            label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        }

        let column = NSTableColumn(identifier: .init("thread"))
        column.resizingMask = .autoresizingMask
        outline.addTableColumn(column)
        outline.outlineTableColumn = column
        outline.headerView = nil
        outline.rowHeight = 24
        outline.style = .sourceList
        outline.indentationPerLevel = 12
        outline.columnAutoresizingStyle = .uniformColumnAutoresizingStyle
        outline.dataSource = self
        outline.delegate = self
        outline.menuForRow = { [weak self] row in self?.menu(forRow: row) }
        let scroll = NSScrollView()
        scroll.documentView = outline
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false

        let side = NSStackView(views: [modes, search, scroll, where_, status])
        side.orientation = .vertical
        side.alignment = .leading
        side.spacing = 6
        side.edgeInsets = NSEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        for v in [modes, search, scroll] as [NSView] { v.widthAnchor.constraint(equalTo: side.widthAnchor, constant: -16).isActive = true }
        for v in [where_, status] { v.widthAnchor.constraint(lessThanOrEqualTo: side.widthAnchor, constant: -16).isActive = true }
        scroll.setContentHuggingPriority(.defaultLow, for: .vertical)

        placeholder.textColor = .secondaryLabelColor
        placeholder.translatesAutoresizingMaskIntoConstraints = false
        main.addSubview(placeholder)
        NSLayoutConstraint.activate([placeholder.centerXAnchor.constraint(equalTo: main.centerXAnchor),
                                     placeholder.centerYAnchor.constraint(equalTo: main.centerYAnchor)])

        let split = NSSplitViewController()
        let sideVC = NSViewController(); sideVC.view = side
        let mainVC = NSViewController(); mainVC.view = main
        let sideItem = NSSplitViewItem(sidebarWithViewController: sideVC)
        sideItem.minimumThickness = 180
        sideItem.canCollapse = true
        split.addSplitViewItem(sideItem)
        split.addSplitViewItem(NSSplitViewItem(viewController: mainVC))
        split.splitView.autosaveName = "ab-tree-split"
        window.contentViewController = split
        window.setContentSize(NSSize(width: 1400, height: 900)) // the split controller shrinks it to fit
        window.minSize = NSSize(width: 600, height: 300)
        window.title = "threads"
        window.setFrameAutosaveName("ab-tree-window")
        if !window.setFrameUsingName("ab-tree-window") { window.center() }
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(nil) // the filter field takes focus only when asked
        if UserDefaults.standard.object(forKey: "NSSplitView Subview Frames ab-tree-split") == nil {
            split.splitView.layoutSubtreeIfNeeded()
            split.splitView.setPosition(300, ofDividerAt: 0)
        }
    }

    func say(_ text: String) { status.stringValue = text; status.toolTip = text }

    func updateWhere() {
        let row = rows.first { $0.id == (hovered ?? shown) }
        let text = row?.blocked ?? row.map { ($0.cwd as NSString).abbreviatingWithTildeInPath } ?? ""
        where_.stringValue = text; where_.toolTip = text
    }

    // MARK: registry

    func refresh() async {
        do {
            let fresh = try await AB.list(tree: saved.mode)
            if fresh != rows { rows = fresh; rebuild() }
            if let id = shown, !rows.contains(where: { $0.id == id }) { close(saying: "Thread ended") }
        } catch { say(error.localizedDescription) }
    }

    func rebuild() {
        let query = search.stringValue
        let byId = Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var keep = Set(rows.filter { $0.matches(query) }.map(\.id))
        for id in keep {
            var parent = byId[id]?.parent, seen = Set<String>()
            while let p = parent, !seen.contains(p) { seen.insert(p); keep.insert(p); parent = byId[p]?.parent }
        }
        var fresh: [String: Node] = [:]
        roots = []
        for row in rows where keep.contains(row.id) {
            let node = nodes[row.id] ?? Node(row)
            node.row = row; node.children = []
            fresh[row.id] = node
        }
        for row in rows where keep.contains(row.id) {
            if let p = row.parent, let parent = fresh[p] { parent.children.append(fresh[row.id]!) } else { roots.append(fresh[row.id]!) }
        }
        nodes = fresh
        reloading = true
        outline.reloadData()
        for row in rows {
            guard let node = nodes[row.id], !node.children.isEmpty else { continue }
            if saved.collapsed.contains(row.id) { outline.collapseItem(node) } else { outline.expandItem(node) }
        }
        selectShown()
        reloading = false
        updateWhere()
    }

    func selectShown() {
        let index = shown.flatMap { nodes[$0] }.map { outline.row(forItem: $0) } ?? -1
        if index >= 0 { outline.selectRowIndexes([index], byExtendingSelection: false) } else { outline.deselectAll(nil) }
    }

    // MARK: outline

    func outlineView(_: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int { (item as? Node)?.children.count ?? roots.count }
    func outlineView(_: NSOutlineView, child index: Int, ofItem item: Any?) -> Any { (item as? Node)?.children[index] ?? roots[index] }
    func outlineView(_: NSOutlineView, isItemExpandable item: Any) -> Bool { !((item as? Node)?.children.isEmpty ?? true) }

    func outlineView(_: NSOutlineView, viewFor _: NSTableColumn?, item: Any) -> NSView? {
        guard let node = item as? Node else { return nil }
        let id = node.id
        var actions: [Action] = [.new, .worktree, .fork, .merge, .archive, .abandon]
        if !node.children.isEmpty { actions.append(.children) }
        let cell = ThreadCell(row: node.row, shown: id == shown, actions: actions) { [weak self] a in self?.act(a, on: id) }
        cell.onHover = { [weak self] inside in
            guard let self else { return }
            if inside { hovered = id } else if hovered == id { hovered = nil }
            updateWhere()
        }
        return cell
    }

    func outlineViewSelectionDidChange(_: Notification) {
        guard !reloading, let node = outline.item(atRow: outline.selectedRow) as? Node else { return }
        open(node.id)
    }

    func outlineViewItemDidCollapse(_ note: Notification) { fold(note, collapsed: true) }
    func outlineViewItemDidExpand(_ note: Notification) { fold(note, collapsed: false) }
    func fold(_ note: Notification, collapsed: Bool) {
        guard !reloading, let node = note.userInfo?["NSObject"] as? Node else { return }
        saved.collapsed.removeAll { $0 == node.id }
        if collapsed { saved.collapsed.append(node.id) }
        saved.save()
    }

    func menu(forRow index: Int) -> NSMenu? {
        guard let node = outline.item(atRow: index) as? Node else { return nil }
        let menu = NSMenu()
        for a in Action.allCases where a != .children || !node.children.isEmpty {
            if a == .merge { menu.addItem(.separator()) }
            let item = NSMenuItem(title: a.title, action: #selector(menuAct(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = [a.rawValue, node.id]
            menu.addItem(item)
        }
        menu.addItem(.separator())
        let timeline = NSMenuItem(title: "Timeline", action: #selector(menuTimeline(_:)), keyEquivalent: "")
        timeline.target = self; timeline.representedObject = node.id
        menu.addItem(timeline)
        return menu
    }

    @objc func menuAct(_ sender: NSMenuItem) {
        guard let pair = sender.representedObject as? [String], let a = Action(rawValue: pair[0]) else { return }
        act(a, on: pair[1])
    }

    @objc func menuTimeline(_ sender: NSMenuItem) { timeline(sender.representedObject as? String) }

    // MARK: terminal

    func open(_ id: String) {
        guard let row = rows.first(where: { $0.id == id }) else { return }
        if shown == id, let surface { window.makeFirstResponder(surface); return }
        close(saying: nil)
        let view = ThreadSurface(frame: main.bounds)
        view.autoresizingMask = [.width, .height]
        view.delegate = self
        view.controller = ghostty
        view.configuration = TerminalSurfaceOptions(backend: .exec, workingDirectory: row.cwd, command: AB.attachCommand(id),
                                                    waitAfterCommand: false, resizeThrottleMilliseconds: 60)
        main.addSubview(view)
        surface = view
        shown = id
        saved.shown = id
        saved.save()
        placeholder.isHidden = true
        window.title = row.label
        window.makeFirstResponder(view)
        reloadCells()
    }

    func close(saying text: String?) {
        guard surface != nil || text != nil else { return }
        surface?.delegate = nil
        surface?.removeFromSuperview()
        surface = nil
        shown = nil
        if text != nil { saved.shown = nil; saved.save() }
        placeholder.stringValue = text ?? "Choose a thread"
        placeholder.isHidden = false
        window.title = "threads"
        reloadCells()
    }

    /// Redraw rows for the bold shown marker without rebuilding the tree.
    func reloadCells() {
        reloading = true
        outline.reloadData()
        selectShown()
        reloading = false
        updateWhere()
    }

    func terminalDidClose(processAlive _: Bool) {
        close(saying: "Detached. Click the thread to reattach.")
    }

    func terminalDidChangeTitle(_: String) {}

    // MARK: actions

    func act(_ a: Action, on id: String?) {
        guard !busy else { return }
        let row = id.flatMap { id in rows.first { $0.id == id } }
        switch a {
        case .new, .fork:
            if a == .fork && row == nil { return }
            run(a.rawValue, row, nil)
        case .worktree:
            ask("New thread in a worktree", field: "Branch name") { [weak self] name in self?.run(a.rawValue, row, name) }
        default:
            guard let row else { return }
            let verb = a == .children ? "Abandon all children in the \(saved.mode) tree of" : a.rawValue.capitalized
            let alert = NSAlert()
            alert.messageText = "\(verb) \(row.label)?"
            alert.informativeText = a == .abandon || a == .children
                ? "Discards without merging, recursively." : "Merges into its parent and retires, recursively."
            alert.addButton(withTitle: a.rawValue.capitalized)
            alert.addButton(withTitle: "Cancel")
            if a == .abandon || a == .children { alert.buttons[0].hasDestructiveAction = true }
            alert.beginSheetModal(for: window) { [weak self] response in
                if response == .alertFirstButtonReturn { self?.run(a.rawValue, row, nil) }
            }
        }
    }

    func ask(_ title: String, field placeholder: String, then: @escaping (String) -> Void) {
        let alert = NSAlert()
        alert.messageText = title
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        input.placeholderString = placeholder
        alert.accessoryView = input
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.window.initialFirstResponder = input
        alert.beginSheetModal(for: window) { response in
            let text = input.stringValue.trimmingCharacters(in: .whitespaces)
            if response == .alertFirstButtonReturn, !text.isEmpty { then(text) }
        }
    }

    func run(_ action: String, _ row: ThreadRow?, _ name: String?) {
        busy = true
        say("working…")
        Task {
            defer { busy = false }
            do {
                let result = try await AB.perform(action, id: row?.id, tree: saved.mode, name: name)
                if let id = shown, result.closed.contains(id) { close(saying: "Retired") }
                say(result.closed.isEmpty ? "" : "retired \(result.closed.count) thread(s)")
                await refresh()
                if let id = result.thread { open(id) }
            } catch { say(error.localizedDescription) }
        }
    }

    func timeline(_ id: String?) {
        guard let row = rows.first(where: { $0.id == id }) else { return }
        say("timeline…")
        Task {
            do { say(try await AB.run(["timeline", row.sessionId]).trimmingCharacters(in: .whitespacesAndNewlines)) }
            catch { say(error.localizedDescription) }
        }
    }

    // MARK: menu commands (they act on the shown thread)

    @objc func newThread(_: Any?) { act(.new, on: shown) }
    @objc func newWorktree(_: Any?) { act(.worktree, on: shown) }
    @objc func forkThread(_: Any?) { act(.fork, on: shown) }
    @objc func mergeThread(_: Any?) { act(.merge, on: shown) }
    @objc func archiveThread(_: Any?) { act(.archive, on: shown) }
    @objc func abandonThread(_: Any?) { act(.abandon, on: shown) }
    @objc func abandonChildren(_: Any?) { act(.children, on: shown) }
    @objc func showTimeline(_: Any?) { timeline(shown) }
    @objc func openProject(_: Any?) {
        guard !busy else { return }
        ask("New thread in a project", field: "Path or zoxide query") { [weak self] text in self?.run("project", nil, text) }
    }
    @objc func refreshNow(_: Any?) { Task { await refresh() } }
    @objc func focusFilter(_: Any?) { window.makeFirstResponder(search) }
    @objc func toggleTree(_: Any?) { modes.selectedSegment = 1 - modes.selectedSegment; modeChanged() }
    @objc func modeChanged() {
        saved.mode = modes.selectedSegment == 1 ? "merge" : "spawn"
        saved.save()
        rows = []
        Task { await refresh() }
    }

    @objc func previousThread(_: Any?) { step(-1) }
    @objc func nextThread(_: Any?) { step(1) }
    @objc func gotoThread(_ sender: NSMenuItem) { if let node = outline.item(atRow: sender.tag) as? Node { open(node.id) } }
    func step(_ delta: Int) {
        guard outline.numberOfRows > 0 else { return }
        let current = shown.flatMap { nodes[$0] }.map { outline.row(forItem: $0) } ?? -1
        let next = current < 0 ? 0 : max(0, min(outline.numberOfRows - 1, current + delta))
        if let node = outline.item(atRow: next) as? Node { open(node.id) }
    }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        switch item.action {
        case #selector(forkThread(_:)), #selector(mergeThread(_:)), #selector(archiveThread(_:)),
             #selector(abandonThread(_:)), #selector(showTimeline(_:)):
            return shown != nil && !busy
        case #selector(abandonChildren(_:)):
            return shown.flatMap { nodes[$0] }.map { !$0.children.isEmpty } ?? false
        case #selector(gotoThread(_:)):
            return item.tag < outline.numberOfRows
        case #selector(newThread(_:)), #selector(newWorktree(_:)), #selector(openProject(_:)):
            return !busy
        default:
            return true
        }
    }

    // MARK: filter field

    func controlTextDidChange(_: Notification) { rebuild() }
    func control(_: NSControl, textView _: NSTextView, doCommandBy selector: Selector) -> Bool {
        guard selector == #selector(NSResponder.cancelOperation(_:)) || selector == #selector(NSResponder.insertNewline(_:)) else { return false }
        if selector == #selector(NSResponder.cancelOperation(_:)) && !search.stringValue.isEmpty { search.stringValue = ""; rebuild() }
        if let surface { window.makeFirstResponder(surface) }
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_: NSApplication) -> Bool { true }
}
