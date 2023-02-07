# Obsidian textlint

An [Obsidian](https://obsidian.md) plugin for textlint.

**Note:**  You must build the plugin to use it. (This is to configure textlint for your own use.)

https://user-images.githubusercontent.com/19975408/217126158-01cea041-3e1a-4b59-9450-dac77336c3a1.png
https://user-images.githubusercontent.com/19975408/217126016-9e18c183-a0ab-45a8-ada5-54055c03e773.mp4

## Features
- Using textlint with customized rules for your own use
- Display Lint Gutter (using codemirror's built-in functionality)
  - Conigurable to show or not
  - Conigurable minimum severity to show lint gutter
- Display Underline (using codemirror's built-in functionality)
  - Tooltip display on Hover
- Listing of Diagnostics for the active file
  - Conigurable minimum severity to show
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

## Settings
https://user-images.githubusercontent.com/19975408/217126174-88cbea90-f8dc-46ba-8f1e-77473b1ebf87.png
https://user-images.githubusercontent.com/19975408/217126171-70ed5183-9db1-46c5-9230-24053cd61fa7.png

### Configure override textlintrc
You can use the following code block in your `.md` file as an override setting.

`````
```json:textlintrc.json
{
  "rules": {}
}
```
`````

https://user-images.githubusercontent.com/19975408/217126182-6bb9a6f1-fe63-43c1-84df-553fa815d942.png


## Recommended
Remove textlint worker and textlintrc settings from git control to incorporate repository changes

`git update-index --skip-worktree` or `git update-index --assume-unchanged

```
git update-index --skip-worktree build_config/package.json
git update-index --skip-worktree build_config/package-lock.json
git update-index --skip-worktree build_config/textlintrc.json
git update-index --skip-worktree build_config/worker/textlint-worker.worker.js
```
