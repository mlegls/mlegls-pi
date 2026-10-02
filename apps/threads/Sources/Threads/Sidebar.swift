import AppKit

/// Outline item. Reused across refreshes so NSOutlineView keeps expansion state by identity.
final class Node: NSObject {
    enum Kind { case section(String), project(String), thread, scratchpad, scratch }
    let key: String
    var kind: Kind
    var row: ThreadRow?
    var children: [Node] = []
    weak var parent: Node?
    var orderingKey: String {
        if case .thread = kind, let row { return row.id }
        return key
    }
    init(key: String, kind: Kind, row: ThreadRow? = nil) { self.key = key; self.kind = kind; self.row = row }
}

/// Clicking acts without taking the keyboard from the terminal; scrolling never selects.
final class PassiveOutline: NSOutlineView {
    var menuForRow: ((Int) -> NSMenu?)?
    var trackingClick = false
    var dragged = false
    var activateAfterClick: (() -> Void)?

    // AppKit changes selection while tracking a mouse-down. Wait until it knows whether this is a drag.
    override func mouseDown(with event: NSEvent) {
        trackingClick = true
        dragged = false
        activateAfterClick = nil
        super.mouseDown(with: event)
        trackingClick = false
        let activate = activateAfterClick
        activateAfterClick = nil
        if !dragged { activate?() }
    }
    override var acceptsFirstResponder: Bool { false }
    override func acceptsFirstMouse(for _: NSEvent?) -> Bool { true }
    override func menu(for event: NSEvent) -> NSMenu? {
        let row = row(at: convert(event.locationInWindow, from: nil))
        return row >= 0 ? menuForRow?(row) : nil
    }
}

/// A hover action: a default click plus a menu of variants (`NSComboButton`).
final class Combo: NSComboButton {
    var run: () -> Void = {}
    convenience init(symbol: String, tip: String, menu: NSMenu, run: @escaping () -> Void) {
        self.init(frame: .zero)
        self.run = run
        image = NSImage(systemSymbolName: symbol, accessibilityDescription: tip)
        title = ""
        toolTip = tip
        self.menu = menu
        controlSize = .small
        target = self
        action = #selector(fire)
    }
    override func acceptsFirstMouse(for _: NSEvent?) -> Bool { true }
    @objc private func fire() { run() }
}

final class Plain: NSButton {
    var run: () -> Void = {}
    convenience init(symbol: String, tip: String, run: @escaping () -> Void) {
        self.init(frame: .zero)
        self.run = run
        bezelStyle = .accessoryBarAction
        isBordered = false
        image = NSImage(systemSymbolName: symbol, accessibilityDescription: tip)
        toolTip = tip
        target = self
        action = #selector(fire)
    }
    override func acceptsFirstMouse(for _: NSEvent?) -> Bool { true }
    @objc private func fire() { run() }
}

/// A row: glyph, title, detail, and buttons that appear only under the pointer.
final class RowCell: NSTableCellView {
    let glyph = NSTextField(labelWithString: "")
    let title = NSTextField(labelWithString: "")
    let detail = NSTextField(labelWithString: "")
    let delta = NSTextField(labelWithString: "")
    let buttons = NSStackView()
    var onHover: (Bool) -> Void = { _ in }

    init(glyph g: (String, NSColor)?, title t: String, detail d: String, bold: Bool, dim: Bool, header: Bool, delta dl: NSAttributedString? = nil, deltaTip: String? = nil, buttons bs: [NSView]) {
        super.init(frame: .zero)
        glyph.stringValue = g?.0 ?? ""
        glyph.textColor = g?.1
        glyph.alignment = .center
        title.stringValue = t
        title.font = header ? .systemFont(ofSize: NSFont.smallSystemFontSize, weight: .semibold)
            : bold ? .boldSystemFont(ofSize: NSFont.systemFontSize) : .systemFont(ofSize: NSFont.systemFontSize)
        title.textColor = header || dim ? .secondaryLabelColor : .labelColor
        title.lineBreakMode = .byTruncatingTail
        title.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        detail.stringValue = d
        detail.textColor = .tertiaryLabelColor
        detail.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        detail.lineBreakMode = .byTruncatingTail
        detail.setContentCompressionResistancePriority(.defaultLow - 1, for: .horizontal)
        bs.forEach(buttons.addArrangedSubview)
        buttons.spacing = 2
        buttons.isHidden = true
        if let dl { delta.attributedStringValue = dl; delta.toolTip = deltaTip }
        delta.setContentCompressionResistancePriority(.defaultHigh, for: .horizontal)
        let views: [NSView] = (g == nil ? [] : [glyph]) + [title, detail, NSView()] + (dl == nil ? [] : [delta]) + [buttons]
        let stack = NSStackView(views: views)
        stack.spacing = 5
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
        ] + (g == nil ? [] : [glyph.widthAnchor.constraint(equalToConstant: 12)]))
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
