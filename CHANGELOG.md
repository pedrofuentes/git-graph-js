# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-25

### Added

- Terminal graph rendering with Unicode box-drawing characters
- SVG graph rendering (vertical and horizontal)
- Five graph styles: normal/thin, round, bold, double, ascii
- Branching model support (git-flow, simple, none, custom TOML)
- Custom commit format strings with `%` placeholders
- Merge commit detection from commit messages (GitHub, GitLab, Bitbucket patterns)
- Color support with auto/always/never modes
- Line wrapping for commit messages
- `--max-count` to limit displayed commits
- `--merges-only` to show dots only on merge commits
- `--reverse` to reverse commit order
- `--local` to hide remote branches
- SVG file output via `--svg-file`
- Horizontal SVG rendering via `--horizontal`
- Persistent branching model configuration per repository
- Library API: `createGitGraph()` for building graphs from git repositories
- Library API: `createGitGraphFromData()` for building graphs from raw JSON data
- Library API: `printUnicode()` and `printSvg()` renderers
- Full TypeScript type declarations

### Credits

TypeScript port of [git-graph](https://github.com/git-bahn/git-graph) v0.7.0 by Martin Lange (Rust, MIT License).
