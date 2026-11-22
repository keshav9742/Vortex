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
  if (lower.some(name => name.includes('streaminghistory') || name.includes('streaming_history') || name.includes('spotify'))) return 'spotify';
  if (lower.some(name => name.includes('google') || name.includes('takeout/') || name.includes('my activity') || name.includes('records.json') || name.includes('location history') || name.includes('location_history'))) return 'google';
  if (lower.some(name => name.includes('instagram'))) return 'instagram';
  if (lower.some(name => name.includes('amazon') || name.includes('order history'))) return 'amazon';
  if (lower.some(name => name.includes('facebook') || name.includes('meta'))) return 'meta';
  if (lower.some(name => name.includes('youtube'))) return 'google';
  return null;
}

function terms(text) {
  const lowered = text.toLowerCase();
  return SENSITIVE_TERMS.filter(term => lowered.includes(term));
}

function result(platform, locations, activities, interests, contacts = [], thirdPartyAccess = []) {
  const unique = new Map(interests.map(item => [`${item.label}\u0000${item.sensitive}`, item]));
  const distinct = [...unique.values()];
  const records = [
    ...locations.map(item => ({ platform, category: 'location', item: { lat: item.lat, lon: item.lon }, timestamp: item.ts || 0, sensitivity: 5, source: 'found' })),
    ...activities.map(item => ({ platform, category: 'activity', item: { kind: item.kind, detail: item.detail }, timestamp: item.ts || 0, sensitivity: 3, source: 'found' })),
    ...distinct.map(item => ({ platform, category: 'interest', item: { label: item.label }, timestamp: 0, sensitivity: item.sensitive ? 5 : 2, source: item.sensitive ? 'inferred' : 'found' })),
    ...contacts.map(item => ({ platform, category: 'contact', item: { label: item.label }, timestamp: item.ts || 0, sensitivity: 4, source: 'found' })),
    ...thirdPartyAccess.map(item => ({ platform, category: 'thirdPartyAccess', item: { label: item.label }, timestamp: item.ts || 0, sensitivity: 4, source: 'found' }))
  ];
  return {
    platform,
    locations,
    activities,
    interests: distinct,
    records,
    contacts,
    thirdPartyAccess,
    counts: { location: locations.length, activity: activities.length, interest: distinct.length, contact: contacts.length, thirdPartyAccess: thirdPartyAccess.length }
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

function parseGeneric(files, names, platform) {
  const locations = [];
  const activities = [];
  const interests = [];
  const contacts = [];
  const thirdPartyAccess = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    let data;
    try { data = decodeJson(files[name]); } catch { continue; }
    const rows = Array.isArray(data) ? data : Object.values(data || {}).filter(Array.isArray).flat();
    for (const item of rows) {
      if (!item || typeof item !== 'object') continue;
      const lat = Number(item.latitude ?? item.lat ?? item.latitudeE7);
      const lon = Number(item.longitude ?? item.lon ?? item.lng ?? item.longitudeE7);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 900000000 && Math.abs(lon) <= 1800000000) {
        locations.push({ ts: epoch(item.timestamp ?? item.time ?? item.created_time), lat: lat / (Math.abs(lat) > 90 ? 1e7 : 1), lon: lon / (Math.abs(lon) > 180 ? 1e7 : 1) });
      }
      const label = item.name ?? item.title ?? item.category ?? item.interest ?? item.topic;
      if (label && typeof label !== 'object') interests.push({ label: String(label).slice(0, 120), sensitive: terms(String(label)).length > 0 ? 1 : 0 });
      const detail = item.description ?? item.query ?? item.message ?? item.action ?? item.event ?? item.title;
      if (detail && typeof detail !== 'object') activities.push({ ts: epoch(item.timestamp ?? item.time ?? item.created_time), kind: 'activity', detail: String(detail).slice(0, 240) });
      const contactLabel = item.username ?? item.profile ?? item.actor ?? item.contact ?? item.from ?? item.to ?? item.partner;
      if (contactLabel && typeof contactLabel !== 'object' && /contact|follow|friend|message|connection|profile/i.test(name)) contacts.push({ label: String(contactLabel).slice(0, 120), ts: epoch(item.timestamp ?? item.time ?? item.created_time) });
      if (item.service ?? item.app ?? item.application ?? item.connected_app) thirdPartyAccess.push({ label: String(item.service ?? item.app ?? item.application ?? item.connected_app).slice(0, 120), ts: epoch(item.timestamp ?? item.time) });
    }
  }
  for (const row of activities) for (const term of terms(row.detail)) interests.push({ label: term, sensitive: 1 });
  return result(platform, locations, activities, interests, contacts, thirdPartyAccess);
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
    sensitive_topics: [...new Set(data.interests.filter(item => item.sensitive).map(item => item.label))].sort(),
    location_clusters: ordered.slice(0, 8).map(([key, count], index) => ({ label: index === 0 ? 'Most frequent place' : `Frequent place ${index + 1}`, coordinates: parseCell([key, count]), count })),
    activity_total: data.activities.length
  };
}

