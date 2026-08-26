# OK Komputer — AGENTS.md

Personal blog at <https://zzy2357.github.io/>. Built with Hugo + PaperMod, deployed via GitHub Pages.

## Tech stack

- **Hugo 0.161+** (extended)
- **Theme**: [PaperMod](https://github.com/adityatelange/hugo-PaperMod) — tracked directly in `themes/PaperMod/` (not a submodule)
- **No JS dependencies** — no `package.json`, no npm
- **Language**: `zh-cn` (Chinese), `defaultContentLanguage: zh-cn`

## Commands

```powershell
# Dev server with drafts (live reload):
hugo server -D

# Production build (outputs to docs/):
hugo

# New post (page bundle — required if the post has local images):
hugo new content posts/my-post/index.md
# ...or a plain single file (no local images):
hugo new content posts/my-post.md
```

Every post is a **page bundle**: `content/posts/<slug>/index.md` (leaf bundle). Local images live in the same folder as `index.md` and are referenced by bare filename (see Content conventions). The `archetypes/default.md` adds front matter automatically.

## Important paths

| Path | Purpose |
|---|---|
| `hugo.yaml` | Site config (params, menus, social links, highlight settings) |
| `content/posts/` | Blog posts (9 posts: CTF writeups, C++ notes) |
| `content/friends.md` | Friends page (uses `{{< friend-links >}}` shortcode) |
| `data/friends.yaml` | Friend link data (name, url, avatar, bio) |
| `layouts/shortcodes/friend-links.html` | Custom shortcode for friend cards |
| `assets/css/extended/friend-links.css` | Friend card styles (PaperMod CSS variable aware) |
| `static/assets/friends/` | Friend avatar images (`.webp`) |
| `static/js/flow-field.js` | Flow Field canvas animation (loaded on homepage only) |
| `layouts/partials/extend_head.html` | Overrides theme's empty partial — homepage-only CSS for canvas z-index |
| `layouts/partials/extend_footer.html` | Overrides theme's empty partial — homepage-only canvas + JS load |
| `background.html` | Original standalone prototype (now superseded by Hugo integration) |
| `docs/` | **Published output, committed to `main`** — GitHub Pages serves from here |

## Deployment

- GitHub Pages via **main branch + `/docs` directory**
- After `hugo`, the built output in `docs/` is committed and pushed to `main`
- No CI workflow — manual `hugo && git commit && git push`

## Content conventions

- **Front matter**: TOML (`+++`), includes `showToc = true`, `tags = []`
- **Syntax highlighting**: Hugo Chroma via `pygmentsUseClasses: true` (no highlight.js)
- **Comments**: Enabled (`comments: true`), depends on PaperMod's comment system
- **Post types**: CTF writeups (guosai, isa, pctf, etc.), C++ technical notes, dev tooling posts
- **Local images**: each post is a page bundle — images sit next to `index.md` and are referenced by bare filename, e.g. `![preview](preview.png)`. Hugo publishes them inside the post's URL folder, so relative paths resolve correctly on `hugo server` and GitHub Pages. **Never** use Typora's default `xxx.assets/` relative paths (`![x](post.assets/img.png)`) — Typora resolves them against the file's folder, but Hugo leaves the `src` verbatim and the browser resolves it against the **page URL**, so the image 404s (the `.assets` dir gets published as a sibling of the page folder). If Typora creates a `.assets` folder, move the images into the post's bundle folder and rewrite the references.

## Architecture notes

- Only one custom shortcode (`friend-links`) and one custom CSS block exist — everything else is PaperMod defaults
- The theme is vendored (no git submodule), so theme updates require manual replacement of `themes/PaperMod/`
- The site has zero JS build step — Hugo is the only build tool
- All friend assets are local `.webp` files (no external image hotlinking for friends)
- Homepage-only features use PaperMod's `extend_head.html` / `extend_footer.html` extension points (guarded by `{{ if .IsHome }}`). Never inject homepage-specific code into theme templates directly.

## Editor / agent setup

- No `opencode.json` — default tooling applies
- Hugo v0.161+ uses `.hugo_build.lock` in the project root (exclude from edits)
- `background.html` at repo root is a standalone toy (not part of the Hugo site)