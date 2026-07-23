# Video engines

Reel Studio supports two engines per project (chosen at create time).

| | **HyperFrames** | **Remotion** |
| --- | --- | --- |
| Licence | Apache-2.0 | Remotion License (source-available, not OSI) |
| Templates | HTML + CSS + motion (`hf-*`) | React compositions |
| Preview | Local HyperFrames preview | Remotion Player |
| Export | Isolated producer worker → MP4 | `renderMedia` → MP4 |
| Node | Node 22+ recommended | Node 22+ recommended |
| Best for | Open-source-safe workflows, HTML templates | Rich React ecosystem, existing Remotion skills |

## Recommendation for open-source demos

Use **HyperFrames** when you want a fully Apache-2.0 render path that does not
depend on Remotion’s company licensing. Demo seeds in this repo use HyperFrames.

## Remotion licensing (short)

Reel Studio’s MIT licence **does not** cover Remotion. Individuals and small
teams are often covered by Remotion’s Free License; for-profit organizations
with 4+ employees typically need a Remotion Company License. See
[docs/LICENSING.md](LICENSING.md) and [remotion.dev/license](https://www.remotion.dev/license).

## Template IDs

**HyperFrames:** `hf-opener`, `hf-statement`, `hf-list`, `hf-stat`, `hf-quote`, `hf-cta`

**Remotion:** `kinetic`, `lottie`, `three`, `stat-reveal`, `icon-grid`, `quote-card`, `emoji-punch`

Registration lives in `src/engines/` and `src/compositions/`.
