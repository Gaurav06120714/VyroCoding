import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setupWSConnection } = require('y-websocket/bin/utils');

dotenv.config();

const PORT = parseInt(process.env.COLLAB_PORT ?? '1234', 10);

const httpServer = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'vyro-collab', port: PORT }));
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (conn: WebSocket, req: http.IncomingMessage) => {
  // URL pattern: /?roomId=<roomId>
  // y-websocket uses the path or query param as the doc name
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const roomId = url.searchParams.get('roomId') ?? url.pathname.replace('/', '');

  if (!roomId) {
    conn.close(1008, 'Missing roomId');
    return;
  }

  console.log(`[collab] client connected to room: ${roomId}`);

  // setupWSConnection handles all Yjs protocol, awareness, and document sync
  setupWSConnection(conn, req, {
    docName: `room:${roomId}`,
    gc: true,
  });

  conn.on('close', () => {
    console.log(`[collab] client disconnected from room: ${roomId}`);
  });

  conn.on('error', (err) => {
    console.error(`[collab] ws error in room ${roomId}:`, err.message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Yjs collab server running on ws://0.0.0.0:${PORT}`);
  console.log(`Connect with: new WebsocketProvider('ws://localhost:${PORT}', 'room:<roomId>', doc)`);
});

process.on('SIGTERM', () => {
  httpServer.close(() => {
    console.log('Collab server shut down');
    process.exit(0);
  });
});
