const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const Bonjour = require('bonjour-service');
const os = require('os');

let discoveredDevices = {};

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
      if (host) {
        discoveredDevices[name] = { name, host, port };
      }
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

function castAudio(deviceHost, devicePort, audioUrl, volume) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.connect({ host: deviceHost, port: devicePort || 8009 }, () => {
      client.setVolume({ level: (volume || 80) / 100 }, () => {});
      client.launch(DefaultMediaReceiver, (err, player) => {
        if (err) { client.close(); return reject(err); }
        const media = {
          contentId: audioUrl,
          contentType: 'audio/mpeg',
          streamType: 'BUFFERED',
        };
        player.load(media, { autoplay: true }, (err) => {
          if (err) { client.close(); return reject(err); }
          player.on('status', (status) => {
            if (status.playerState === 'IDLE') {
              client.close();
              resolve();
            }
          });
        });
      });
    });
    client.on('error', (err) => {
      client.close();
      reject(err);
    });
  });
}

module.exports = { startDiscovery, getDevices, castAudio, getLocalIP };
