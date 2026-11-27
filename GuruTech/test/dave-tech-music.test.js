import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDaveTechApiUrl, buildDaveTechAudioDownloadUrl, buildDaveTechAudioStreamUrl, extractYouTubeVideoId, parseDaveTechMusicSearch, parseDaveTechMusicSong, parseDaveTechPlayResponse, youtubeWatchUrl, audioMimeType, audioFileExtension, isYouTubeUrl } from '../lib/daveTechMusic.js';
import sendAudioSafe from '../lib/sendAudioSafe.js';

test('Dave Tech request URLs encode query text and use the configured API origin', () => {
  const url = new URL(buildDaveTechApiUrl('/youtube/music/search', { q: 'Sauti Sol & Nyashinski', type: 'songs', limit: 1 }));
  assert.equal(url.origin, 'https://obitotechapis.devs.surf');
  assert.equal(url.pathname, '/youtube/music/search');
  assert.equal(url.searchParams.get('q'), 'Sauti Sol & Nyashinski');
  assert.equal(url.searchParams.get('type'), 'songs');
  assert.equal(url.searchParams.get('limit'), '1');
});

test('YouTube Music search parser extracts the song id and catalogue metadata', () => {
  assert.deepEqual(parseDaveTechMusicSearch({
    status: true,
    result: { results: [{
      type: 'song', id: 'lYBUbBu4W08', title: 'Never Gonna Give You Up',
      artist: { name: 'Rick Astley' }, duration_seconds: 214,
      thumbnail: 'https://example.test/cover.jpg', video_id: 'lYBUbBu4W08'
    }] }
  }), [{
    title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: 214,
    thumbnail: 'https://example.test/cover.jpg', videoId: 'lYBUbBu4W08'
  }]);
  assert.deepEqual(parseDaveTechMusicSearch({ status: false, result: { results: [] } }), []);
  assert.equal(youtubeWatchUrl('lYBUbBu4W08'), 'https://www.youtube.com/watch?v=lYBUbBu4W08');
  assert.equal(youtubeWatchUrl('not-a-video-id'), '');
  assert.equal(extractYouTubeVideoId('https://youtu.be/lYBUbBu4W08?t=4'), 'lYBUbBu4W08');
  assert.equal(extractYouTubeVideoId('https://music.youtube.com/watch?v=lYBUbBu4W08'), 'lYBUbBu4W08');
  assert.equal(extractYouTubeVideoId('https://youtube.com/shorts/lYBUbBu4W08'), 'lYBUbBu4W08');
  assert.equal(extractYouTubeVideoId('https://example.com/watch?v=lYBUbBu4W08'), '');
  assert.equal(buildDaveTechAudioStreamUrl('lYBUbBu4W08'), 'https://obitotechapis.devs.surf/stream/audio/lYBUbBu4W08');
  assert.equal(buildDaveTechAudioStreamUrl('bad-id'), '');
  assert.equal(buildDaveTechAudioDownloadUrl('lYBUbBu4W08', 'mp3'), 'https://obitotechapis.devs.surf/download/audio/lYBUbBu4W08?format=mp3');
  assert.equal(buildDaveTechAudioDownloadUrl('lYBUbBu4W08', 'm4a'), 'https://obitotechapis.devs.surf/download/audio/lYBUbBu4W08?format=m4a');
  assert.equal(buildDaveTechAudioDownloadUrl('bad-id'), '');
  assert.equal(buildDaveTechAudioDownloadUrl('lYBUbBu4W08', 'wav'), '');
  assert.deepEqual(parseDaveTechMusicSong({ status: true, result: {
    type: 'song', id: 'lYBUbBu4W08', title: 'Never Gonna Give You Up',
    artist: { name: 'Rick Astley' }, duration_seconds: 214,
    thumbnail: 'https://example.test/cover.jpg', video_id: 'lYBUbBu4W08'
  } }), {
    title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: 214,
    thumbnail: 'https://example.test/cover.jpg', videoId: 'lYBUbBu4W08'
  });
  assert.equal(parseDaveTechMusicSong({ status: false }), null);
  assert.equal(isYouTubeUrl('https://music.youtube.com/watch?v=lYBUbBu4W08'), true);
  assert.equal(isYouTubeUrl('https://youtu.be/lYBUbBu4W08'), true);
  assert.equal(isYouTubeUrl('not a URL'), false);
});

test('Dave Tech resolver parser accepts its documented download_url result and actual format', () => {
  const media = parseDaveTechPlayResponse({
    status: true,
    result: {
      title: 'Track title', format: 'webm', thumbnail: 'https://example.test/thumb.jpg',
      download_url: 'https://media.example.test/audio?token=abc'
    }
  });
  assert.deepEqual(media, {
    title: 'Track title', channel: '', duration: '', thumbnail: 'https://example.test/thumb.jpg',
    filename: '', link: 'https://media.example.test/audio?token=abc', format: 'webm', provider: 'dave-tech'
  });
  assert.equal(parseDaveTechPlayResponse({ status: true, result: { title: 'missing link' } }), null);
  assert.equal(parseDaveTechPlayResponse({ status: false, error: 'upstream unavailable' }), null);
});

test('audio formats map to accurate MIME types and file extensions', () => {
  assert.equal(audioMimeType('webm'), 'audio/webm');
  assert.equal(audioMimeType('m4a'), 'audio/mp4');
  assert.equal(audioMimeType('mp3'), 'audio/mpeg');
  assert.equal(audioFileExtension('audio/webm'), 'webm');
  assert.equal(audioFileExtension('audio/mp4'), 'm4a');
});

test('sendAudioSafe names files according to their MIME type', async () => {
  const sent = [];
  const client = { sendMessage: async (...args) => { sent.push(args); } };
  await sendAudioSafe(client, 'chat@s.whatsapp.net', Buffer.from('audio'), {
    title: 'Sample track', mimetype: 'audio/webm'
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1].audio.toString(), 'audio');
  assert.equal(sent[0][1].mimetype, 'audio/webm');
  assert.equal(sent[0][1].fileName, 'Sample track.webm');
});
