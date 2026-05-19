// AOTU realtime server
// Piccolo WebSocket relay per controller touch + schermi.
// Avvio: cd realtime-server && npm install && npm run dev

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const wss = new WebSocketServer({ port: PORT });

const clients = new Map();

function broadcast(payload, except = null) {
  const raw = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client === except) continue;
    if (client.readyState === client.OPEN) client.send(raw);
  }
}

function clientList() {
  return [...clients.values()];
}

wss.on('connection', (ws) => {
  const id = crypto.randomUUID?.() || String(Date.now() + Math.random());
  clients.set(ws, { id, role: 'unknown', screenId: null });

  ws.on('message', (buffer) => {
    let msg;
    try { msg = JSON.parse(buffer.toString()); } catch { return; }

    if (msg.type === 'HELLO') {
      clients.set(ws, {
        id,
        role: msg.role || 'unknown',
        screenId: msg.screenId || null,
      });
      broadcast({ type: 'CLIENTS', clients: clientList() });
      return;
    }

    // Relay: il controller manda, gli schermi ascoltano.
    broadcast({ ...msg, relayAt: Date.now() }, ws);
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcast({ type: 'CLIENTS', clients: clientList() });
  });
});

console.log(`AOTU realtime server listening on ws://localhost:${PORT}`);
