const MAX_UNCOMPRESSED = 100 * 1024 * 1024;
const MAX_COMPRESSED = 105 * 1024 * 1024;
const SENSITIVE_TERMS = ['health', 'therapy', 'anxiety', 'diabetes', 'pregnancy', 'religion', 'politics', 'legal', 'salary', 'debt'];

function inspectZip(bytes) {
  if (bytes.length > MAX_COMPRESSED) throw new Error('Archive is too large to analyze in this browser.');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const firstEndRecord = Math.max(0, bytes.length - 65557);
  let endRecord = -1;
  for (let offset = bytes.length - 22; offset >= firstEndRecord; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) {
      endRecord = offset;
      break;
    }
  }
  if (endRecord < 0) throw new Error('This is not a valid ZIP archive.');

  const disk = view.getUint16(endRecord + 4, true);
  const centralDisk = view.getUint16(endRecord + 6, true);
  const entriesOnDisk = view.getUint16(endRecord + 8, true);
  const entryCount = view.getUint16(endRecord + 10, true);
  const centralSize = view.getUint32(endRecord + 12, true);
  const centralOffset = view.getUint32(endRecord + 16, true);
  if (disk || centralDisk || entriesOnDisk !== entryCount || centralOffset + centralSize > endRecord) {
    throw new Error('Multi-disk or malformed ZIP archives are not supported.');
  }
  if (entryCount === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported by this browser analyzer.');
  }

  const decoder = new TextDecoder();
  const names = [];
  let totalUncompressed = 0;
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > endRecord || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('The ZIP directory is malformed.');
    }
    const flags = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const entryLength = 46 + nameLength + extraLength + commentLength;
    if (offset + entryLength > endRecord) throw new Error('The ZIP directory is truncated.');
    if (flags & 1) throw new Error('Password-protected ZIP archives are not supported.');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error('ZIP64 archives are not supported by this browser analyzer.');
    }

    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = decoder.decode(nameBytes);
    const parts = name.replace(/\\/g, '/').split('/');
    if (name.startsWith('/') || parts.some(part => part.includes('..'))) {
      throw new Error('Unsafe file path inside archive.');
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED) throw new Error('Archive expands beyond the 100 MB safety limit.');
    names.push(name);
    offset += entryLength;
  }
  if (offset !== centralOffset + centralSize) throw new Error('The ZIP directory length is invalid.');
  return names;
}

function decodeJson(bytes) {
  return JSON.parse(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''));
}

function epoch(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value).replace(/Z$/, '+00:00'));
  return Number.isFinite(parsed) ? parsed / 1000 : 0;
}

function detectPlatform(names) {
  const lower = names.map(name => name.toLowerCase());
  if (lower.some(name => name.includes('streaminghistory') || name.includes('streaming_history'))) return 'spotify';
  if (lower.some(name => name.includes('takeout/') || name.includes('my activity') || name.includes('records.json') || name.includes('location history'))) return 'google';
  if (lower.some(name => name.includes('instagram'))) return 'instagram';
  if (lower.some(name => name.includes('amazon') || name.includes('order history'))) return 'amazon';
  if (lower.some(name => name.includes('facebook') || name.includes('meta'))) return 'meta';
  return null;
}

function terms(text) {
  const lowered = text.toLowerCase();
  return SENSITIVE_TERMS.filter(term => lowered.includes(term));
}

function result(platform, locations, activities, interests) {
  const unique = new Map(interests.map(item => [`${item.label}\u0000${item.sensitive}`, item]));
  const distinct = [...unique.values()];
  return {
    platform,
    locations,
    activities,
    interests: distinct,
    counts: { location: locations.length, activity: activities.length, interest: distinct.length }
  };
}

function parseGoogle(files, names) {
  const locations = [];
  const activities = [];
  const interests = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    let data;
    try { data = decodeJson(files[name]); } catch { continue; }
    const lower = name.toLowerCase();
    if (Array.isArray(data) && lower.includes('location')) {
      for (const item of data) {
        const point = item.location || item;
        const latValue = point.latitudeE7 ?? point.latitude;
        const lonValue = point.longitudeE7 ?? point.longitude;
        if (latValue == null || lonValue == null) continue;
        const rawLat = Number(latValue);
        const rawLon = Number(lonValue);
        if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) continue;
        locations.push({
          ts: epoch(item.timestamp ?? item.timestampMs),
          lat: rawLat / (Math.abs(rawLat) > 90 ? 1e7 : 1),
          lon: rawLon / (Math.abs(rawLon) > 180 ? 1e7 : 1)
        });
      }
    }
    if (Array.isArray(data) && (lower.includes('activity') || lower.includes('my activity') || lower.includes('search'))) {
      for (const item of data) {
        const title = String(item.title ?? item.query ?? '').slice(0, 240);
        if (title) activities.push({ ts: epoch(item.time ?? item.timestamp), kind: 'search', detail: title });
      }
    }
    if (data && !Array.isArray(data) && Array.isArray(data.timelineObjects)) {
      for (const item of data.timelineObjects) {
        const place = item.placeVisit || {};
        const location = place.location || {};
        const lat = Number(location.latitudeE7);
        const lon = Number(location.longitudeE7);
        if (lat && lon) locations.push({
          ts: epoch(place.duration?.startTimestamp),
          lat: lat / 1e7,
          lon: lon / 1e7
        });
      }
    }
  }
  for (const row of activities) {
    for (const term of terms(row.detail)) interests.push({ label: term, sensitive: 1 });
  }
  return result('google', locations, activities, interests);
}

