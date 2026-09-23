# /incident-atlas audit

Generated 2026-09-23T10:40:55.434Z against http://localhost:4322

## Root variables (as computed in the built page, not typed by hand)

| Variable | Computed value |
| --- | --- |
| `--bg` | `#0d1b2a` |
| `--panel` | `#1b4965` |
| `--panel2` | `#162435` |
| `--line` | `#243d55` |
| `--text` | `#f8f9fa` |
| `--muted` | `#9bb5c8` |
| `--cyan` | `#5bc0eb` |
| `--green` | `#10b981` |
| `--amber` | `#f59e0b` |
| `--pink` | `#f472b6` |
| `--blue` | `#a78bfa` |
| `--accent-ink` | `#04202c` |
| `--green-text` | `#34d399` |
| `--amber-text` | `#fbbf24` |
| `--pink-text` | `#f9a8d4` |
| `--shadow` | `none` |

## Badge contrast (text vs. effective background, walked up the DOM to the nearest opaque ancestor)

| Badge | Text colour | Background | Border colour | Contrast | vs. 4.5:1 |
| --- | --- | --- | --- | --- | --- |
| `.badge.a` | `#34d399` | `#1b4965` | `#243d55` | 4.99:1 | PASS |
| `.badge.b` | `#5bc0eb` | `#1b4965` | `#243d55` | 4.66:1 | PASS |
| `.badge.c` | `#fbbf24` | `#1b4965` | `#243d55` | 5.75:1 | PASS |
| `.badge.d` | `#f9a8d4` | `#1b4965` | `#243d55` | 5.29:1 | PASS |

## 375px double-scroll check (measured, not estimated)

- `.embed-frame` wrapper rendered height: **21553px**
- iframe content `document.documentElement.scrollHeight`: **21552px**
- iframe's own viewport `document.documentElement.clientHeight`: **21552px**
- Wrapper height >= content scrollHeight -> wrapper is tall enough to show all content, no internal clipping needed
- Inside the iframe, scrollHeight <= clientHeight -> no internal scroll needed inside the iframe document
- **Verdict: CONFIRMED — no double scrollbar at 375px**

## Screenshots

- `test-results/incident-atlas-1440.png`
- `test-results/incident-atlas-375.png`
