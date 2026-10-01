import AppKit

// A thread app is a frontend of ab's registry; it must not look like it lives inside a pane or session.
for name in ["ZMX_SESSION", "ZMX_SESSION_PREFIX", "TMUX", "TMUX_PANE"] { unsetenv(name) }

@MainActor
func mainMenu(_ c: Controller) -> NSMenu {
    func item(_ title: String, _ action: Selector?, _ key: String = "", _ mods: NSEvent.ModifierFlags = .command, target: AnyObject? = nil, tag: Int = 0) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.keyEquivalentModifierMask = mods
        item.target = target
        item.tag = tag
        return item
    }
    func submenu(_ title: String, _ items: [NSMenuItem]) -> NSMenuItem {
        let top = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        let menu = NSMenu(title: title)
        menu.autoenablesItems = true
        items.forEach(menu.addItem)
        top.submenu = menu
        return top
    }
    let backspace = String(Character(UnicodeScalar(NSBackspaceCharacter)!))
    let bar = NSMenu()
    bar.addItem(submenu("Threads", [
        item("Hide Threads", #selector(NSApplication.hide(_:)), "h"),
        .separator(),
        item("Quit Threads", #selector(NSApplication.terminate(_:)), "q"),
    ]))
    bar.addItem(submenu("Edit", [
        item("Copy", #selector(NSText.copy(_:)), "c"),
        item("Paste", #selector(NSText.paste(_:)), "v"),
        item("Select All", #selector(NSText.selectAll(_:)), "a"),
    ]))
    bar.addItem(submenu("Thread", [
        item("New Thread Here", #selector(Controller.newThread(_:)), "n", target: c),
        item("New Thread in Worktree…", #selector(Controller.newWorktree(_:)), "n", [.command, .shift], target: c),
        item("Fork", #selector(Controller.forkThread(_:)), "d", target: c),
        item("New Thread in Project…", #selector(Controller.openProject(_:)), "o", target: c),
        .separator(),
        item("Merge", #selector(Controller.mergeThread(_:)), "m", [.command, .shift], target: c),
        item("Archive", #selector(Controller.archiveThread(_:)), "a", [.command, .shift], target: c),
        item("Abandon", #selector(Controller.abandonThread(_:)), backspace, [.command, .shift], target: c),
        item("Abandon All Children", #selector(Controller.abandonChildren(_:)), target: c),
        .separator(),
        item("Timeline", #selector(Controller.showTimeline(_:)), "t", [.command, .option], target: c),
    ]))
    bar.addItem(submenu("Go", [
        item("Previous Thread", #selector(Controller.previousThread(_:)), "[", target: c),
        item("Next Thread", #selector(Controller.nextThread(_:)), "]", target: c),
        .separator(),
    ] + (1...9).map { item("Thread \($0)", #selector(Controller.gotoThread(_:)), String($0), target: c, tag: $0 - 1) }))
    bar.addItem(submenu("View", [
        item("Switch Tree", #selector(Controller.toggleTree(_:)), "t", [.command, .shift], target: c),
        item("Filter", #selector(Controller.focusFilter(_:)), "f", [.command, .shift], target: c),
        item("Refresh", #selector(Controller.refreshNow(_:)), "r", target: c),
        item("Toggle Sidebar", #selector(NSSplitViewController.toggleSidebar(_:)), "s", [.command, .control]),
    ]))
    bar.addItem(submenu("Window", [
        item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"),
    ]))
    return bar
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let controller = MainActor.assumeIsolated { Controller() }
MainActor.assumeIsolated {
    app.delegate = controller
    app.mainMenu = mainMenu(controller)
}
app.activate(ignoringOtherApps: true)
app.run()
