import AppKit

/// ⌘P / ⇧⌘P: a filter field over items; Enter runs the selected one, Esc closes.
/// Items are rebuilt from the query, so "create on no match" is just another item.
@MainActor
final class Palette: NSObject, NSTableViewDataSource, NSTableViewDelegate, NSSearchFieldDelegate, NSWindowDelegate {
    struct Item { let title: String; let detail: String; let run: () -> Void }

    let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 560, height: 360), styleMask: [.titled, .fullSizeContentView],
                        backing: .buffered, defer: false)
    let field = NSSearchField()
    let table = NSTableView()
    var items: [Item] = []
    var source: (String) -> [Item] = { _ in [] }
    var onClose: () -> Void = {}

    override init() {
        super.init()
        panel.titlebarAppearsTransparent = true
        panel.titleVisibility = .hidden
        panel.isMovableByWindowBackground = true
        panel.delegate = self
        field.delegate = self
        field.font = .systemFont(ofSize: 15)
        field.focusRingType = .none
        let column = NSTableColumn(identifier: .init("item"))
        table.addTableColumn(column)
        table.headerView = nil
        table.rowHeight = 22
        table.style = .plain
        table.dataSource = self
        table.delegate = self
        table.target = self
        table.doubleAction = #selector(choose)
        let scroll = NSScrollView()
        scroll.documentView = table
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        let stack = NSStackView(views: [field, scroll])
        stack.orientation = .vertical
        stack.edgeInsets = NSEdgeInsets(top: 28, left: 10, bottom: 10, right: 10)
        panel.contentView = stack
    }

    func open(over window: NSWindow, placeholder: String, source: @escaping (String) -> [Item]) {
        self.source = source
        field.placeholderString = placeholder
        field.stringValue = ""
        reload()
        let f = window.frame
        panel.setFrameOrigin(NSPoint(x: f.midX - panel.frame.width / 2, y: f.maxY - panel.frame.height - 80))
        window.addChildWindow(panel, ordered: .above)
        panel.makeKeyAndOrderFront(nil)
        panel.makeFirstResponder(field)
    }

    func reload() {
        items = source(field.stringValue)
        table.reloadData()
        if !items.isEmpty { table.selectRowIndexes([0], byExtendingSelection: false) }
    }

    func close() {
        guard panel.isVisible else { return }
        panel.parent?.removeChildWindow(panel)
        panel.orderOut(nil)
        onClose()
    }

    @objc func choose() {
        let i = table.selectedRow
        guard i >= 0, i < items.count else { return }
        let item = items[i]
        close()
        item.run()
    }

    func windowDidResignKey(_: Notification) { close() }
    func controlTextDidChange(_: Notification) { reload() }
    func control(_: NSControl, textView _: NSTextView, doCommandBy selector: Selector) -> Bool {
        switch selector {
        case #selector(NSResponder.cancelOperation(_:)): close()
        case #selector(NSResponder.insertNewline(_:)): choose()
        case #selector(NSResponder.moveDown(_:)), #selector(NSResponder.moveUp(_:)):
            let delta = selector == #selector(NSResponder.moveDown(_:)) ? 1 : -1
            let i = max(0, min(items.count - 1, table.selectedRow + delta))
            table.selectRowIndexes([i], byExtendingSelection: false)
            table.scrollRowToVisible(i)
        default: return false
        }
        return true
    }

    func numberOfRows(in _: NSTableView) -> Int { items.count }
    func tableView(_: NSTableView, viewFor _: NSTableColumn?, row: Int) -> NSView? {
        let item = items[row]
        let title = NSTextField(labelWithString: item.title)
        title.lineBreakMode = .byTruncatingTail
        title.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        let detail = NSTextField(labelWithString: item.detail)
        detail.textColor = .secondaryLabelColor
        detail.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        detail.lineBreakMode = .byTruncatingMiddle
        detail.setContentCompressionResistancePriority(.defaultLow - 1, for: .horizontal)
        let stack = NSStackView(views: [title, NSView(), detail])
        return stack
    }
}
