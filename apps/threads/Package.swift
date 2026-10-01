// swift-tools-version: 6.0
import PackageDescription

// vendor/DisplayLink overrides libghostty-spm's DisplayLink (same package identity): upstream
// 3.x declares swift-tools 6.2, which Xcode 16 lacks, though nothing in it needs 6.2.
let package = Package(
    name: "Threads",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/Lakr233/libghostty-spm.git", revision: "a5785e01166131f0012280f1fa05a74a7402f29b"),
        .package(path: "vendor/DisplayLink"),
    ],
    targets: [
        .executableTarget(
            name: "Threads",
            dependencies: [.product(name: "GhosttyTerminal", package: "libghostty-spm")],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