function buildFindings(data, kb, inference) {
  const spec = kb.platforms[data.platform] || {};
  const findings = [];
  for (const [type, count] of Object.entries(data.counts)) {
    const meta = spec.data_types?.[type] || (type === 'interest' ? {
      label: 'Interest and preference profile', sensitivity: 3, inferability: 5, sharing: spec.shares_score || 1, effort_min: 10,
      why: 'Repeated artists, searches, topics, and categories can be used to infer your interests and personalize what you see.',
      steps: ['Open the platform privacy or ad-preferences page.', 'Review inferred interests and turn off personalization where available.']
    } : null);
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
      action: type === 'location' ? 'Delete' : type === 'activity' ? 'Restrict' : 'Review',
      source: type === 'interest' || type === 'sensitive_topics' ? 'likely inferred' : 'found in your data',
      formula: `${sensitivity} sensitivity × ${volume} volume × ${inferability} inference × ${sharing} sharing ÷ ${effort} effort`,
      why: meta.why, steps: meta.steps, minutes: meta.effort_min
    });
  }
  for (const type of ['contact', 'thirdPartyAccess']) {
    const count = data.counts?.[type] || 0;
    if (!count) continue;
    const meta = spec.data_types?.[type] || {
      label: type === 'contact' ? 'Contacts and connections' : 'Connected apps and services',
      sensitivity: type === 'contact' ? 4 : 5, inferability: 3, sharing: spec.shares_score || 1, effort_min: 8,
      why: type === 'contact' ? 'Contacts, followers, and message partners can expose your social graph.' : 'Connected services may retain access after you stop using them.',
      steps: type === 'contact' ? ['Open the platform privacy settings.', 'Turn off contact syncing and review connections.'] : ['Open connected apps or third-party access.', 'Remove services you no longer use.']
    };
    const sensitivity=meta.sensitivity, volume=volumeScore(count), inferability=meta.inferability ?? 3, sharing=meta.sharing ?? 1, effort=effortScore(meta.effort_min);
    const priority=Math.round((sensitivity*volume*inferability*sharing)/effort);
    findings.push({ platform:data.platform,type,label:meta.label,count,sensitivity,volume,inferability,sharing,effort,priority,bucket:bucket(priority),action:type==='thirdPartyAccess'?'Change':'Restrict',source:'found in your data',formula:`${sensitivity} sensitivity × ${volume} volume × ${inferability} inference × ${sharing} sharing ÷ ${effort} effort`,why:meta.why,steps:meta.steps,minutes:meta.effort_min });
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
      action: 'Restrict', source: 'likely inferred',
      formula: '5 sensitivity × 1 volume × 5 inference × sharing ÷ 3 effort',
      why: 'Sensitive keywords were found in the local export; the platform may use activity for personalization or safety systems.',
      steps: spec.sensitive_steps || [],
      minutes: 10
    });
  }
  return findings.sort((a, b) => b.priority - a.priority);
}

