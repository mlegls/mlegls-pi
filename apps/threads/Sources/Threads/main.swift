import AppKit

// From the Dock, launchd hands the app a bare environment. Threads need the login shell's
// (PATH, mise, EDITOR, …), so ask it once, as VS Code and Zed resolve theirs.
func resolveShellEnvironment() {
    let env = ProcessInfo.processInfo.environment
    guard env["THREADS_RESOLVE_ENV"] != nil, let bin = env["AB_BIN"], let pw = getpwuid(getuid()) else { return }
    let shell = String(cString: pw.pointee.pw_shell)
    let p = Process()
    p.executableURL = URL(fileURLWithPath: shell)
    p.arguments = ["-ilc", "'" + bin + "' tree env"]
    p.currentDirectoryURL = URL(fileURLWithPath: NSHomeDirectory())
    p.standardInput = FileHandle.nullDevice
    let out = Pipe()
    p.standardOutput = out
    p.standardError = FileHandle.nullDevice
    guard (try? p.run()) != nil else { return }
    DispatchQueue.global().asyncAfter(deadline: .now() + 10) { if p.isRunning { p.terminate() } }
    let data = out.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    let parts = String(decoding: data, as: UTF8.self).components(separatedBy: "\u{1e}ENV")
    guard parts.count >= 3, let json = try? JSONSerialization.jsonObject(with: Data(parts[1].utf8)) as? [String: String] else { return }
    // The bundle's own LSEnvironment (AB_BIN, THREADS_*) wins over whatever the shell exported.
    for (k, v) in json where k != "AB_BIN" && !k.hasPrefix("THREADS_") { setenv(k, v, 1) }
}
resolveShellEnvironment()

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
        item("Open…", #selector(Controller.quickOpen(_:)), "p", target: c),
        item("Find or New Project…", #selector(Controller.openProject(_:)), "o", target: c),
        item("Command Palette…", #selector(Controller.commandPalette(_:)), "p", [.command, .shift], target: c),
        .separator(),
        item("New Child Worktree", #selector(Controller.newChild(_:)), target: c),
        item("New Sibling Worktree", #selector(Controller.newSibling(_:)), target: c),
        item("Fork Into Child Worktree", #selector(Controller.forkChild(_:)), target: c),
        item("Fork Into Sibling Worktree", #selector(Controller.forkSibling(_:)), target: c),
        .separator(),
        item("Merge", #selector(Controller.mergeThread(_:)), target: c),
        item("Merge & Continue", #selector(Controller.mergeContinue(_:)), target: c),
        item("Abandon", #selector(Controller.abandonThread(_:)), target: c),
        .separator(),
        item("Timeline", #selector(Controller.showTimeline(_:)), target: c),
    ]))
    bar.addItem(submenu("Shell", [
        item("Split Right", #selector(Controller.splitRight(_:)), "d", target: c),
        item("Split Down", #selector(Controller.splitDown(_:)), "d", [.command, .shift], target: c),
        item("New Tab", #selector(Controller.newTab(_:)), "t", target: c),
        item("Close Pane", #selector(Controller.closePane(_:)), "w", target: c),
        .separator(),
        item("Previous Pane", #selector(Controller.previousPane(_:)), "[", target: c),
        item("Next Pane", #selector(Controller.nextPane(_:)), "]", target: c),
        item("Previous Tab", #selector(Controller.previousTab(_:)), "[", [.command, .shift], target: c),
        item("Next Tab", #selector(Controller.nextTab(_:)), "]", [.command, .shift], target: c),
    ] + (1...9).map { item("Tab ($0)", #selector(Controller.gotoTab(_:)), String($0), target: c, tag: $0 - 1) }))
    bar.addItem(submenu("Go", [
        item("Down", #selector(Controller.treeDown(_:)), "j", [.command, .control], target: c),
        item("Up", #selector(Controller.treeUp(_:)), "k", [.command, .control], target: c),
        item("Out", #selector(Controller.treeOut(_:)), "h", [.command, .control], target: c),
        item("In", #selector(Controller.treeIn(_:)), "l", [.command, .control], target: c),
    ]))
    bar.addItem(submenu("View", [
        item("Switch View", #selector(Controller.toggleView(_:)), "t", [.command, .shift], target: c),
        item("Refresh", #selector(Controller.refreshNow(_:)), target: c),
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
