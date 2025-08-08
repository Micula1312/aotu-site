// AOTU Index — typewriter with base-aware links (robust)
(function () {
  const host = document.getElementById('terminal');
  // Read base from data attribute (set in index.astro) and normalize it:
  const rawBase = (host && host.dataset.base) || '/';
  const BASE = rawBase.endsWith('/') ? rawBase : rawBase + '/';

  const pre = `
:: protocol://disorder.memory.network/init
:: version 3.0

> STATUS: ACTIVE [OK]
> AUTHOR: Micol Gelsi
> CURRENT_LOCATION: Rome (IT)

> ACCESSING SYSTEM...

> ABOUT:
  Archive of the Untamed is an artistic research project exploring
  urban wildness, collective memory, and performative archiving
  as tools of resistance and reappropriation.

> PLATFORM NODES:
`;

  const nodesHTML = [
    `- <a class="node" href="${BASE}abstract">Abstract</a>`,
    `- <a class="node" href="${BASE}manifesto">Manifesto</a>`,
    `- <a class="node" href="${BASE}archive">Online Platform</a>`,
    `- Hardware Treehouse`,
    `- Performative Logs`,
    `- Narrative Modes`,
    `- Editorial Dump`,
    '' // final newline
  ].join('<br>\n');

  const post = `
> REPOSITORY: /archive-of-the-untamed/

> END_OF_INDEX █`;

  // Build DOM targets
  const preSpan = document.createElement('span');
  const nodesDiv = document.createElement('div');
  const postSpan = document.createElement('span');

  const container = host || document.body;
  container.append(preSpan, document.createTextNode('\n'), nodesDiv, document.createTextNode('\n'), postSpan);

  function typeTo(el, text, speed = 10) {
    return new Promise((resolve) => {
      let i = 0;
      (function tick() {
        if (i < text.length) {
          el.textContent += text.charAt(i++);
          setTimeout(tick, speed);
        } else {
          resolve();
        }
      })();
    });
  }

  (async function run() {
    await typeTo(preSpan, pre);
    nodesDiv.innerHTML = nodesHTML; // links include normalized BASE
    await typeTo(postSpan, post);
  })();
})();