export async function analyzeFile(file, kb, onProgress = () => {}) {
  if (!file) throw new Error('Choose an export file.');
  const extension = file.name.toLowerCase().split('.').pop();
  onProgress({ stage: 'reading', percent: 8 });
  if (extension !== 'zip') {
    const text = await file.text();
    const platform = detectPlatform([file.name, text.slice(0, 5000)]) || (extension === 'csv' ? 'spotify' : null);
    if (!platform) throw new Error('Could not identify this export. Choose a Google, Spotify, Instagram, Amazon, Meta, or YouTube file.');
    const data = parseRawText(text, file.name, platform, extension);
    const inference = inferRecords(data);
    onProgress({ stage: 'scoring', percent: 100 });
    return buildAnalysis(data, kb, inference);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  onProgress({ stage: 'checking archive', percent: 22 });
  const names = inspectZip(bytes);
  const platform = detectPlatform(names);
  if (!platform) throw new Error('Could not identify Google, Spotify, Instagram, Amazon, or Meta data in this ZIP.');

  let files;
  try { files = window.fflate.unzipSync(bytes); }
  catch { throw new Error('The ZIP could not be opened. Check that it is not damaged or password-protected.'); }
  onProgress({ stage: 'parsing records locally', percent: 62 });

  const data = platform === 'google'
    ? parseGoogle(files, names)
    : platform === 'spotify'
      ? parseSpotify(files, names)
      : parseGeneric(files, names, platform);
  const inference = inferRecords(data);
  onProgress({ stage: 'scoring findings', percent: 92 });
  return buildAnalysis(data, kb, inference);
}

function parseCsv(text, platform) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return result(platform, [], [], []);
  const headers = lines.shift().split(',').map(item => item.trim().toLowerCase());
  const locations = [], activities = [], interests = [];
  for (const line of lines) {
    const values = line.split(',');
    const row = Object.fromEntries(headers.map((key, index) => [key, values[index]?.trim() || '']));
    const lat = Number(row.latitude || row.lat), lon = Number(row.longitude || row.lon || row.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) locations.push({ ts: epoch(row.timestamp || row.time || row.date), lat, lon });
    const artist = row.artistname || row.artist || row.artist_name;
    const detail = artist ? `${artist} - ${row.trackname || row.track || ''}` : (row.title || row.query || row.activity || '');
    if (detail) activities.push({ ts: epoch(row.endtime || row.timestamp || row.time || row.date), kind: artist ? 'listening' : 'activity', detail: detail.slice(0, 240) });
    if (artist) interests.push({ label: artist.slice(0, 120), sensitive: 0 });
  }
  return result(platform, locations, activities, interests);
}

function parseRawText(text, name, platform, extension) {
  if (extension === 'csv') return parseCsv(text, platform);
  if (extension === 'html') return result(platform, [], [{ ts: 0, kind: 'export', detail: text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 240) }], []);
  try {
    const data = JSON.parse(text.replace(/^\uFEFF/, ''));
    const fakeName = name.toLowerCase();
    const files = { [name]: new TextEncoder().encode(text) };
    if (platform === 'spotify') return parseSpotify(files, [name]);
    if (platform === 'google') return parseGoogle(files, [name]);
    return parseGeneric(files, [name], platform);
  } catch {
    throw new Error(`The ${extension.toUpperCase()} file is not valid UTF-8 JSON.`);
  }
}

function buildAnalysis(data, kb, inference) {
  return {
    platform: data.platform,
    counts: data.counts,
    findings: buildFindings(data, kb, inference),
    inference,
    records: data.records,
    dataPoints: Object.values(data.counts).reduce((sum, count) => sum + count, 0),
    analyzedAt: new Date().toISOString()
  };
}

export async function analyzeZip(file, kb, onProgress) { return analyzeFile(file, kb, onProgress); }
