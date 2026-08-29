# Third-party licenses

Kid Climber includes third-party software and a bundled font. Those works remain under their own licenses. This inventory covers the direct runtime and build dependencies used by the `3.0.0-alpha.3` source snapshot; exact transitive versions are recorded in the committed npm, Go and Cargo lock files.

## Frontend runtime

| Package | License |
| --- | --- |
| React, React DOM | MIT |
| Three.js, @react-three/fiber, @react-three/drei | MIT |
| Ant Design, @ant-design/icons | MIT |
| Zustand | MIT |
| pdf-lib, @pdf-lib/fontkit | MIT |
| FileSaver.js | MIT |

## Frontend build and test toolchain

Vite, its React plugin, ESLint and its plugins, TypeScript ESLint, and the installed `@types/*` packages are MIT licensed. TypeScript is Apache-2.0 licensed. Exact versions are in `frontend/package-lock.json`.

## Go backend

The direct dependencies Gin, gin-contrib/cors, GORM and the GORM SQLite driver are MIT licensed. Their transitive module versions are in `backend/go.sum`; notices distributed by those modules remain applicable.

## Tauri desktop application

Tauri, tauri-build, Serde and serde_json are distributed under MIT or Apache-2.0 terms. Exact crate versions and license metadata are recorded in `frontend/src-tauri/Cargo.lock`.

## Bundled font

`frontend/public/fonts/NotoSansSC-Regular.otf` is Noto Sans SC, distributed under the SIL Open Font License 1.1. The full font license is included at `frontend/public/fonts/NotoSansSC-LICENSE.txt`.

This file is an attribution aid, not a substitute for the license texts supplied by each dependency.
