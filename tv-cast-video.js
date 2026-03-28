/**
 * Cast video to Hisense TV via Google Cast protocol (port 8009)
 * Uses castv2-client — the standard Chromecast control library
 * 
 * Usage: node tv-cast-video.js <tv-ip> <video-url>
 */

const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;

const ip = process.argv[2] || '192.168.0.121';
const videoUrl = process.argv[3] || ''; // empty = just check connection

console.log(`Connecting to ${ip}:8009...`);

const client = new Client();

client.connect(ip, () => {
  console.log('Connected to Cast device!');

  if (!videoUrl) {
    console.log('No video URL provided — just testing connection.');
    console.log('Usage: node tv-cast-video.js <ip> <video-url>');
    
    // Get device status
    client.getStatus((err, status) => {
      if (err) { console.error('Status error:', err); }
      else { 
        console.log('\nDevice status:');
        console.log(JSON.stringify(status, null, 2));
      }
      client.close();
      process.exit(0);
    });
    return;
  }

  console.log(`Launching media: ${videoUrl}`);

  client.launch(DefaultMediaReceiver, (err, player) => {
    if (err) {
      console.error('Launch error:', err);
      client.close();
      process.exit(1);
    }

    const media = {
      contentId: videoUrl,
      contentType: 'video/mp4',
      streamType: 'BUFFERED',
      metadata: {
        type: 0,
        metadataType: 0,
        title: 'AYA Expo Video',
      },
      // Repeat/loop: set via queue or repeat mode
    };

    player.load(media, { autoplay: true, repeatMode: 'REPEAT_SINGLE' }, (err, status) => {
      if (err) {
        console.error('Load error:', err);
      } else {
        console.log('Video loaded and playing!');
        console.log('Status:', JSON.stringify(status, null, 2));
        console.log('\nRepeat mode: REPEAT_SINGLE (loop)');
      }
      
      // Keep alive for 5s to confirm playback, then exit
      // The video will continue playing after we disconnect
      setTimeout(() => {
        console.log('\nDisconnecting (video continues playing)...');
        client.close();
        process.exit(0);
      }, 5000);
    });

    player.on('status', (status) => {
      console.log('Player status update:', status.playerState);
    });
  });
});

client.on('error', (err) => {
  console.error('Client error:', err.message);
  process.exit(1);
});

// Timeout
setTimeout(() => {
  console.log('Timeout');
  client.close();
  process.exit(1);
}, 15000);
