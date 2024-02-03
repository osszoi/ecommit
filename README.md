# ecommit

[![NPM Version](https://img.shields.io/npm/v/ecommit.svg)](https://www.npmjs.com/package/ecommit)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A command-line tool for managing and automating commits, version updates, and pushes. It will bump `package.json` version +1 to minor or patch depending on changed lines in pending code to push.

## Installation

```bash
npm install -g ecommit
```

## Usage
```bash
ecommit -m "Your commit message!"
```

## Parameters
- `-m`: the commit message. It's mandatory if there're pending changes to commit
- `--verbose`: show all commands runned
- `--dry-run`: perform a run without actually pushing nor modifying package version
- `--threshold`: indicate how many lines changes are required to change minor version instead of patch version. Defaults to 400
- `--debug`: show logs