import AppKit

/// One active thread from `ab thread ls --json`.
struct ThreadRow: Equatable {
    let id, sessionId, cwd, project, created: String
    let branch, handle, report, blocked, spawnParent, mergeParent, idleSince: String?
    let guest, interactive: Bool
    let state, attention: String

    init?(_ json: [String: Any]) {
        guard let t = json["thread"] as? [String: Any], let id = t["id"] as? String else { return nil }
        self.id = id
        sessionId = t["sessionId"] as? String ?? id
        cwd = t["cwd"] as? String ?? NSHomeDirectory()
        project = t["project"] as? String ?? cwd
        created = t["created"] as? String ?? ""
        branch = t["branch"] as? String
        handle = (t["worker"] as? [String: Any])?["handle"] as? String
        blocked = (t["blocked"] as? [String: Any])?["reason"] as? String
        guest = t["ownership"] as? String == "guest"
        spawnParent = t["parent"] as? String
        report = (json["report"] as? [String: Any])?["tag"] as? String
        mergeParent = json["mergeParentThread"] as? String
        idleSince = json["idleSince"] as? String
        interactive = json["interactive"] as? Bool ?? true
        state = json["state"] as? String ?? "?"
        attention = json["attention"] as? String ?? "read"
    }

    var label: String {
        (handle ?? branch ?? (cwd as NSString).lastPathComponent) + (guest ? " ·" + id.prefix(6) : "")
    }

    var projectName: String { (project as NSString).lastPathComponent }

    var status: (String, NSColor) {
        if blocked != nil || report == "blocked" { return ("⊘", .systemRed) }
        if attention == "needs-you" { return ("!", .systemOrange) }
        if state == "working" { return ("◐", .systemGreen) }
        if attention == "unread" { return ("●", .controlAccentColor) }
        return state == "idle" ? ("○", .secondaryLabelColor) : ("·", .tertiaryLabelColor)
    }

    func matches(_ query: String) -> Bool {
        let hay = [label, id, cwd, projectName, report ?? "", blocked ?? ""].joined(separator: " ").lowercased()
        return query.lowercased().split(separator: " ").allSatisfy { hay.contains($0) }
    }
}

/// The registry and every lifecycle operation belong to `ab`; this app only calls it.
enum AB {
    static let bin = ProcessInfo.processInfo.environment["AB_BIN"] ?? "ab"

    struct Failure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    static func run(_ args: [String], cwd: String? = nil, tool: String? = nil) async throws -> String {
        try await withCheckedThrowingContinuation { done in
            DispatchQueue.global().async {
                let p = Process()
                let exe = tool ?? bin
                if exe.contains("/") { p.executableURL = URL(fileURLWithPath: exe); p.arguments = args }
                else { p.executableURL = URL(fileURLWithPath: "/usr/bin/env"); p.arguments = [exe] + args }
                p.currentDirectoryURL = URL(fileURLWithPath: cwd ?? NSHomeDirectory())
                let out = Pipe(), err = Pipe()
                p.standardOutput = out; p.standardError = err; p.standardInput = FileHandle.nullDevice
                do { try p.run() } catch { done.resume(throwing: error); return }
                var errData = Data()
                let group = DispatchGroup()
                group.enter()
                DispatchQueue.global().async { errData = err.fileHandleForReading.readDataToEndOfFile(); group.leave() }
                let data = out.fileHandleForReading.readDataToEndOfFile()
                group.wait(); p.waitUntilExit()
                if p.terminationStatus == 0 { done.resume(returning: String(decoding: data, as: UTF8.self)); return }
                let message = String(decoding: errData, as: UTF8.self).split(separator: "\n")
                    .map { $0.trimmingCharacters(in: .whitespaces) }.first { !$0.isEmpty } ?? exe + " " + args.joined(separator: " ") + " failed"
                done.resume(throwing: Failure(message: message))
            }
        }
    }

    static func list() async throws -> [ThreadRow] {
        let text = try await run(["thread", "ls", "--json"])
        let json = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [[String: Any]] ?? []
        return json.compactMap(ThreadRow.init)
    }

    /// `ab tree do` result: a created thread, or the threads a merge/abandon closed.
    static func perform(_ action: String, id: String?, sibling: Bool = false, name: String? = nil, project: String? = nil) async throws -> (thread: String?, closed: [String]) {
        var args = ["tree", "do", action]
        if let id { args += ["--id", id] }
        if sibling { args.append("--sibling") }
        if let name { args += ["--name", name] }
        if let project { args += ["--project", project] }
        let text = try await run(args)
        let json = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any] ?? [:]
        return (json["thread"] as? String, json["closed"] as? [String] ?? [])
    }

    static func projects() async -> [String] {
        let text = (try? await run(["query", "-l"], tool: "zoxide")) ?? ""
        return text.split(separator: "\n").prefix(300).map(String.init)
    }

    /// The shell command a surface runs: attach, detaching any other viewer so this one owns the pty size.
    static func attachCommand(_ id: String) -> String {
        "/bin/sh -c 'exec \"" + bin + "\" thread attach " + id + " --exclusive'"
    }
}

/// UI state that outlives the app: view, folds per view, the shown thread.
struct Saved: Codable {
    var view = "project"
    var collapsed: [String: [String]] = [:]
    var shown: String?

    static let url = URL(fileURLWithPath: (ProcessInfo.processInfo.environment["XDG_STATE_HOME"] ?? NSHomeDirectory() + "/.local/state") + "/ab-tree/app.json")
    static func load() -> Saved { (try? JSONDecoder().decode(Saved.self, from: Data(contentsOf: url))) ?? Saved() }
    func save() {
        try? FileManager.default.createDirectory(at: Saved.url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? JSONEncoder().encode(self).write(to: Saved.url)
    }
}