function parseSpotify(files, names) {
  const activities = [];
  const interests = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    if (!(lower.includes('streaminghistory') || lower.includes('streaming_history')) || !lower.endsWith('.json')) continue;
    let rows;
    try { rows = decodeJson(files[name]); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const item of rows) {
      const artist = item.artistName || item.master_metadata_album_artist_name || 'Unknown artist';
      const track = item.trackName || item.master_metadata_track_name || 'Unknown track';
      if (!(item.msPlayed ?? item.ms_played ?? 0)) continue;
      activities.push({
        ts: epoch(item.endTime ?? item.ts),
        kind: 'listening',
        detail: `${artist} - ${track}`.slice(0, 240)
      });
      interests.push({ label: String(artist).slice(0, 120), sensitive: 0 });
    }
  }
  return result('spotify', [], activities, interests);
}

function volumeScore(count) {
  if (count < 100) return 1;
  if (count < 1000) return 2;
  if (count < 10000) return 3;
  if (count < 50000) return 4;
  return 5;
}

function effortScore(minutes) {
  if (minutes <= 2) return 1;
  if (minutes <= 5) return 2;
  if (minutes <= 10) return 3;
  if (minutes <= 30) return 4;
  return 5;
}

function bucket(score) {
  return score >= 150 ? 'Critical' : score >= 60 ? 'High' : score >= 20 ? 'Medium' : 'Low';
}

function inferRecords(data) {
  const cells = new Map();
  for (const point of data.locations) {
    const key = `${Math.round(point.lat * 100) / 100},${Math.round(point.lon * 100) / 100}`;
    cells.set(key, (cells.get(key) || 0) + 1);
  }
  const ordered = [...cells.entries()].sort((a, b) => b[1] - a[1]);
  const parseCell = entry => entry ? entry[0].split(',').map(Number) : null;
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const row of data.activities) {
    if (!row.ts) continue;
    const date = new Date(row.ts * 1000);
    if (Number.isNaN(date.getTime())) continue;
    matrix[(date.getDay() + 6) % 7][date.getHours()] += 1;
  }
  return {
    home_work: {
      home: parseCell(ordered[0]),
      work: parseCell(ordered[1]),
      explanation: data.locations.length
        ? 'The most common location cell is treated as home; a second weekday-heavy cell is treated as possible work.'
        : 'No location points were found.'
    },
    rhythm: matrix,
    sensitive_topics: [...new Set(data.interests.filter(item => item.sensitive).map(item => item.label))].sort()
  };
}

function buildFindings(data, kb, inference) {
  const spec = kb.platforms[data.platform] || {};
  const findings = [];
  for (const [type, count] of Object.entries(data.counts)) {
    const meta = spec.data_types?.[type];
    if (!count || !meta) continue;
    const sensitivity = meta.sensitivity;
    const volume = volumeScore(count);
    const inferability = meta.inferability ?? 3;
    const sharing = meta.sharing ?? 1;
    const effort = effortScore(meta.effort_min);
    const priority = Math.round((sensitivity * volume * inferability * sharing) / effort);
    findings.push({
      platform: data.platform, type, label: meta.label, count, sensitivity, volume,
      inferability, sharing, effort, priority, bucket: bucket(priority),
      why: meta.why, steps: meta.steps, minutes: meta.effort_min
    });
  }
  if (inference.sensitive_topics.length) {
    const sharing = spec.shares_score ?? 1;
    const priority = Math.round((5 * 1 * 5 * sharing) / 3);
    findings.push({
      platform: data.platform,
      type: 'sensitive_topics',
      label: 'Sensitive topics in activity',
      count: inference.sensitive_topics.length,
      sensitivity: 5, volume: 1, inferability: 5, sharing, effort: 3,
      priority, bucket: 'High',
      why: 'Sensitive keywords were found in the local export; the platform may use activity for personalization or safety systems.',
      steps: spec.sensitive_steps || [],
      minutes: 10
    });
  }
  return findings.sort((a, b) => b.priority - a.priority);
}

export async function analyzeZip(file, kb) {
  if (!file || !file.name.toLowerCase().endsWith('.zip')) throw new Error('Choose a ZIP export.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const names = inspectZip(bytes);
  const platform = detectPlatform(names);
  if (!platform) throw new Error('Could not identify Google, Spotify, Instagram, Amazon, or Meta data in this ZIP.');

  let files;
  try { files = window.fflate.unzipSync(bytes); }
  catch { throw new Error('The ZIP could not be opened. Check that it is not damaged or password-protected.'); }

  const data = platform === 'google'
    ? parseGoogle(files, names)
    : platform === 'spotify'
      ? parseSpotify(files, names)
      : result(platform, [], [], []);
  const inference = inferRecords(data);
  return {
    platform,
    counts: data.counts,
    findings: buildFindings(data, kb, inference),
    inference,
    dataPoints: Object.values(data.counts).reduce((sum, count) => sum + count, 0)
  };
}
