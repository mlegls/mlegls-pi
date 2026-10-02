import AppKit
import GhosttyTerminal

/// Menu key equivalents get the first look, then Ghostty: the app owns ⌘D/⌘T/⌘W/⌘P…, Ghostty the rest.
final class ThreadSurface: AppTerminalView {
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if NSApp.mainMenu?.performKeyEquivalent(with: event) == true { return true }
        return super.performKeyEquivalent(with: event)
    }
}

/// The surface delegate is weak in GhosttyTerminal; one retained box per surface carries its callbacks.
@MainActor
final class SurfaceBox: NSObject, TerminalSurfaceCloseDelegate, TerminalSurfaceTitleDelegate {
    var onClose: () -> Void = {}
    var onTitle: (String) -> Void = { _ in }
    func terminalDidClose(processAlive _: Bool) { onClose() }
    func terminalDidChangeTitle(_ title: String) { onTitle(title) }
}

/// Holds one child filling it: a tab's root, or the canonical slot while detached.
final class Holder: NSView {
    func put(_ child: NSView) {
        subviews.forEach { $0.removeFromSuperview() }
        child.frame = bounds
        child.autoresizingMask = [.width, .height]
        addSubview(child)
    }
}

/// One worktree's window contents, like a Ghostty window: tabs of splits. Tab 0 starts with the canonical
/// pi session (zmx-backed, attached exclusively); every other pane is a plain shell that lives as long as the app.
@MainActor
final class Workspace: NSObject {
    let id: String
    var cwd: String
    let view = NSView()
    let strip = NSSegmentedControl()
    let content = Holder()
    var tabs: [Holder] = []
    var titles: [ObjectIdentifier: String] = [:]
    var current = 0
    var canonical: ThreadSurface?
    /// The canonical pane's place in tab 0's tree; it survives the surface, so splits around it stay put.
    let piSlot = Holder()
    var boxes: [ObjectIdentifier: SurfaceBox] = [:]
    let controller: TerminalController
    var lastFocus: ThreadSurface?
    var onCanonicalClosed: () -> Void = {}

