# bweinstein.me

Terminal-style, 100% keyboard-navigable portfolio. Landing screen → press
Enter → a file-tree explorer (like nvim-tree) with a preview pane. Opening
a file moves the cursor into its content, where you scroll with vim
keybinds — h moves the cursor back out to the tree.

## Structure

```
index.html         landing screen + explorer shell
styles.css          all styling
script.js            landing/tree/buffer-cursor/markdown logic
manifest.json        defines the tree — edit this to add/remove entries
content/
  about.md            top-level file
  contact.md          top-level file
  images/             all images referenced from markdown live here
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
   date: Jan 2026
   ---

   The rest is normal markdown.
   ```
3. Add one entry to `manifest.json` pointing at the new file. That's it —
   no build step, no rebuild.

## Adding images

Drop image files into `content/images/`, then reference them from any
markdown file with normal markdown image syntax:

```
![Screenshot of the dashboard](dashboard-screenshot.png)
```

Just the filename is enough — it's automatically resolved to
`content/images/dashboard-screenshot.png`. Writing the full path
(`content/images/dashboard-screenshot.png`) also works. Regular
`http(s)://` image URLs are left as-is.

## Keybindings

Tree pane (default focus):

| key       | action                          |
|-----------|----------------------------------|
| `j` / `↓` | move down                        |
| `k` / `↑` | move up                          |
| `l` / `Enter` / `o` | open (expand folder / open file — moves cursor into file content) |
| `h` / `←` | collapse folder / go to parent   |
| `g`       | jump to top                      |
| `G`       | jump to bottom                   |
| `Esc` / `q` | back to landing screen         |

Inside an open file (cursor in content):

| key       | action                          |
|-----------|----------------------------------|
| `j` / `↓` | move cursor down a line          |
| `k` / `↑` | move cursor up a line            |
| `Ctrl+d`  | move down 5 lines                |
| `Ctrl+u`  | move up 5 lines                  |
| `g`       | jump to top of file              |
| `G`       | jump to bottom of file           |
| `h` / `←` / `q` | back to tree (file stays open) |
| `Esc`     | back to landing screen           |

## Local testing

This uses `fetch()` for `manifest.json` and markdown files, so it must be
served over HTTP — opening `index.html` directly (`file://`) will fail to
load content. Run a quick local server from this folder:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
