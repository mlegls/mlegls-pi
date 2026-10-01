import AppKit

/// One row of `ab thread ls --json --tree <mode>`, already in tree order.
struct ThreadRow: Equatable {
    let id, sessionId, cwd, project: String
    let branch, handle, report, blocked, parent: String?
    let guest: Bool
    let state: String
    let depth: Int

    init?(_ json: [String: Any]) {
        guard let t = json["thread"] as? [String: Any], let id = t["id"] as? String else { return nil }
        self.id = id
        sessionId = t["sessionId"] as? String ?? id
        cwd = t["cwd"] as? String ?? NSHomeDirectory()
        project = t["project"] as? String ?? cwd
        branch = t["branch"] as? String
        handle = (t["worker"] as? [String: Any])?["handle"] as? String
        blocked = (t["blocked"] as? [String: Any])?["reason"] as? String
        guest = t["ownership"] as? String == "guest"
        report = (json["report"] as? [String: Any])?["tag"] as? String
        parent = json["treeParent"] as? String
        state = json["state"] as? String ?? "?"
        depth = json["depth"] as? Int ?? 0
    }

    var label: String {
        (handle ?? branch ?? (cwd as NSString).lastPathComponent) + (guest ? " ·" + id.prefix(6) : "")
    }

    var status: (String, NSColor) {
        if blocked != nil || report == "blocked" { return ("⊘", .systemRed) }
        if report == "needs-input" { return ("!", .systemOrange) }
        switch state {
        case "working": return ("●", .systemGreen)
        case "idle": return ("○", .secondaryLabelColor)
        default: return ("·", .tertiaryLabelColor)
        }
    }

    func matches(_ query: String) -> Bool {
        query.isEmpty || [label, id, cwd, project, report ?? "", blocked ?? ""].joined(separator: " ").lowercased().contains(query.lowercased())
    }
}

/// The registry and every lifecycle operation belong to `ab`; this app only calls it.
enum AB {
    static let bin = ProcessInfo.processInfo.environment["AB_BIN"] ?? "ab"

    struct Failure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    static func run(_ args: [String], cwd: String? = nil, env extra: [String: String] = [:]) async throws -> String {
        try await withCheckedThrowingContinuation { done in
            DispatchQueue.global().async {
                let p = Process()
                if bin.contains("/") { p.executableURL = URL(fileURLWithPath: bin); p.arguments = args }
                else { p.executableURL = URL(fileURLWithPath: "/usr/bin/env"); p.arguments = [bin] + args }
                var env = ProcessInfo.processInfo.environment
                for (k, v) in extra { env[k] = v }
                p.environment = env
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
                    .map { $0.trimmingCharacters(in: .whitespaces) }.first { !$0.isEmpty } ?? "ab " + args.joined(separator: " ") + " failed"
                done.resume(throwing: Failure(message: message))
            }
        }
    }

    static func list(tree: String) async throws -> [ThreadRow] {
        let text = try await run(["thread", "ls", "--json", "--tree", tree])
        let json = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [[String: Any]] ?? []
        return json.compactMap(ThreadRow.init)
    }

    /// `ab tree do` result: a created thread, or the threads an archive/abandon closed.
    static func perform(_ action: String, id: String?, tree: String, name: String? = nil) async throws -> (thread: String?, closed: [String]) {
        var args = ["tree", "do", action, "--tree", tree]
        if let id { args += ["--id", id] }
        if let name { args += ["--name", name] }
        let text = try await run(args)
        let json = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any] ?? [:]
        return (json["thread"] as? String, json["closed"] as? [String] ?? [])
    }

    /// The shell command a surface runs: attach, detaching any other viewer so this one owns the pty size.
    static func attachCommand(_ id: String) -> String {
        "/bin/sh -c 'exec \"" + bin + "\" thread attach " + id + " --exclusive'"
    }
}

/// UI state that outlives the app: tree mode, folds, the shown thread.
struct Saved: Codable {
    var mode = "spawn"
    var collapsed: [String] = []
    var shown: String?

    static let url = URL(fileURLWithPath: (ProcessInfo.processInfo.environment["XDG_STATE_HOME"] ?? NSHomeDirectory() + "/.local/state") + "/ab-tree/app.json")
    static func load() -> Saved { (try? JSONDecoder().decode(Saved.self, from: Data(contentsOf: url))) ?? Saved() }
    func save() {
        try? FileManager.default.createDirectory(at: Saved.url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? JSONEncoder().encode(self).write(to: Saved.url)
    }
}
