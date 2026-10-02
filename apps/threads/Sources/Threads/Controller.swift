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
    /// Scratch workspaces: shells under the Scratchpad header, not threads. They live as long as the app.
    var scratch: [Workspace] = []
    var unread: Set<String> = []
    static let scratchpad = "x:scratchpad"
    static let projectDrag = NSPasteboard.PasteboardType("app.threads.project")
    static let threadDrag = NSPasteboard.PasteboardType("app.threads.thread")

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
        outline.style = .fullWidth // sourceList insets rows ~10pt from the sidebar edge
        outline.indentationPerLevel = 12
        outline.columnAutoresizingStyle = .uniformColumnAutoresizingStyle
        outline.dataSource = self
        outline.delegate = self
        outline.registerForDraggedTypes([Self.projectDrag, Self.threadDrag])
        outline.setDraggingSourceOperationMask(.move, forLocal: true)
        outline.setDraggingSourceOperationMask([], forLocal: false)
        outline.menuForRow = { [weak self] row in self?.menu(forRow: row) }
        let scroll = NSScrollView()
        scroll.documentView = outline
        scroll.hasVerticalScroller = true
        scroll.scrollerStyle = .overlay
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false

        let newProject = Plain(symbol: "folder.badge.plus", tip: "Find or new project (⌘O)") { [weak self] in self?.openProject(nil) }
        let top = NSStackView(views: [views, newProject])
        top.spacing = 4
        top.distribution = .fill
        views.setContentHuggingPriority(.defaultLow, for: .horizontal)
        newProject.setContentHuggingPriority(.required, for: .horizontal)
        top.edgeInsets = NSEdgeInsets(top: 0, left: 8, bottom: 0, right: 8)
        let foot = NSStackView(views: [where_, status])
        foot.orientation = .vertical
        foot.alignment = .leading
        foot.spacing = 6
        foot.edgeInsets = NSEdgeInsets(top: 0, left: 8, bottom: 0, right: 8)
        for v in [where_, status] { v.widthAnchor.constraint(lessThanOrEqualTo: foot.widthAnchor, constant: -16).isActive = true }
        // rows run edge to edge: only the controls and footer are inset
        let side = NSStackView(views: [top, scroll, foot])
        side.orientation = .vertical
        side.alignment = .leading
        side.spacing = 6
        side.edgeInsets = NSEdgeInsets(top: 8, left: 0, bottom: 8, right: 0)
        for v in [top, scroll, foot] as [NSView] { v.widthAnchor.constraint(equalTo: side.widthAnchor).isActive = true }
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
        let key = hovered ?? shown ?? ""
        let row = byId[key]
        let text = row?.blocked ?? (row?.cwd ?? scratchSpace(key)?.cwd).map { ($0 as NSString).abbreviatingWithTildeInPath } ?? ""
        where_.stringValue = text; where_.toolTip = text
    }

    var workspace: Workspace? { shown.flatMap { workspaces[$0] ?? scratchSpace($0) } }
    func scratchSpace(_ id: String) -> Workspace? { scratch.first { $0.id == id } }
    func focusTerminal() { if let w = workspace { w.focus(w.focused) } }

    // MARK: registry

    func refresh() async {
        do {
            var fresh = try await AB.list(delta: saved.delta ?? "origin")
            for i in fresh.indices { fresh[i].customName = saved.threadNames?[fresh[i].id] }
            if fresh != rows {
                rows = fresh
                byId = Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
                rebuild()
                if let id = shown, let row = byId[id] { window.title = row.displayTitle }
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

    /// project: project (its main checkout) → interactive threads nested by merge target → their workers by spawn parent.
    /// Threads in the main checkout itself sit directly under the project, first by default.
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
        let ordered = attention ? rows.sorted { ($0.idleSince ?? $0.created) < ($1.idleSince ?? $1.created) }
            : rows.filter(\.inPlace) + rows.filter { !$0.inPlace }
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
        if attention { top.sort { Self.sectionOrder.firstIndex(of: String($0.key.dropFirst(2)))! < Self.sectionOrder.firstIndex(of: String($1.key.dropFirst(2)))! } }
        else {
            let order = saved.projectOrder ?? []
            let rank = Dictionary(order.enumerated().map { ("p:" + $0.element, $0.offset) }, uniquingKeysWith: { a, _ in a })
            top = top.enumerated().sorted {
                let a = rank[$0.element.key] ?? order.count, b = rank[$1.element.key] ?? order.count
                return a == b ? $0.offset < $1.offset : a < b
            }.map(\.element)
        }
        // Preserve each sibling group's default order until it has been arranged.
        for parent in fresh.values {
            let order = saved.threadOrder?[saved.view]?[parent.orderingKey] ?? []
            guard !order.isEmpty else { continue }
            let rank = Dictionary(order.enumerated().map { ($0.element, $0.offset) }, uniquingKeysWith: { a, _ in a })
            parent.children = parent.children.enumerated().sorted {
                let a = rank[$0.element.orderingKey] ?? order.count, b = rank[$1.element.orderingKey] ?? order.count
                return a == b ? $0.offset < $1.offset : a < b
            }.map(\.element)
        }
        // The Scratchpad heads both views: shells anywhere, outside the registry.
        let pad = node(Self.scratchpad, .scratchpad)
        fresh[pad.key] = pad
        for w in scratch {
            let n = node(w.id, .scratch)
            n.parent = pad
            pad.children.append(n)
            fresh[w.id] = n
        }
        roots = [pad] + top
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

    // MARK: sidebar ordering

    func outlineView(_: NSOutlineView, pasteboardWriterForItem item: Any) -> NSPasteboardWriting? {
        guard let n = item as? Node else { return nil }
        let writer = NSPasteboardItem()
        switch n.kind {
        case .project(let path) where saved.view == "project":
            writer.setString(path, forType: Self.projectDrag)
        case .thread where n.parent != nil:
            writer.setString(n.orderingKey, forType: Self.threadDrag)
        default: return nil
        }
        return writer
    }

    func outlineView(_: NSOutlineView, draggingSession _: NSDraggingSession, willBeginAt _: NSPoint, forItems _: [Any]) {
        outline.dragged = true
    }

    /// Only insertion within the current parent is a thread move, never reparenting.
    func threadDrop(_ info: NSDraggingInfo, item: Any?, index: Int) -> (parent: Node, source: Int, index: Int)? {
        guard info.draggingSource as? NSOutlineView === outline,
              let key = info.draggingPasteboard.string(forType: Self.threadDrag),
              let n = nodes[key], case .thread = n.kind, let parent = n.parent,
              let source = parent.children.firstIndex(where: { $0 === n }) else { return nil }
        if index == NSOutlineViewDropOnItemIndex, let sibling = item as? Node,
           sibling.parent === parent, let target = parent.children.firstIndex(where: { $0 === sibling }) {
            return (parent, source, target)
        }
        guard item as? Node === parent, index >= 0, index <= parent.children.count else { return nil }
        return (parent, source, index)
    }

    func outlineView(_ view: NSOutlineView, validateDrop info: NSDraggingInfo, proposedItem item: Any?, proposedChildIndex index: Int) -> NSDragOperation {
        if info.draggingPasteboard.string(forType: Self.threadDrag) != nil {
            guard let drop = threadDrop(info, item: item, index: index) else { return [] }
            view.setDropItem(drop.parent, dropChildIndex: drop.index)
            return .move
        }
        guard saved.view == "project", info.draggingSource as? NSOutlineView === outline,
              let path = info.draggingPasteboard.string(forType: Self.projectDrag),
              roots.contains(where: { $0.key == "p:" + path }) else { return [] }
        // Dropping on a project means before it, never inside it. Child rows aren't reparenting targets.
        if let n = item as? Node, case .project = n.kind, let target = roots.firstIndex(where: { $0 === n }) {
            view.setDropItem(nil, dropChildIndex: target)
            return .move
        }
        guard item == nil, index >= 1, index <= roots.count else { return [] }
        return .move
    }

    func outlineView(_: NSOutlineView, acceptDrop info: NSDraggingInfo, item: Any?, childIndex index: Int) -> Bool {
        if info.draggingPasteboard.string(forType: Self.threadDrag) != nil {
            guard let drop = threadDrop(info, item: item, index: index) else { return false }
            let parent = drop.parent
            let moved = parent.children.remove(at: drop.source)
            parent.children.insert(moved, at: drop.index > drop.source ? drop.index - 1 : drop.index)
            let order = parent.children.map(\.orderingKey)
            let previous = saved.threadOrder?[saved.view]?[parent.orderingKey] ?? []
            var orders = saved.threadOrder ?? [:]
            orders[saved.view, default: [:]][parent.orderingKey] = order + previous.filter { !order.contains($0) }
            saved.threadOrder = orders
            saved.save()
            reload()
            return true
        }
        guard saved.view == "project", info.draggingSource as? NSOutlineView === outline,
              item == nil, index >= 1, index <= roots.count,
              let path = info.draggingPasteboard.string(forType: Self.projectDrag),
              let source = roots.firstIndex(where: { $0.key == "p:" + path }) else { return false }
        let moved = roots.remove(at: source)
        roots.insert(moved, at: index > source ? index - 1 : index)
        let order = roots.compactMap { n -> String? in
            if case .project(let path) = n.kind { return path }
            return nil
        }
        // Retain absent projects ahead of projects we haven't seen yet.
        saved.projectOrder = order + (saved.projectOrder ?? []).filter { !order.contains($0) }
        saved.save()
        reload()
        return true
    }

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
        case .scratchpad:
            let plus = Combo(symbol: "plus", tip: "New scratch workspace in ~ (▾ elsewhere)", menu: scratchMenu()) { [weak self] in self?.newScratch() }
            return RowCell(glyph: nil, title: "Scratchpad", detail: "", bold: false, dim: false, header: true, buttons: [plus])
        case .scratch:
            guard let w = scratchSpace(n.key) else { return nil }
            let id = w.id
            let close = Plain(symbol: "xmark", tip: "Close workspace (its shells end)") { [weak self] in self?.closeScratch(id) }
            let dir = (w.cwd as NSString).abbreviatingWithTildeInPath
            let cell = RowCell(glyph: unread.contains(id) ? ("●", .controlAccentColor) : ("$", .tertiaryLabelColor), title: w.label,
                               detail: w.label.contains((w.cwd as NSString).lastPathComponent) || dir.hasSuffix(w.label) ? "" : dir,
                               bold: id == shown, dim: false, header: false, buttons: [close])
            cell.onHover = { [weak self] inside in
                guard let self else { return }
                if inside { hovered = id } else if hovered == id { hovered = nil }
                updateWhere()
            }
            return cell
        case .section(let s):
            return RowCell(glyph: nil, title: Self.sections[s] ?? s, detail: "\(n.children.count)", bold: false, dim: false, header: true, buttons: [])
        case .project(let path):
            let name = (path as NSString).lastPathComponent
            let start = NSMenu()
            start.addItem(menuItem("New Worktree") { [weak self] in self?.spawn("new", nil, project: path) })
            start.addItem(menuItem("Add Existing Worktree…") { [weak self] in self?.chooseWorktree(near: path) })
            let plus = Combo(symbol: "plus", tip: "New worktree in " + name + " (▾ add existing)", menu: start) { [weak self] in
                self?.spawn("new", nil, project: path)
            }
            // The project row is the main checkout, not a thread: threads in it are ordinary children.
            let open = Plain(symbol: "terminal", tip: "Go to a thread in " + name + "'s main checkout, or start one") { [weak self] in self?.openProject(path) }
            return RowCell(glyph: nil, title: name, detail: "", bold: false, dim: false, header: true, buttons: [plus, open])
        case .thread:
            guard let row = n.row else { return nil }
            let id = row.id
            var bits: [String] = []
            if saved.view == "attention" { bits.append(row.projectName) }
            let r = rollup(n)
            if !r.isEmpty { bits.append(r) }
            if row.blocked != nil { bits.append("blocked") }
            let buttons: [NSView] = row.inPlace ? [startCombo(id), Plain(symbol: "xmark", tip: "Close") { [weak self] in self?.confirmClose(id) }]
                : row.interactive ? [startCombo(id), endCombo(id)]
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
        if case .scratchpad = n.kind { return scratchMenu() }
        if case .scratch = n.kind {
            let menu = NSMenu()
            menu.addItem(menuItem("Close Workspace") { [weak self] in self?.closeScratch(n.key) })
            return menu
        }
        guard let row = n.row else { return nil }
        let menu = NSMenu()
        menu.addItem(menuItem("Rename…") { [weak self] in self?.rename(row.id) })
        menu.addItem(menuItem("New Scratch Workspace Here") { [weak self] in self?.newScratch(row.cwd) })
        menu.addItem(.separator())
        if row.inPlace {
            startMenu(row.id).items.forEach { $0.menu?.removeItem($0); menu.addItem($0) }
            menu.addItem(.separator())
            menu.addItem(menuItem("Close…") { [weak self] in self?.confirmClose(row.id) })
        } else if row.interactive {
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
        menu.addItem(menuItem("New Worktree Thread") { [weak self] in self?.spawn("new", nil, project: path) })
        menu.addItem(menuItem("New Thread in Main Checkout") { [weak self] in self?.openProject(path, fresh: true) })
        menu.addItem(menuItem("Add Existing Worktree…") { [weak self] in self?.chooseWorktree(near: path) })
        menu.addItem(menuItem("New Scratch Workspace Here") { [weak self] in self?.newScratch(path) })
        menu.addItem(.separator())
        menu.addItem(.separator())
        menu.addItem(menuItem("Abandon All Threads…") { [weak self] in
            guard let self else { return }
            let ids = rows.filter { $0.project == path && $0.interactive }.map(\.id)
            confirm("Abandon every thread in \(name)?", "\(ids.count) thread(s) and their workers are discarded without merging; their worktrees are removed.",
                    button: "Abandon All", destructive: true) { [weak self] in self?.abandonAll(ids) }
        })
        return menu
    }

    /// Finds a checkout's interactive thread or starts one (fresh: always starts another); makeProject creates the repo first.
    func openProject(_ path: String, makeProject: Bool = false, fresh: Bool = false) { perform(fresh ? "open-new" : "open", nil, project: path, makeProject: makeProject) }

    func confirmClose(_ id: String) {
        guard let row = byId[id] else { return }
        confirm("Close \(row.label)?", "Ends this main-checkout thread and the workers it spawned. The checkout and its worktree threads stay.",
                button: "Close", destructive: false) { [weak self] in self?.perform("merge", id) }
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
                catch { fail("abandon", error); break }
            }
            if closed > 0 { say("retired \(closed) thread(s)") }
            await refresh()
        }
    }

    func outlineViewSelectionDidChange(_: Notification) {
        guard !reloading, let n = outline.item(atRow: outline.selectedRow) as? Node else { return }
        cursor = n.key
        if outline.trackingClick { outline.activateAfterClick = { [weak self] in self?.activate(n) } }
        else { activate(n) }
    }

    func activate(_ n: Node) {
        if let r = n.row { open(r.id) } else if case .scratch = n.kind { openScratch(n.key) }
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
        present(w, title: row.displayTitle, remember: true)
        if w.isDetached { w.reattach() }
        w.focus(w.focused)
        if row.attention == "unread" { markSeen(id) }
    }

    /// Puts a workspace in the main area. Only threads are remembered across launches: scratch shells end with the app.
    func present(_ w: Workspace, title: String, remember: Bool) {
        guard shown != w.id else { return }
        workspace?.view.removeFromSuperview()
        w.view.frame = main.bounds
        w.view.autoresizingMask = [.width, .height]
        main.addSubview(w.view)
        shown = w.id
        cursor = w.id
        if remember { saved.shown = w.id; saved.save() }
        placeholder.isHidden = true
        window.title = title
        reload()
    }

    // MARK: scratch workspaces

    func scratchMenu() -> NSMenu {
        let m = NSMenu()
        m.addItem(menuItem("New Scratch Workspace") { [weak self] in self?.newScratch() })
        m.addItem(menuItem("New Scratch Workspace in Folder…") { [weak self] in self?.chooseScratchFolder() })
        return m
    }

    func newScratch(_ cwd: String = NSHomeDirectory()) {
        let w = Workspace(id: "x:" + UUID().uuidString, cwd: cwd, controller: ghostty, canonical: false)
        let id = w.id
        w.onLabel = { [weak self] in self?.relabel(id) }
        w.onBell = { [weak self] in
            guard let self, shown != id || !window.isKeyWindow else { return }
            unread.insert(id)
            relabel(id)
        }
        w.onEmpty = { [weak self] in self?.closeScratch(id) }
        scratch.append(w)
        rebuild()
        openScratch(id)
    }

    func openScratch(_ id: String) {
        guard let w = scratchSpace(id) else { return }
        unread.remove(id)
        present(w, title: w.label, remember: false)
        relabel(id)
        w.focus(w.focused)
    }

    func relabel(_ id: String) {
        guard let w = scratchSpace(id), let n = nodes[id] else { return }
        if shown == id { window.title = w.label }
        reloading = true
        outline.reloadItem(n)
        selectCursor()
        reloading = false
    }

    func closeScratch(_ id: String) {
        guard let w = scratchSpace(id) else { return }
        scratch.removeAll { $0 === w }
        unread.remove(id)
        w.teardown()
        if shown == id { show(nil, saying: "Workspace closed") }
        rebuild()
    }

    func chooseScratchFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.prompt = "Open Workspace"
        panel.directoryURL = URL(fileURLWithPath: NSHomeDirectory())
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            self?.newScratch(url.path)
        }
    }

    @objc func newScratchWorkspace(_: Any?) { newScratch() }

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

    func rename(_ id: String) {
        guard let row = byId[id] else { return }
        let alert = NSAlert()
        alert.messageText = "Rename Thread"
        alert.informativeText = "Display name only; branches and worktrees stay unchanged. Leave blank to restore the default."
        let field = NSTextField(string: row.customName ?? "")
        field.placeholderString = row.displayTitle
        field.setAccessibilityLabel("Thread name")
        field.frame = NSRect(x: 0, y: 0, width: 360, height: 24)
        alert.accessoryView = field
        alert.addButton(withTitle: "Save")
        alert.addButton(withTitle: "Cancel")
        alert.window.initialFirstResponder = field
        alert.beginSheetModal(for: window) { [weak self] response in
            guard let self else { return }
            if response == .alertFirstButtonReturn { setThreadName(id, field.stringValue) }
            focusTerminal()
        }
    }

    func setThreadName(_ id: String, _ name: String) {
        guard let i = rows.firstIndex(where: { $0.id == id }) else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        var names = saved.threadNames ?? [:]
        names[id] = trimmed.isEmpty ? nil : trimmed
        saved.threadNames = names.isEmpty ? nil : names
        saved.save()
        rows[i].customName = names[id]
        byId[id] = rows[i]
        rebuild()
        if shown == id { window.title = rows[i].displayTitle }
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
                if let id = result.thread { open(id) }
            } catch { fail(action, error) }
        }
    }

    /// A clicked action that failed gets an alert, not only the status line.
    func fail(_ action: String, _ error: Error) {
        say(error.localizedDescription)
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = action.prefix(1).uppercased() + action.dropFirst() + " failed"
        let detail = (error as? AB.Failure)?.detail ?? ""
        alert.informativeText = detail.isEmpty ? error.localizedDescription : detail
        alert.beginSheetModal(for: window)
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
    @objc func renameThread(_: Any?) { if let id = shown { rename(id) } }
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
        if n.row != nil || scratchSpace(n.key) != nil { activate(n) } else { reloading = true; selectCursor(); reloading = false }
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
                let words = q.lowercased().split(separator: " ")
                for w in scratch where words.allSatisfy({ (w.label + " " + w.cwd).lowercased().contains($0) }) {
                    items.append(.init(title: "$  " + w.label, detail: "scratch · " + (w.cwd as NSString).abbreviatingWithTildeInPath) { [weak self] in self?.openScratch(w.id) })
                }
                // A path that is a directory opens a scratch workspace there; anything else, one in ~.
                var isDir: ObjCBool = false
                let dir = (q.hasPrefix("~") || q.hasPrefix("/")) && FileManager.default.fileExists(atPath: (q as NSString).expandingTildeInPath, isDirectory: &isDir) && isDir.boolValue
                    ? (q as NSString).expandingTildeInPath : NSHomeDirectory()
                named.append(.init(title: "New scratch workspace", detail: (dir as NSString).abbreviatingWithTildeInPath) { [weak self] in self?.newScratch(dir) })
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
                // Going to a project means going to its (oldest) main-checkout thread, or starting one.
                if let own = rows.filter({ $0.inPlace && $0.project == p }).min(by: { $0.created < $1.created }) {
                    items.append(.init(title: "▸  " + name, detail: path) { [weak self] in self?.open(own.id) })
                } else {
                    items.append(.init(title: "Open " + name, detail: "thread in the main checkout · " + path) { [weak self] in self?.openProject(p) })
                }
                items.append(.init(title: "New thread in " + name, detail: "worktree · " + path) { [weak self] in self?.spawn("new", nil, project: p) })
                shownProjects += 1
                if shownProjects >= 40 { break }
            }
            items += named
            if !q.isEmpty, !exact {
                items.append(.init(title: "New project “\(q)”", detail: (target as NSString).abbreviatingWithTildeInPath) { [weak self] in
                    self?.openProject(target, makeProject: true)
                })
            }
            if projectsOnly {
                items.append(.init(title: "Choose a folder…", detail: "any directory; made a git repo if it isn't one") { [weak self] in self?.chooseFolder() })
            }
            return items
        }
    }

    func chooseWorktree(near path: String?) {
        guard !busy else { return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Add Thread"
        panel.message = "Choose an existing git worktree. Opens its thread or starts a guest; the checkout stays yours."
        panel.directoryURL = path.map { URL(fileURLWithPath: $0).deletingLastPathComponent() }
            ?? URL(fileURLWithPath: NSHomeDirectory() + "/dev")
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            self?.openProject(url.path)
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
            self?.openProject(url.path, makeProject: true)
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
        case #selector(renameThread(_:)):
            return shown.flatMap { byId[$0] } != nil
        case #selector(abandonThread(_:)), #selector(showTimeline(_:)):
            return shown.flatMap { byId[$0] } != nil && !busy
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
