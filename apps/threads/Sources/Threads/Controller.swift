import AppKit
import GhosttyTerminal

/// The window: the thread sidebar beside the shown thread's workspace (tabs and splits around its pi session).
@MainActor
final class Controller: NSObject, NSApplicationDelegate, NSOutlineViewDataSource, NSOutlineViewDelegate, NSMenuItemValidation {
    var saved = Saved.load()
    var rows: [ThreadRow] = []
    var byId: [String: ThreadRow] = [:]
    var roots: [Node] = []
    var nodes: [String: Node] = [:]
    var shown: String?
    var cursor: String?
    var hovered: String?
    var busy = false
    var reloading = false
    var workspaces: [String: Workspace] = [:]
    var projectCache: [String] = []

    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1400, height: 900),
                          styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
    let outline = PassiveOutline()
    let views = NSSegmentedControl(labels: ["project", "attention"], trackingMode: .selectOne, target: nil, action: nil)
    let where_ = NSTextField(labelWithString: "")
    let status = NSTextField(labelWithString: "")
    let main = NSView()
    let placeholder = NSTextField(labelWithString: "⌘P to open or start a thread")
    // An empty theme: the package's default (Afterglow/Alabaster) is appended after the user's config and wins.
    let ghostty = TerminalController(configFilePath: NSHomeDirectory() + "/.config/ghostty/config", theme: TerminalTheme())
    let palette = Palette()

    static let sections = ["needs-you": "Needs you", "unread": "Unread", "read": "Read", "running": "Running"]
    static let sectionOrder = ["needs-you", "unread", "read", "running"]

    override init() {
        super.init()
        build()
        let restore = saved.shown
        Task {
            await refresh()
            if let id = restore, byId[id] != nil { open(id) }
        }
        Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { if let self, !self.busy { Task { await self.refresh() } } }
        }
        palette.onClose = { [weak self] in self?.focusTerminal() }
    }

    // MARK: layout

    func build() {
        views.selectedSegment = saved.view == "attention" ? 1 : 0
        views.target = self; views.action = #selector(viewChanged)
        views.segmentDistribution = .fillEqually
        views.controlSize = .small
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

        let newProject = Plain(symbol: "folder.badge.plus", tip: "Find or new project (⌘O)") { [weak self] in self?.openProject(nil) }
        let top = NSStackView(views: [views, newProject])
        top.spacing = 4
        top.distribution = .fill
        views.setContentHuggingPriority(.defaultLow, for: .horizontal)
        newProject.setContentHuggingPriority(.required, for: .horizontal)
        let side = NSStackView(views: [top, scroll, where_, status])
        side.orientation = .vertical
        side.alignment = .leading
        side.spacing = 6
        side.edgeInsets = NSEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        for v in [top, scroll] as [NSView] { v.widthAnchor.constraint(equalTo: side.widthAnchor, constant: -16).isActive = true }
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
        if UserDefaults.standard.object(forKey: "NSSplitView Subview Frames ab-tree-split") == nil {
            split.splitView.layoutSubtreeIfNeeded()
            split.splitView.setPosition(300, ofDividerAt: 0)
        }
    }

    func say(_ text: String) { status.stringValue = text; status.toolTip = text }

    func updateWhere() {
        let row = byId[hovered ?? shown ?? ""]
        let text = row?.blocked ?? row.map { ($0.cwd as NSString).abbreviatingWithTildeInPath } ?? ""
        where_.stringValue = text; where_.toolTip = text
    }

    var workspace: Workspace? { shown.flatMap { workspaces[$0] } }
    func focusTerminal() { if let w = workspace { w.focus(w.focused) } }

    // MARK: registry

    func refresh() async {
        do {
            let fresh = try await AB.list(delta: saved.delta ?? "origin")
            if fresh != rows {
                rows = fresh
                byId = Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
                rebuild()
            }
            for (id, w) in workspaces where byId[id] == nil {
                w.teardown()
                workspaces[id] = nil
                if shown == id { show(nil, saying: "Thread ended") }
            }
            if let id = shown, window.isKeyWindow, byId[id]?.attention == "unread" { markSeen(id) }
        } catch { say(error.localizedDescription) }
    }

    func markSeen(_ id: String) {
        Task { _ = try? await AB.perform("seen", id: id) }
    }

    func node(_ key: String, _ kind: Node.Kind, _ row: ThreadRow? = nil) -> Node {
        let n = nodes[key] ?? Node(key: key, kind: kind, row: row)
        n.kind = kind; n.row = row; n.children = []; n.parent = nil
        return n
    }

    /// project: project → interactive threads nested by merge target → their workers by spawn parent.
    /// attention: sections needs-you → unread → read → running → interactive threads → their workers.
    func rebuild() {
        let attention = saved.view == "attention"
        var fresh: [String: Node] = [:]
        var top: [Node] = []
        func header(_ key: String, _ kind: Node.Kind) -> Node {
            if let n = fresh[key] { return n }
            let n = node(key, kind)
            fresh[key] = n
            top.append(n)
            return n
        }
        for row in rows { fresh[row.id] = node(row.id, .thread, row) }
        func home(_ r: ThreadRow) -> String {
            let fallback = attention ? "s:" + r.attention : "p:" + r.project
            if r.interactive {
                if attention { return fallback }
                if let m = r.mergeParent, let p = byId[m], p.interactive, p.project == r.project { return m }
                return fallback
            }
            if let s = r.spawnParent, byId[s] != nil { return s }
            return fallback
        }
        if attention {
            for s in Self.sectionOrder where rows.contains(where: { home($0) == "s:" + s }) { _ = header("s:" + s, .section(s)) }
        }
        let ordered = attention ? rows.sorted { ($0.idleSince ?? $0.created) < ($1.idleSince ?? $1.created) } : rows
        for row in ordered {
            let key = home(row)
            let parent = key.hasPrefix("s:") ? header(key, .section(String(key.dropFirst(2))))
                : key.hasPrefix("p:") ? header(key, .project(String(key.dropFirst(2)))) : fresh[key]!
            let child = fresh[row.id]!
            // A spawn/merge cycle would hide rows: attach them at the top instead.
            var up: Node? = parent, hops = 0, cycle = false
            while let u = up, hops < 128 { if u === child { cycle = true; break }; up = u.parent; hops += 1 }
            let target = cycle ? header(attention ? "s:" + row.attention : "p:" + row.project,
                                        attention ? .section(row.attention) : .project(row.project)) : parent
            target.children.append(child)
            child.parent = target
        }
        if !attention { for p in saved.pinned ?? [] { _ = header("p:" + p, .project(p)) } }
        if attention { top.sort { Self.sectionOrder.firstIndex(of: String($0.key.dropFirst(2)))! < Self.sectionOrder.firstIndex(of: String($1.key.dropFirst(2)))! } }
        roots = top
        nodes = fresh
        reload()
    }

    func reload() {
        reloading = true
        outline.reloadData()
        let collapsed = Set(saved.collapsed[saved.view] ?? [])
        func walk(_ n: Node) {
            guard !n.children.isEmpty else { return }
            if collapsed.contains(n.key) { outline.collapseItem(n) } else { outline.expandItem(n); n.children.forEach(walk) }
        }
        roots.forEach(walk)
        selectCursor()
        reloading = false
        updateWhere()
    }

    func selectCursor() {
        let key = cursor.flatMap { nodes[$0] != nil ? $0 : nil } ?? shown
        let index = key.flatMap { nodes[$0] }.map { outline.row(forItem: $0) } ?? -1
        if index >= 0 { outline.selectRowIndexes([index], byExtendingSelection: false); outline.scrollRowToVisible(index) }
        else { outline.deselectAll(nil) }
    }

    // MARK: outline

    func outlineView(_: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int { (item as? Node)?.children.count ?? roots.count }
    func outlineView(_: NSOutlineView, child index: Int, ofItem item: Any?) -> Any { (item as? Node)?.children[index] ?? roots[index] }
    func outlineView(_: NSOutlineView, isItemExpandable item: Any) -> Bool { !((item as? Node)?.children.isEmpty ?? true) }

    /// Workers under a node, not crossing into other interactive threads.
    func rollup(_ n: Node) -> String {
        var working = 0, idle = 0, needs = 0
        func walk(_ m: Node) {
            for c in m.children {
                guard let r = c.row, !r.interactive else { continue }
                if r.attention == "needs-you" { needs += 1 } else if r.state == "working" { working += 1 } else { idle += 1 }
                walk(c)
            }
        }
        walk(n)
        return [needs > 0 ? "!\(needs)" : "", working > 0 ? "◐\(working)" : "", idle > 0 ? "○\(idle)" : ""]
            .filter { !$0.isEmpty }.joined(separator: " ")
    }

    func outlineView(_: NSOutlineView, viewFor _: NSTableColumn?, item: Any) -> NSView? {
        guard let n = item as? Node else { return nil }
        switch n.kind {
        case .section(let s):
            return RowCell(glyph: nil, title: Self.sections[s] ?? s, detail: "\(n.children.count)", bold: false, dim: false, header: true, buttons: [])
        case .project(let path):
            let plus = Plain(symbol: "plus", tip: "New thread in a worktree of " + (path as NSString).lastPathComponent) { [weak self] in
                self?.spawn("new", nil, project: path)
            }
            let cell = RowCell(glyph: nil, title: (path as NSString).lastPathComponent, detail: "", bold: false, dim: false, header: true, buttons: [plus])
            return cell
        case .thread:
            guard let row = n.row else { return nil }
            let id = row.id
            var bits: [String] = []
            if saved.view == "attention" { bits.append(row.projectName) }
            let r = rollup(n)
            if !r.isEmpty { bits.append(r) }
            if row.blocked != nil { bits.append("blocked") }
            let buttons: [NSView] = row.interactive ? [startCombo(id), endCombo(id)]
                : [Plain(symbol: "trash", tip: "Abandon") { [weak self] in self?.confirmAbandon(id) }]
            let cell = RowCell(glyph: row.status, title: row.label, detail: bits.joined(separator: " "),
                               bold: id == shown, dim: !row.interactive, header: false, delta: row.delta, deltaTip: row.deltaTip, buttons: buttons)
            cell.onHover = { [weak self] inside in
                guard let self else { return }
                if inside { hovered = id } else if hovered == id { hovered = nil }
                updateWhere()
            }
            return cell
        }
    }

    func startCombo(_ id: String) -> Combo {
        Combo(symbol: "plus", tip: "New child worktree (⌥ sibling, ⇧ fork)", menu: startMenu(id)) { [weak self] in
            let mods = NSApp.currentEvent?.modifierFlags ?? []
            self?.spawn(mods.contains(.shift) ? "fork" : "new", id, sibling: mods.contains(.option))
        }
    }

    func endCombo(_ id: String) -> Combo {
        Combo(symbol: "arrow.triangle.merge", tip: "Merge into its parent and retire", menu: endMenu(id)) { [weak self] in self?.confirmMerge(id) }
    }

    func menuItem(_ title: String, _ run: @escaping () -> Void) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: #selector(runClosure(_:)), keyEquivalent: "")
        item.target = self
        item.representedObject = run
        return item
    }
    @objc func runClosure(_ sender: NSMenuItem) { (sender.representedObject as? () -> Void)?() }

    func startMenu(_ id: String) -> NSMenu {
        let m = NSMenu()
        m.addItem(menuItem("New Child Worktree") { [weak self] in self?.spawn("new", id) })
        m.addItem(menuItem("New Sibling Worktree") { [weak self] in self?.spawn("new", id, sibling: true) })
        m.addItem(menuItem("Fork Into Child Worktree") { [weak self] in self?.spawn("fork", id) })
        m.addItem(menuItem("Fork Into Sibling Worktree") { [weak self] in self?.spawn("fork", id, sibling: true) })
        return m
    }

    func endMenu(_ id: String) -> NSMenu {
        let m = NSMenu()
        m.addItem(menuItem("Merge") { [weak self] in self?.confirmMerge(id) })
        m.addItem(menuItem("Merge & Continue") { [weak self] in self?.perform("continue", id) })
        m.addItem(.separator())
        m.addItem(menuItem("Abandon") { [weak self] in self?.confirmAbandon(id) })
        return m
    }

    func menu(forRow index: Int) -> NSMenu? {
        guard let n = outline.item(atRow: index) as? Node else { return nil }
        if case .project(let path) = n.kind { return projectMenu(path) }
        guard let row = n.row else { return nil }
        let menu = NSMenu()
        if row.interactive {
            startMenu(row.id).items.forEach { $0.menu?.removeItem($0); menu.addItem($0) }
            menu.addItem(.separator())
            endMenu(row.id).items.forEach { $0.menu?.removeItem($0); menu.addItem($0) }
        } else {
            menu.addItem(menuItem("Abandon") { [weak self] in self?.confirmAbandon(row.id) })
        }
        menu.addItem(.separator())
        menu.addItem(menuItem("Mark Read") { [weak self] in self?.markSeen(row.id) })
        menu.addItem(menuItem("Timeline") { [weak self] in self?.timeline(row.id) })
        return menu
    }

    func projectMenu(_ path: String) -> NSMenu {
        let menu = NSMenu()
        let name = (path as NSString).lastPathComponent
        menu.addItem(menuItem("New Thread") { [weak self] in self?.spawn("new", nil, project: path) })
        menu.addItem(.separator())
        let pinned = isPinned(path)
        menu.addItem(menuItem(pinned ? "Unpin" : "Pin") { [weak self] in self?.pin(path, !pinned) })
        menu.addItem(menuItem("Abandon All Threads…") { [weak self] in
            guard let self else { return }
            let ids = rows.filter { $0.project == path && $0.interactive }.map(\.id)
            confirm("Abandon every thread in \(name)?", "\(ids.count) thread(s) and their workers are discarded without merging; their worktrees are removed.",
                    button: "Abandon All", destructive: true) { [weak self] in self?.abandonAll(ids) }
        })
        return menu
    }

    func isPinned(_ path: String) -> Bool { saved.pinned?.contains(path) ?? false }
    /// Unpinning a project with threads changes nothing visible until its last thread ends.
    func pin(_ path: String, _ on: Bool) {
        var p = (saved.pinned ?? []).filter { $0 != path }
        if on { p.append(path) }
        saved.pinned = p
        saved.save()
        rebuild()
    }

    func abandonAll(_ ids: [String]) {
        guard !busy else { return }
        busy = true
        say("abandon…")
        Task {
            defer { busy = false }
            var closed = 0
            for id in ids {
                do { closed += try await AB.perform("abandon", id: id).closed.count }
                catch { say(error.localizedDescription); break }
            }
            if closed > 0 { say("retired \(closed) thread(s)") }
            await refresh()
        }
    }

    func outlineViewSelectionDidChange(_: Notification) {
        guard !reloading, let n = outline.item(atRow: outline.selectedRow) as? Node else { return }
        cursor = n.key
        if n.row != nil { open(n.key) }
    }

    func outlineViewItemDidCollapse(_ note: Notification) { fold(note, collapsed: true) }
    func outlineViewItemDidExpand(_ note: Notification) { fold(note, collapsed: false) }
    func fold(_ note: Notification, collapsed: Bool) {
        guard !reloading, let n = note.userInfo?["NSObject"] as? Node else { return }
        var keys = saved.collapsed[saved.view] ?? []
        keys.removeAll { $0 == n.key }
        if collapsed { keys.append(n.key) }
        saved.collapsed[saved.view] = keys
        saved.save()
    }

    // MARK: workspaces

    func open(_ id: String) {
        guard let row = byId[id] else { return }
        let w = workspaces[id] ?? {
            let w = Workspace(id: id, cwd: row.cwd, controller: ghostty)
            workspaces[id] = w
            return w
        }()
        if shown != id {
            workspace?.view.removeFromSuperview()
            w.view.frame = main.bounds
            w.view.autoresizingMask = [.width, .height]
            main.addSubview(w.view)
            shown = id
            cursor = id
            saved.shown = id
            saved.save()
            placeholder.isHidden = true
            window.title = row.label
            reload()
        }
        if w.isDetached { w.reattach() }
        w.focus(w.focused)
        if row.attention == "unread" { markSeen(id) }
    }

    func show(_ id: String?, saying text: String) {
        workspace?.view.removeFromSuperview()
        shown = nil
        saved.shown = nil
        saved.save()
        placeholder.stringValue = text
        placeholder.isHidden = false
        window.title = "threads"
        reload()
    }

    // MARK: actions (ab owns them)

    func spawn(_ kind: String, _ id: String?, sibling: Bool = false, name: String? = nil, project: String? = nil, makeProject: Bool = false) {
        perform(kind, id, sibling: sibling, name: name, project: project, makeProject: makeProject)
    }

    func confirm(_ title: String, _ info: String, button: String, destructive: Bool, then: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = info
        alert.addButton(withTitle: button)
        alert.addButton(withTitle: "Cancel")
        alert.buttons[0].hasDestructiveAction = destructive
        alert.beginSheetModal(for: window) { response in if response == .alertFirstButtonReturn { then() } }
    }

    func confirmMerge(_ id: String) {
        guard let row = byId[id] else { return }
        confirm("Merge \(row.label)?", "Merges into its parent worktree and retires it with its workers.", button: "Merge", destructive: false) { [weak self] in
            self?.perform("merge", id)
        }
    }

    func confirmAbandon(_ id: String) {
        guard let row = byId[id] else { return }
        confirm("Abandon \(row.label)?", "Discards without merging, with its workers.", button: "Abandon", destructive: true) { [weak self] in
            self?.perform("abandon", id)
        }
    }

    func perform(_ action: String, _ id: String?, sibling: Bool = false, name: String? = nil, project: String? = nil, makeProject: Bool = false) {
        guard !busy else { return }
        busy = true
        say(action + "…")
        Task {
            defer { busy = false }
            do {
                let result = try await AB.perform(action, id: id, sibling: sibling, name: name, project: project, makeProject: makeProject)
                say(action == "continue" ? "merged; session continues" : result.closed.isEmpty ? "" : "retired \(result.closed.count) thread(s)")
                await refresh()
                // A project made here is pinned, under the path the registry knows it by.
                if makeProject, let id = result.thread, let p = byId[id]?.project { pin(p, true) }
                if let id = result.thread { open(id) }
            } catch { say(error.localizedDescription) }
        }
    }

    func timeline(_ id: String?) {
        guard let row = byId[id ?? ""] else { return }
        say("timeline…")
        Task {
            do { say(try await AB.run(["timeline", row.sessionId]).trimmingCharacters(in: .whitespacesAndNewlines)) }
            catch { say(error.localizedDescription) }
        }
    }

    // MARK: menu commands: thread verbs act on the shown thread

    @objc func newChild(_: Any?) { spawn("new", shown) }
    @objc func newSibling(_: Any?) { spawn("new", shown, sibling: true) }
    @objc func forkChild(_: Any?) { spawn("fork", shown) }
    @objc func forkSibling(_: Any?) { spawn("fork", shown, sibling: true) }
    @objc func mergeThread(_: Any?) { if let id = shown { confirmMerge(id) } }
    @objc func mergeContinue(_: Any?) { if let id = shown { perform("continue", id) } }
    @objc func abandonThread(_: Any?) { if let id = shown { confirmAbandon(id) } }
    @objc func showTimeline(_: Any?) { timeline(shown) }
    @objc func refreshNow(_: Any?) { Task { await refresh() } }
    @objc func toggleDeltaBase(_: Any?) {
        saved.delta = saved.delta == "local" ? "origin" : "local"
        saved.save()
        Task { await refresh() }
    }
    @objc func toggleView(_: Any?) { views.selectedSegment = 1 - views.selectedSegment; viewChanged() }
    @objc func viewChanged() {
        saved.view = views.selectedSegment == 1 ? "attention" : "project"
        saved.save()
        cursor = shown
        rebuild()
    }

    // panes and tabs, as in Ghostty
    @objc func splitRight(_: Any?) { workspace?.split(right: true) }
    @objc func splitDown(_: Any?) { workspace?.split(right: false) }
    @objc func newTab(_: Any?) { workspace?.newTab() }
    @objc func closePane(_: Any?) { if workspace?.closeFocused() != true { NSSound.beep() } }
    @objc func previousPane(_: Any?) { workspace?.cyclePane(-1) }
    @objc func nextPane(_: Any?) { workspace?.cyclePane(1) }
    @objc func previousTab(_: Any?) { workspace?.cycleTab(-1) }
    @objc func nextTab(_: Any?) { workspace?.cycleTab(1) }
    @objc func gotoTab(_ sender: NSMenuItem) { workspace?.show(tab: sender.tag) }

    // ⌃⌘hjkl: a zipper over the current view's tree; landing on a thread shows it
    @objc func treeDown(_: Any?) { step(1) }
    @objc func treeUp(_: Any?) { step(-1) }
    @objc func treeOut(_: Any?) { if let n = here?.parent { land(n) } }
    @objc func treeIn(_: Any?) {
        guard let n = here, let first = n.children.first else { return }
        if !outline.isItemExpanded(n) { outline.expandItem(n) }
        land(first)
    }
    var here: Node? { (cursor ?? shown).flatMap { nodes[$0] } }
    func step(_ delta: Int) {
        guard let n = here else { if let first = roots.first { land(first) }; return }
        let siblings = n.parent?.children ?? roots
        guard let i = siblings.firstIndex(where: { $0 === n }) else { return }
        land(siblings[max(0, min(siblings.count - 1, i + delta))])
    }
    func land(_ n: Node) {
        cursor = n.key
        if n.row != nil { open(n.key) } else { reloading = true; selectCursor(); reloading = false }
    }

    // ⌘P finds or makes threads and projects; ⌘O (and the sidebar's folder button) only projects.
    @objc func quickOpen(_: Any?) { find(projectsOnly: false) }
    @objc func openProject(_: Any?) { find(projectsOnly: true) }

    func find(projectsOnly: Bool) {
        if projectCache.isEmpty { Task { projectCache = await AB.projects(); palette.reload() } }
        let placeholder = projectsOnly ? "Find a project, or name a new one (~/dev/NAME or a path)"
            : "Find a thread or project, or name a new one"
        palette.open(over: window, placeholder: placeholder) { [weak self] q in
            guard let self else { return [] }
            var items: [Palette.Item] = [], named: [Palette.Item] = []
            let q = q.trimmingCharacters(in: .whitespaces)
            if !projectsOnly {
                let threads = rows.filter { $0.matches(q) }.sorted { $0.interactive && !$1.interactive }
                for r in threads.prefix(40) {
                    items.append(.init(title: r.status.0 + "  " + r.label, detail: r.projectName + (r.interactive ? "" : " · worker")) { [weak self] in self?.open(r.id) })
                }
                let slug = q.lowercased().map { $0.isLetter || $0.isNumber ? String($0) : "-" }.joined()
                    .split(separator: "-").joined(separator: "-")
                // A path names a project, never a thread; named threads come after the projects.
                if !slug.isEmpty, !q.contains("/"), !q.hasPrefix("~"), let id = shown, let row = byId[id], row.interactive {
                    named.append(.init(title: "New thread “\(slug)” as a child of \(row.label)", detail: row.projectName) { [weak self] in
                        self?.spawn("new", id, name: slug)
                    })
                    named.append(.init(title: "New thread “\(slug)” as a sibling of \(row.label)", detail: row.projectName) { [weak self] in
                        self?.spawn("new", id, sibling: true, name: slug)
                    })
                }
            }
            // Projects: the ones with threads first, then zoxide's. Match on the name unless the query names a path.
            let live = Array(Set(rows.filter(\.interactive).map(\.project))).sorted()
            let known = live + projectCache.filter { !live.contains($0) }
            let words = q.lowercased().split(separator: " ")
            let key = { (p: String) in (q.contains("/") ? p : (p as NSString).lastPathComponent).lowercased() }
            let target = q.hasPrefix("~") || q.contains("/") ? (q as NSString).expandingTildeInPath : NSHomeDirectory() + "/dev/" + q
            var exact = false
            var shownProjects = 0
            for p in known where (projectsOnly || !q.isEmpty) && words.allSatisfy({ key(p).contains($0) }) {
                let name = (p as NSString).lastPathComponent, path = (p as NSString).abbreviatingWithTildeInPath
                if name.lowercased() == q.lowercased() || p == target { exact = true }
                if let latest = rows.filter({ $0.project == p && $0.interactive }).max(by: { $0.created < $1.created }) {
                    items.append(.init(title: "▸  " + name, detail: latest.label + " · " + path) { [weak self] in self?.open(latest.id) })
                }
                items.append(.init(title: "New thread in " + name, detail: path) { [weak self] in self?.spawn("new", nil, project: p) })
                if projectsOnly, !isPinned(p) {
                    items.append(.init(title: "Pin " + name, detail: path) { [weak self] in self?.pin(p, true) })
                }
                shownProjects += 1
                if shownProjects >= 40 { break }
            }
            items += named
            if !q.isEmpty, !exact {
                items.append(.init(title: "New project “\(q)”", detail: (target as NSString).abbreviatingWithTildeInPath) { [weak self] in
                    self?.spawn("new", nil, project: target, makeProject: true)
                })
            }
            if projectsOnly {
                items.append(.init(title: "Choose a folder…", detail: "any directory; made a git repo if it isn't one") { [weak self] in self?.chooseFolder() })
            }
            return items
        }
    }

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.prompt = "Start Thread"
        panel.directoryURL = URL(fileURLWithPath: NSHomeDirectory() + "/dev")
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            self?.spawn("new", nil, project: url.path, makeProject: true)
        }
    }

    // ⇧⌘P: every enabled menu command
    @objc func commandPalette(_: Any?) {
        var commands: [(String, NSMenuItem)] = []
        func walk(_ menu: NSMenu, _ path: String) {
            for item in menu.items {
                if let sub = item.submenu { walk(sub, item.title); continue }
                guard let action = item.action, action != #selector(commandPalette(_:)), !item.isSeparatorItem else { continue }
                commands.append((path + " › " + item.title, item))
            }
        }
        if let bar = NSApp.mainMenu { walk(bar, "") }
        palette.open(over: window, placeholder: "Command") { [weak self] q in
            guard let self else { return [] }
            let words = q.lowercased().split(separator: " ")
            return commands.filter { c in words.allSatisfy { c.0.lowercased().contains($0) } && self.validateMenuItem(c.1) }
                .map { c in
                    let keys = c.1.keyEquivalent.isEmpty ? "" : Self.keys(c.1)
                    return .init(title: c.0, detail: keys) { [weak self] in
                        self?.focusTerminal()
                        NSApp.sendAction(c.1.action!, to: c.1.target, from: c.1)
                    }
                }
        }
    }

    static func keys(_ item: NSMenuItem) -> String {
        let m = item.keyEquivalentModifierMask
        let key = item.keyEquivalent
        return (m.contains(.control) ? "⌃" : "") + (m.contains(.option) ? "⌥" : "") + (m.contains(.shift) || key != key.lowercased() ? "⇧" : "")
            + (m.contains(.command) ? "⌘" : "") + key.uppercased()
    }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        let interactive = shown.flatMap { byId[$0] }?.interactive ?? false
        switch item.action {
        case #selector(newChild(_:)), #selector(newSibling(_:)), #selector(forkChild(_:)), #selector(forkSibling(_:)),
             #selector(mergeThread(_:)), #selector(mergeContinue(_:)):
            return interactive && !busy
        case #selector(abandonThread(_:)), #selector(showTimeline(_:)):
            return shown != nil && !busy
        case #selector(splitRight(_:)), #selector(splitDown(_:)), #selector(newTab(_:)), #selector(closePane(_:)),
             #selector(previousPane(_:)), #selector(nextPane(_:)), #selector(previousTab(_:)), #selector(nextTab(_:)):
            return workspace != nil
        case #selector(toggleDeltaBase(_:)):
            item.state = saved.delta == "local" ? .on : .off
            return true
        case #selector(gotoTab(_:)):
            return item.tag < (workspace?.tabs.count ?? 0)
        default:
            return true
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_: NSApplication) -> Bool { true }
}
