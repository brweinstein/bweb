# bweinstein.us

Terminal-style, 100% keyboard-navigable portfolio. Landing screen → press
Enter → a file-tree explorer (like nvim-tree) with a preview pane.

## Structure

```
index.html         landing screen + explorer shell
styles.css          all styling
script.js            landing/tree/keyboard/markdown logic
manifest.json        defines the tree — edit this to add/remove entries
content/
  about.md            top-level file
  contact.md          top-level file
  assets/
    profile.jpg       landing page photo (add your own)
  projects/           one .md file per project
  blog/               one .md file per post
```

## Adding a project or blog post

1. Add a markdown file under `content/projects/` or `content/blog/`.
2. Optionally start it with frontmatter (used for the header on project pages):
   ```
   title: My Project
   repo: https://github.com/you/repo
   tags: Rust, CLI
   ---

   The rest is normal markdown.
   ```
3. Add one entry to `manifest.json` pointing at the new file. That's it —
   no build step, no rebuild.

## Keybindings

| key       | action                          |
|-----------|----------------------------------|
| `j` / `↓` | move down                        |
| `k` / `↑` | move up                          |
| `l` / `Enter` / `o` | open (expand folder / open file) |
| `h` / `←` | collapse folder / go to parent   |
| `g`       | jump to top                      |
| `G`       | jump to bottom                   |
| `Esc` / `q` | back to landing screen         |

## Local testing

This uses `fetch()` for `manifest.json` and markdown files, so it must be
served over HTTP — opening `index.html` directly (`file://`) will fail to
load content. Run a quick local server from this folder:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
