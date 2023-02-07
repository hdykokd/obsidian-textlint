# Obsidian textlint

An [Obsidian](https://obsidian.md) plugin for textlint.

**Note:**  You must build the plugin to use it. (This is to configure textlint for your own use.)

## Features
- Using textlint with customized rules for your own use
- Display Lint Gutter (using codemirror's built-in functionality)
- Display Underline (using codemirror's built-in functionality)
  - Tooltip display on Hover
- Listing of Diagnostics for the active file
  - Cursor jumps from the list to individual diagnostics
- Lint on active file change (switchable)
- Lint on file save (toggleable)
- Lint on text change (toggleable) Lint on file save (toggleable)
  - This feature is experimental.
- You can configure settings to overwrite textlintrc per folder.
  - Read `.json` files in vault
  - read code blocks in `.md` files in vault (see below for details)

## Commands
- Show textlint diagnostics
- Run textlint lint

## How to use
1. Prepare textlintrc and textlint worker scripts. (change the extension to `.worker.js`) 
2. Place textlintrc configuration in build_config/textlintrc.json.
3. Place worker script in build_config/worker/textlint-worker.worker.js.
4. Run `npm run build` in the root directory.
5. Create obsidian-textlint directory in .obsidian/plugins/ in the vault where you want to use the plugin.
6. copy main.js, styles.css, manifest.json in the root directory to the created directory
7. Open the vault and activate the plugin.

### Configure override textlintrc
`.md` ファイルに下記のようなコードブロックを書くと上書きする設定として使うことができます。

`````
```json:textlintrc.json
{
  "rules": {}
}
```
`````

## Recommended
Remove textlint worker and textlintrc settings from git control to incorporate repository changes

`git update-index --skip-worktree` or `git update-index --assume-unchanged

```
git update-index --skip-worktree build_config/worker/textlint-worker.worker.js
git update-index --skip-worktree build_config/textlintrc.json
```
