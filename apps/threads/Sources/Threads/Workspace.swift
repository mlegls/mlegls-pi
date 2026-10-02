import AppKit
import GhosttyTerminal

/// Menu key equivalents get the first look, then Ghostty: the app owns ⌘D/⌘T/⌘W/⌘P…, Ghostty the rest.
/// The canonical pane never lets a close chord reach Ghostty (close_surface/close_tab/close_window).
final class ThreadSurface: AppTerminalView {
    var isCanonical = false

    func isClose(_ event: NSEvent) -> Bool {
        isCanonical && event.modifierFlags.contains(.command) && event.charactersIgnoringModifiers?.lowercased() == "w"
    }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if NSApp.mainMenu?.performKeyEquivalent(with: event) == true { return true }
        if isClose(event) { NSSound.beep(); return true }
        return super.performKeyEquivalent(with: event)
    }

    override func keyDown(with event: NSEvent) {
        if isClose(event) { NSSound.beep(); return }
        super.keyDown(with: event)
    }
}

/// The surface delegate is weak in GhosttyTerminal; one retained box per surface carries its callbacks.
@MainActor
final class SurfaceBox: NSObject, TerminalSurfaceCloseDelegate, TerminalSurfaceTitleDelegate, TerminalSurfaceFocusDelegate,
    TerminalSurfaceBellDelegate, TerminalSurfaceDesktopNotificationDelegate {
    var onClose: (Bool) -> Void = { _ in }
    var onTitle: (String) -> Void = { _ in }
    var onFocus: () -> Void = {}
    var onBell: () -> Void = {}
    func terminalDidClose(processAlive: Bool) { onClose(processAlive) }
    func terminalDidChangeTitle(_ title: String) { onTitle(title) }
    func terminalDidChangeFocus(_ focused: Bool) { if focused { onFocus() } }
    func terminalDidRingBell() { onBell() }
    func terminalDidRequestDesktopNotification(title _: String, body _: String) { onBell() }
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

/// Tab 0's frame: the pi pane, a side dock to its right, and a bottom dock across the full width under both.
/// Laid out by hand (NSSplitView kept collapsing the pi pane when a dock joined); the gaps drag to resize.
final class DockLayout: NSView {
    let main: NSView
    var side: NSView? { didSet { swap(oldValue, side) } }
    var bottom: NSView? { didSet { swap(oldValue, bottom) } }
    var sideFraction: CGFloat = 0.38
    var bottomFraction: CGFloat = 0.3
    let gap: CGFloat = 1
    private var dragging: (side: Bool, start: NSPoint, fraction: CGFloat)?

    init(main: NSView) {
        self.main = main
        super.init(frame: .zero)
        addSubview(main)
    }
    required init?(coder _: NSCoder) { fatalError() }

    private func swap(_ old: NSView?, _ new: NSView?) {
        if let old, old !== new { old.removeFromSuperview() }
        if let new, new.superview !== self { addSubview(new) }
        needsLayout = true
        layoutSubtreeIfNeeded()
    }

    override var isFlipped: Bool { true }

    var regions: (main: NSRect, side: NSRect, bottom: NSRect) {
        let b = bounds
        let bottomH = bottom == nil ? 0 : (b.height * bottomFraction).rounded()
        let topH = b.height - bottomH - (bottom == nil ? 0 : gap)
        let sideW = side == nil ? 0 : (b.width * sideFraction).rounded()
        let mainW = b.width - sideW - (side == nil ? 0 : gap)
        return (NSRect(x: 0, y: 0, width: mainW, height: topH),
                NSRect(x: mainW + gap, y: 0, width: sideW, height: topH),
                NSRect(x: 0, y: topH + gap, width: b.width, height: bottomH))
    }

    override func layout() {
        super.layout()
        let r = regions
        main.frame = r.main
        side?.frame = r.side
        bottom?.frame = r.bottom
    }

    override func resizeSubviews(withOldSize _: NSSize) { needsLayout = true; layout() }

    override func draw(_: NSRect) {
        NSColor.separatorColor.setFill()
        let r = regions
        if side != nil { NSRect(x: r.main.maxX, y: 0, width: gap, height: r.main.height).fill() }
        if bottom != nil { NSRect(x: 0, y: r.main.maxY, width: bounds.width, height: gap).fill() }
    }

    private func hit(_ p: NSPoint) -> Bool? {
        let r = regions
        if side != nil, abs(p.x - r.main.maxX - gap / 2) < 4, p.y < r.main.maxY { return true }
        if bottom != nil, abs(p.y - r.main.maxY - gap / 2) < 4 { return false }
        return nil
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
        hit(convert(point, from: superview)) != nil ? self : super.hitTest(point)
    }

    override func resetCursorRects() {
        let r = regions
        if side != nil { addCursorRect(NSRect(x: r.main.maxX - 3, y: 0, width: gap + 6, height: r.main.height), cursor: .resizeLeftRight) }
        if bottom != nil { addCursorRect(NSRect(x: 0, y: r.main.maxY - 3, width: bounds.width, height: gap + 6), cursor: .resizeUpDown) }
    }

    override func mouseDown(with event: NSEvent) {
        let p = convert(event.locationInWindow, from: nil)
        guard let isSide = hit(p) else { return super.mouseDown(with: event) }
        dragging = (isSide, p, isSide ? sideFraction : bottomFraction)
    }

    override func mouseDragged(with event: NSEvent) {
        guard let d = dragging else { return }
        let p = convert(event.locationInWindow, from: nil)
        if d.side { sideFraction = min(0.85, max(0.1, d.fraction - (p.x - d.start.x) / bounds.width)) }
        else { bottomFraction = min(0.85, max(0.1, d.fraction - (p.y - d.start.y) / bounds.height)) }
        needsLayout = true
        needsDisplay = true
        window?.invalidateCursorRects(for: self)
    }

    override func mouseUp(with _: NSEvent) { dragging = nil }
}

/// One worktree's window contents. Tab 0 is IDE-like: the canonical pi session (zmx-backed, attached exclusively),
/// a side dock to its right and a bottom dock under both, toggled by ⌘D / ⇧⌘D from the pi pane.
/// Inside the docks and in other tabs, panes are plain shells that split like Ghostty's and live as long as the app.
/// A scratch workspace has no canonical session: tab 0 is a plain shell too, and closing its last pane closes it.
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
    let side = Holder(), bottom = Holder()
    lazy var docks = DockLayout(main: piSlot)
    var boxes: [ObjectIdentifier: SurfaceBox] = [:]
    let controller: TerminalController
    var lastFocus: ThreadSurface?
    var onCanonicalClosed: () -> Void = {}
    let hasCanonical: Bool
    /// A pane's title or focus changed: a scratch row shows the last focused pane's title.
    var onLabel: () -> Void = {}
    var onBell: () -> Void = {}
    var onEmpty: () -> Void = {}

    init(id: String, cwd: String, controller: TerminalController, canonical: Bool = true) {
        self.id = id
        hasCanonical = canonical
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
        if canonical {
            first.put(docks)
            attachCanonical()
        } else {
            let s = makeSurface(command: nil, canonical: false)
            first.put(s)
            lastFocus = s
        }
        show(tab: 0)
    }

    var stripHeight: NSLayoutConstraint!

    func makeSurface(command: String?, canonical isCanonical: Bool) -> ThreadSurface {
        let s = ThreadSurface(frame: NSRect(x: 0, y: 0, width: 800, height: 600))
        let box = SurfaceBox()
        box.onClose = { [weak self, weak s] alive in
            guard let self, let s else { return }
            // Ghostty closing the pane while the attach still runs is never wanted: put it straight back.
            if s === self.canonical { if alive { self.attachCanonical(); self.focus(self.canonical) } else { self.detached() } }
            else { self.remove(s) }
        }
        box.onFocus = { [weak self, weak s] in self?.lastFocus = s; self?.onLabel() }
        box.onBell = { [weak self] in self?.onBell() }
        box.onTitle = { [weak self, weak s] title in
            guard let self, let s else { return }
            self.titles[ObjectIdentifier(s)] = title
            self.updateStrip()
            if s === self.lastFocus { self.onLabel() }
        }
        boxes[ObjectIdentifier(s)] = box
        s.delegate = box
        s.isCanonical = isCanonical
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
            let title = i == 0 && hasCanonical ? "pi" : first.flatMap { titles[ObjectIdentifier($0)] } ?? "shell"
            strip.setLabel(String(title.prefix(24)), forSegment: i)
            strip.setWidth(160, forSegment: i)
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

    /// The surface holding the keyboard (the responder may be a view inside it), else the last one focused.
    var focused: ThreadSurface? {
        var v = view.window?.firstResponder as? NSView
        while let x = v, !(x is ThreadSurface) { v = x.superview }
        let order = leaves(tabs[current])
        if let s = v as? ThreadSurface, order.contains(where: { $0 === s }) { return s }
        return order.first { $0 === lastFocus } ?? order.first
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

    // MARK: docks (tab 0)

    func isShown(_ dock: Holder) -> Bool { dock.superview != nil }

    func setDock(_ dock: Holder, shown: Bool) {
        if dock === side { docks.side = shown ? side : nil } else { docks.bottom = shown ? bottom : nil }
        docks.needsDisplay = true
        docks.window?.invalidateCursorRects(for: docks)
    }

    /// ⌘D / ⇧⌘D from the pi pane: show or hide a dock. Hidden docks keep their shells running.
    func toggle(_ dock: Holder) {
        if isShown(dock) {
            setDock(dock, shown: false)
            focus(canonical)
            return
        }
        if current != 0 { show(tab: 0) }
        setDock(dock, shown: true)
        // A surface must get its real size before it joins the window, or Ghostty sizes it from nothing.
        if dock.subviews.isEmpty { dock.put(makeSurface(command: nil, canonical: false)) }
        focus(leaves(dock).first { $0 === lastFocus } ?? leaves(dock).first)
    }

    /// Ghostty's new_split: right puts the new pane beside, down below the focused one.
    /// From the pi pane the same keys toggle the docks instead.
    func split(right: Bool) {
        guard let leaf = focused else { return }
        if leaf === canonical { toggle(right ? side : bottom); return }
        let target: NSView = leaf
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
        } else if let dock = parent as? Holder, dock === side || dock === bottom {
            // The dock's last shell closed: hide it; the next toggle starts a fresh one.
            setDock(dock, shown: false)
            focus(canonical)
            return
        } else if let tab = parent as? Holder, let index = tabs.firstIndex(of: tab), tab.subviews.isEmpty {
            tabs.remove(at: index)
            if tabs.isEmpty { onEmpty(); return }
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

    var isDetached: Bool { hasCanonical && canonical == nil }

    /// The last focused pane's title (the shell's, or what runs in it), else the directory.
    var label: String {
        lastFocus.flatMap { titles[ObjectIdentifier($0)] } ?? (cwd as NSString).lastPathComponent
    }

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