    init(id: String, cwd: String, controller: TerminalController) {
        self.id = id
        self.cwd = cwd
        self.controller = controller
        super.init()
        strip.target = self
        strip.action = #selector(pickTab)
        strip.segmentStyle = .automatic
        strip.controlSize = .small
        strip.translatesAutoresizingMaskIntoConstraints = false
        content.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(strip)
        view.addSubview(content)
        stripHeight = strip.heightAnchor.constraint(equalToConstant: 0)
        NSLayoutConstraint.activate([
            strip.topAnchor.constraint(equalTo: view.topAnchor, constant: 4),
            strip.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            content.topAnchor.constraint(equalTo: strip.bottomAnchor, constant: 4),
            content.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            content.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        let first = Holder()
        tabs = [first]
        first.put(piSlot)
        attachCanonical()
        show(tab: 0)
    }

    var stripHeight: NSLayoutConstraint!

    func makeSurface(command: String?, canonical isCanonical: Bool) -> ThreadSurface {
        let s = ThreadSurface(frame: NSRect(x: 0, y: 0, width: 800, height: 600))
        let box = SurfaceBox()
        box.onClose = { [weak self, weak s] in
            guard let self, let s else { return }
            if s === self.canonical { self.detached() } else { self.remove(s) }
        }
        box.onTitle = { [weak self, weak s] title in
            guard let self, let s else { return }
            self.titles[ObjectIdentifier(s)] = title
            self.updateStrip()
        }
        boxes[ObjectIdentifier(s)] = box
        s.delegate = box
        s.controller = controller
        s.configuration = TerminalSurfaceOptions(backend: .exec, workingDirectory: cwd, command: command,
                                                 waitAfterCommand: false, resizeThrottleMilliseconds: isCanonical ? 60 : 0)
        return s
    }

    // MARK: tabs

    func show(tab index: Int) {
        current = max(0, min(tabs.count - 1, index))
        content.put(tabs[current])
        updateStrip()
        focus(leaves(tabs[current]).first { $0 === lastFocus } ?? leaves(tabs[current]).first)
    }

    func updateStrip() {
        strip.segmentCount = tabs.count
        for (i, tab) in tabs.enumerated() {
            let first = leaves(tab).first
            let title = i == 0 ? "pi" : first.flatMap { titles[ObjectIdentifier($0)] } ?? "shell"
            strip.setLabel(String(title.prefix(24)), forSegment: i)
        }
        strip.selectedSegment = current
        strip.isHidden = tabs.count < 2
        stripHeight.constant = tabs.count < 2 ? 0 : 22
        stripHeight.isActive = true
    }

    @objc func pickTab() { show(tab: strip.selectedSegment) }

    func newTab() {
        let tab = Holder()
        let s = makeSurface(command: nil, canonical: false)
        tab.put(s)
        tabs.append(tab)
        lastFocus = s
        show(tab: tabs.count - 1)
    }

    func cycleTab(_ delta: Int) { show(tab: (current + delta + tabs.count) % tabs.count) }

    // MARK: splits

    var focused: ThreadSurface? {
        let r = view.window?.firstResponder as? ThreadSurface
        return r.flatMap { s in leaves(tabs[current]).contains { $0 === s } ? s : nil } ?? lastFocus
    }

    func leaves(_ root: NSView) -> [ThreadSurface] {
        if let s = root as? ThreadSurface { return [s] }
        return root.subviews.flatMap(leaves)
    }

    func focus(_ s: ThreadSurface?) {
        guard let s else { return }
        lastFocus = s
        s.window?.makeFirstResponder(s)
    }

    /// Ghostty's new_split: right puts the new pane beside, down below the focused one.
    func split(right: Bool) {
        guard let leaf = focused else { return }
        let target: NSView = leaf === canonical ? piSlot : leaf
        guard let parent = target.superview else { return }
        let fresh = makeSurface(command: nil, canonical: false)
        if let sv = parent as? NSSplitView, sv.isVertical == right {
            let index = sv.subviews.firstIndex(of: target)! + 1
            fresh.frame = target.frame
            var views = sv.subviews
            views.insert(fresh, at: index)
            sv.subviews = views
            sv.adjustSubviews()
        } else {
            let sv = NSSplitView(frame: target.frame)
            sv.isVertical = right
            sv.dividerStyle = .thin
            sv.autoresizingMask = target.autoresizingMask
            replace(target, with: sv)
            target.frame = sv.bounds
            fresh.frame = sv.bounds
            sv.addSubview(target)
            sv.addSubview(fresh)
            sv.adjustSubviews()
            let half = (right ? sv.bounds.width : sv.bounds.height) / 2
            sv.setPosition(half, ofDividerAt: 0)
        }
        focus(fresh)
    }

    func replace(_ old: NSView, with new: NSView) {
        guard let parent = old.superview else { return }
        if let holder = parent as? Holder { holder.put(new); return }
        var views = parent.subviews
        views[views.firstIndex(of: old)!] = new
        new.frame = old.frame
        parent.subviews = views
    }

    /// ⌘W and shell exit. The canonical pane never closes this way.
    func remove(_ s: ThreadSurface) {
        guard s !== canonical, let parent = s.superview else { return }
        let order = leaves(tabs[current])
        let next = order.firstIndex { $0 === s }.map { order[$0 > 0 ? $0 - 1 : min(1, order.count - 1)] }
        s.removeFromSuperview()
        boxes[ObjectIdentifier(s)] = nil
        titles[ObjectIdentifier(s)] = nil
        if let sv = parent as? NSSplitView {
            if sv.subviews.count == 1, let only = sv.subviews.first { replace(sv, with: only); only.autoresizingMask = [.width, .height] }
            else { sv.adjustSubviews() }
        } else if let tab = parent as? Holder, let index = tabs.firstIndex(of: tab), tab.subviews.isEmpty {
            tabs.remove(at: index)
            if tabs.isEmpty { return }
            show(tab: min(current, tabs.count - 1))
            return
        }
        focus(next === s ? nil : next)
    }

    func closeFocused() -> Bool {
        guard let s = focused, s !== canonical else { return false }
        remove(s)
        return true
    }

    func cyclePane(_ delta: Int) {
        let order = leaves(tabs[current])
        guard let s = focused, let i = order.firstIndex(where: { $0 === s }), order.count > 1 else { return }
        focus(order[(i + delta + order.count) % order.count])
    }

    func attachCanonical() {
        let pi = makeSurface(command: AB.attachCommand(id), canonical: true)
        if let old = canonical { boxes[ObjectIdentifier(old)] = nil }
        canonical = pi
        piSlot.put(pi)
        lastFocus = pi
    }

    var isDetached: Bool { canonical == nil }

    /// The canonical session ended here (another client took it, or pi exited); the aux panes stay.
    func detached() {
        if let old = canonical { boxes[ObjectIdentifier(old)] = nil }
        canonical = nil
        let label = NSTextField(labelWithString: "Detached. Select the thread to reattach.")
        label.textColor = .secondaryLabelColor
        label.translatesAutoresizingMaskIntoConstraints = false
        let note = NSView()
        note.addSubview(label)
        NSLayoutConstraint.activate([label.centerXAnchor.constraint(equalTo: note.centerXAnchor),
                                     label.centerYAnchor.constraint(equalTo: note.centerYAnchor)])
        piSlot.put(note)
        onCanonicalClosed()
    }

    /// Selecting a detached thread attaches it again in its old place.
    func reattach() {
        guard isDetached else { return }
        attachCanonical()
        show(tab: 0)
    }

    func teardown() {
        view.removeFromSuperview()
        tabs.removeAll()
        boxes.removeAll()
    }
}
