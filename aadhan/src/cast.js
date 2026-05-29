const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const Bonjour = require('bonjour-service');
const os = require('os');

let discoveredDevices = {};
let activeClient = null;
let activePlayer = null;
let localPlaybackProcess = null;

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function startDiscovery() {
  try {
    const bonjour = new Bonjour.Bonjour();
    const browser = bonjour.find({ type: 'googlecast' });
    browser.on('up', (service) => {
      const name = service.txt?.fn || service.name;
      const host = service.addresses?.[0] || service.host;
      const port = service.port;
      if (host) discoveredDevices[name] = { name, host, port };
    });
    browser.on('down', (service) => {
      const name = service.txt?.fn || service.name;
      delete discoveredDevices[name];
    });
    console.log('[cast] mDNS discovery started');
  } catch (e) {
    console.warn('[cast] mDNS discovery unavailable:', e.message);
  }
}

function getDevices() {
  return Object.values(discoveredDevices);
}

function stopCurrent() {
  if (activePlayer) {
    try { activePlayer.stop(() => {}); } catch {}
    activePlayer = null;
  }
  if (activeClient) {
    try { activeClient.close(); } catch {}
    activeClient = null;
  }
  if (localPlaybackProcess) {
    try { localPlaybackProcess.kill('SIGTERM'); } catch {}
    localPlaybackProcess = null;
  }
}

function isPlaying() {
  return !!(activeClient || localPlaybackProcess);
}

function castAudio(deviceHost, devicePort, audioUrl, volume) {
  stopCurrent();
  return new Promise((resolve, reject) => {
    const client = new Client();
    activeClient = client;
    client.connect({ host: deviceHost, port: devicePort || 8009 }, () => {
      client.setVolume({ level: (volume || 80) / 100 }, () => {});
      client.launch(DefaultMediaReceiver, (err, player) => {
        if (err) { client.close(); activeClient = null; return reject(err); }
        activePlayer = player;
        const media = {
          contentId: audioUrl,
          contentType: 'audio/mpeg',
          streamType: 'BUFFERED',
        };
        player.load(media, { autoplay: true }, (err) => {
          if (err) { client.close(); activeClient = null; activePlayer = null; return reject(err); }
          player.on('status', (status) => {
            if (status.playerState === 'IDLE') {
              activeClient = null;
              activePlayer = null;
              client.close();
              resolve();
            }
          });
        });
      });
    });
    client.on('error', (err) => {
      activeClient = null;
      activePlayer = null;
      client.close();
      reject(err);
    });
  });
}

function playLocal(audioPath) {
  stopCurrent();
  const { spawn } = require('child_process');
  const proc = spawn('aplay', [audioPath]);
  localPlaybackProcess = proc;
  proc.on('close', () => { localPlaybackProcess = null; });
  proc.on('error', () => { localPlaybackProcess = null; });
}

module.exports = { startDiscovery, getDevices, castAudio, playLocal, stopCurrent, isPlaying, getLocalIP };
