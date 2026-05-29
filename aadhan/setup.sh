#!/bin/bash
# Run this once on your Raspberry Pi to set up Adhan Pi

set -e

echo "=== Adhan Pi Setup ==="

# System dependencies for mdns (avahi) and audio playback
sudo apt-get update -y
sudo apt-get install -y avahi-daemon libavahi-compat-libdnssd-dev alsa-utils nodejs npm

# Create audio directories
mkdir -p audio/presets audio/uploads data

# Download preset Adhan audio files (public domain / Creative Commons)
echo "Note: Place your Adhan MP3 files in audio/presets/ named:"
echo "  makkah.mp3, madinah.mp3, aqsa.mp3"

# Install Node dependencies
npm install

# Create systemd service
SERVICE_FILE="/etc/systemd/system/aadhan.service"
sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=Adhan Pi
After=network.target

[Service]
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
User=$(whoami)
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable aadhan
sudo systemctl start aadhan

echo ""
echo "=== Done! ==="
echo "Adhan Pi is running at http://$(hostname -I | awk '{print $1}'):3000"
echo "Add your Adhan MP3 files to: $(pwd)/audio/presets/"
