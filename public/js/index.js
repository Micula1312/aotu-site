// AOTU Index — typewriter with base-aware links
(function () {
  const terminalEl = document.getElementById('terminal');
  const BASE = (terminalEl && terminalEl.dataset.base) || '/';

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

  const nodesHTML = `- <a class="node" href="${BASE}abstract">Abstract</a><br>
- <a class="node" href="${BASE}manifesto">Manifesto</a><br>
- <a class="node" href="${BASE}archive">Online Platform</a><br>
- Hardware Treehouse<br>
- Performative Logs<br>
- Narrative Modes<br>
- Editorial Dump<br>
`;

  const post = `
> REPOSITORY: /archive-of-the-untamed/

> END_OF_INDEX █`;

  // build DOM targets
  const preSpan = document.createElement('span');
  const nodesDiv = document.createElement('div');
  const postSpan = document.createElement('span');

  const host = terminalEl || document.body;
  host.append(preSpan, document.createTextNode('\n'), nodesDiv, document.createTextNode('\n'), postSpan);

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
    nodesDiv.innerHTML = nodesHTML; // links already include BASE
    await typeTo(postSpan, post);
  })();
})();
