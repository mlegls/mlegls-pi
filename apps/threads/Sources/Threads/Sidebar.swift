import AppKit

enum Action: String, CaseIterable {
    case new, worktree, fork, merge, archive, abandon, children

    var title: String {
        switch self {
        case .new: "New Thread Here"
        case .worktree: "New Thread in Worktree…"
        case .fork: "Fork"
        case .merge: "Merge"
        case .archive: "Archive"
        case .abandon: "Abandon"
        case .children: "Abandon All Children"
        }
    }

    var symbol: String {
        switch self {
        case .new: "plus"
        case .worktree: "folder.badge.plus"
        case .fork: "arrow.triangle.branch"
        case .merge: "arrow.triangle.merge"
        case .archive: "archivebox"
        case .abandon: "trash"
        case .children: "xmark.bin"
        }
    }

    var retires: Bool { [.merge, .archive, .abandon, .children].contains(self) }
}

/// Outline item. Reused across refreshes so NSOutlineView keeps expansion state by identity.
final class Node: NSObject {
    let id: String
    var row: ThreadRow
    var children: [Node] = []
    init(_ row: ThreadRow) { id = row.id; self.row = row }
}

/// Clicking acts without taking the keyboard from the terminal; scrolling never selects.
final class PassiveOutline: NSOutlineView {
    var menuForRow: ((Int) -> NSMenu?)?
    override var acceptsFirstResponder: Bool { false }
    override func acceptsFirstMouse(for _: NSEvent?) -> Bool { true }
    override func menu(for event: NSEvent) -> NSMenu? {
        let row = row(at: convert(event.locationInWindow, from: nil))
        return row >= 0 ? menuForRow?(row) : nil
    }
}

final class RowButton: NSButton {
    var run: () -> Void = {}
    convenience init(_ action: Action, run: @escaping () -> Void) {
        self.init(frame: .zero)
        self.run = run
        bezelStyle = .accessoryBarAction
        isBordered = false
        if let image = NSImage(systemSymbolName: action.symbol, accessibilityDescription: action.title) { self.image = image }
        else { title = action.rawValue }
        toolTip = action.title
        target = self
        self.action = #selector(fire)
    }
    override func acceptsFirstMouse(for _: NSEvent?) -> Bool { true }
    @objc private func fire() { run() }
}

/// A thread row: status, label, detail, and actions that appear only under the pointer.
final class ThreadCell: NSTableCellView {
    let glyph = NSTextField(labelWithString: "")
    let title = NSTextField(labelWithString: "")
    let detail = NSTextField(labelWithString: "")
    let buttons = NSStackView()
    var onHover: (Bool) -> Void = { _ in }

    init(row: ThreadRow, shown: Bool, actions: [Action], perform: @escaping (Action) -> Void) {
        super.init(frame: .zero)
        let (symbol, color) = row.status
        glyph.stringValue = symbol
        glyph.textColor = color
        glyph.alignment = .center
        title.stringValue = row.label
        title.font = shown ? .boldSystemFont(ofSize: NSFont.systemFontSize) : .systemFont(ofSize: NSFont.systemFontSize)
        title.lineBreakMode = .byTruncatingTail
        title.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        var bits: [String] = []
        if row.depth == 0 { bits.append((row.project as NSString).lastPathComponent) }
        if row.guest { bits.append("guest") }
        if row.blocked != nil { bits.append("blocked") }
        detail.stringValue = bits.joined(separator: " ")
        detail.textColor = row.blocked != nil ? .systemRed : .secondaryLabelColor
        detail.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        detail.lineBreakMode = .byTruncatingTail
        detail.setContentCompressionResistancePriority(.defaultLow - 1, for: .horizontal)
        for a in actions { buttons.addArrangedSubview(RowButton(a) { perform(a) }) }
        buttons.spacing = 2
        buttons.isHidden = true
        let stack = NSStackView(views: [glyph, title, detail, NSView(), buttons])
        stack.spacing = 5
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            glyph.widthAnchor.constraint(equalToConstant: 12),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        textField = title
    }

    required init?(coder _: NSCoder) { fatalError() }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self))
    }

    override func mouseEntered(with _: NSEvent) { buttons.isHidden = false; onHover(true) }
    override func mouseExited(with _: NSEvent) { buttons.isHidden = true; onHover(false) }
}
