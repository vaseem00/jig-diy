# Third-party notices

Jig is under the [MIT License](LICENSE). This file lists the third-party software, fonts, ideas and names that Jig uses or refers to, with their licences.

## Contents

1. three.js 0.160.0 (MIT)
2. Archivo and JetBrains Mono (SIL Open Font License 1.1)
3. Design credits
4. ASD-STE100

## 1. three.js 0.160.0

- Project: [three.js](https://threejs.org/), the core module from `build/` and `examples/jsm/controls/OrbitControls.js` of the npm package `three@0.160.0`.
- Use: the 3D viewer of every guide page.
- How Jig uses it: a guide page loads both files from `https://cdn.jsdelivr.net/npm/three@0.160.0/` when it opens, with a sha384 integrity hash for each file. A page built with `--offline` holds both files inline, with this notice in the page.
- Licence: MIT. The text below comes from the `LICENSE` file of three.js r160.

```
The MIT License

Copyright © 2010-2023 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## 2. Archivo and JetBrains Mono

| Font | Copyright | Licence | Source |
|---|---|---|---|
| Archivo | Copyright 2020 The Archivo Project Authors | SIL Open Font License 1.1 | [Omnibus-Type/Archivo](https://github.com/Omnibus-Type/Archivo) |
| JetBrains Mono | Copyright 2020 The JetBrains Mono Project Authors | SIL Open Font License 1.1 | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) |

- Use: the text of the guide page (Archivo) and the numbers, codes and sizes (JetBrains Mono).
- How Jig uses them: the page links to [Google Fonts](https://fonts.google.com/), and the browser loads the fonts from `fonts.googleapis.com` and `fonts.gstatic.com` when the page opens. Jig does not include the font files. A page built with `--offline` has no font link and uses the system fonts.
- Licence text: [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/).

## 3. Design credits

Jig takes ideas, not files, from these projects. [docs/design-notes.md](docs/design-notes.md) says what came from each.

- **anatomy** by wheresryan22, MIT License: [github.com/wheresryan22/anatomy](https://github.com/wheresryan22/anatomy). The idea that one model gives every number, the "one idea that matters" thesis, size tiers, an audit run to zero, and a critic's review of every capture.
- **visual-explainer** by nicobailon, MIT License: [github.com/nicobailon/visual-explainer](https://github.com/nicobailon/visual-explainer). The answer as a picture on the first screen, one claim for each figure, and a writing register close to Simplified Technical English.

## 4. ASD-STE100

ASD-STE100 Simplified Technical English is a standard of ASD, the AeroSpace, Security and Defence Industries Association of Europe. ASD-STE100 is a trademark of ASD. Jig writes in the style of its writing rules. Jig is STE-style, not certified STE, and it does not reproduce the STE dictionary. Jig has no connection with ASD. To get the standard, see [asd-ste100.org](https://www.asd-ste100.org/).
