// AOTU Index — typewriter with isolated links
const terminal = document.getElementById('terminal');
const pre = `\n:: protocol://disorder.memory.network/init\n:: version 3.0\n\n> STATUS: ACTIVE [OK]\n> AUTHOR: Micol Gelsi\n> CURRENT_LOCATION: Rome (IT)\n\n> ACCESSING SYSTEM...\n\n> ABOUT:\n  Archive of the Untamed is an artistic research project exploring\n  urban wildness, collective memory, and performative archiving\n  as tools of resistance and reappropriation.\n\n> PLATFORM NODES:\n`;
const nodesHTML = `- <a class="node" href="/abstract">Abstract</a><br>\n- <a class="node" href="/manifesto">Manifesto</a><br>\n- <a class="node" href="/archive">Online Platform</a><br>\n- Hardware Treehouse<br>\n- Performative Logs<br>\n- Narrative Modes<br>\n- Editorial Dump<br>\n`;
const post = `\n> REPOSITORY: /archive-of-the-untamed/\n\n> END_OF_INDEX █`;
const preSpan = document.createElement('span');
const nodesDiv = document.createElement('div');
const postSpan = document.createElement('span');
terminal.append(preSpan, document.createTextNode('\n'), nodesDiv, document.createTextNode('\n'), postSpan);
function typeTo(el, text){ return new Promise(resolve=>{ let i=0; (function tick(){ if(i<text.length){ el.textContent+=text.charAt(i++); setTimeout(tick,10);} else resolve(); })(); }); }
(async function(){ await typeTo(preSpan, pre); nodesDiv.innerHTML = nodesHTML; await typeTo(postSpan, post); })();