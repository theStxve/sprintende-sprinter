/*
 * Hintergrund-Check (Capacitor Background Runner, eigene JS-Umgebung ohne WebView).
 * Android startet ihn etwa alle 15 Minuten. Er prüft Züge der Wege mit aktiver Erinnerung,
 * die in den nächsten 2 Stunden fahren, und meldet Verspätung, Ausfall und Gleiswechsel.
 *
 * Daten kommen per Ereignis "sync" aus der App und liegen im CapacitorKV.
 */

var BASE = 'https://api.transitous.org/api/v1';
var LOOKAHEAD_MS = 120 * 60 * 1000;

function readJson(key, fallback) {
  try {
    var r = CapacitorKV.get(key);
    return r && r.value ? JSON.parse(r.value) : fallback;
  } catch (e) {
    return fallback;
  }
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

function matches(link, st) {
  var line = st.routeShortName || st.displayName || '';
  if (link.line && link.line.trim()) {
    var want = norm(link.line);
    var first = norm(line.split(' ')[0]);
    if (first !== want && norm(line).indexOf(want) !== 0) return false;
  }
  if (link.direction && link.direction.trim() && norm(st.headsign).indexOf(norm(link.direction)) < 0) return false;
  return true;
}

function hhmm(ms) {
  var d = new Date(ms);
  return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
}

function idFor(key) {
  var h = 0;
  for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return 200000 + (Math.abs(h) % 90000);
}

function notify(key, title, body) {
  CapacitorNotifications.schedule([
    { id: idFor(key), title: title, body: body, scheduleAt: new Date(Date.now() + 1000), channelId: 'reminders', smallIcon: 'ic_stat_sprinter' },
  ]);
}

async function fetchDepartures(link, fromMs) {
  var time = new Date(fromMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  var res = await fetch(BASE + '/stoptimes?stopId=' + encodeURIComponent(link.stopId) + '&n=100&time=' + time);
  if (!res.ok) return [];
  var data = await res.json();
  return (data.stopTimes || []).filter(function (st) {
    return st.place && st.place.scheduledDeparture && matches(link, st);
  });
}

addEventListener('sync', function (resolve, reject, args) {
  try {
    CapacitorKV.set('presets', JSON.stringify((args && args.presets) || []));
  } catch (e) {
    /* ignorieren */
  }
  resolve();
});

addEventListener('checkTrains', async function (resolve) {
  try {
    var presets = readJson('presets', []);
    var seen = readJson('seen', {});
    var now = Date.now();

    for (var i = 0; i < presets.length; i++) {
      var p = presets[i];
      if (!p.transit) continue;
      var weekday = new Date(now).getDay();
      if (p.days.indexOf(weekday) < 0) continue;

      // Planmäßige Zeiten heute in den nächsten 2 Stunden
      var due = [];
      for (var t = 0; t < p.times.length; t++) {
        var parts = p.times[t].split(':');
        var d = new Date(now);
        d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        if (d.getTime() > now - 5 * 60 * 1000 && d.getTime() - now < LOOKAHEAD_MS) due.push(d.getTime());
      }
      if (!due.length) continue;

      var deps = await fetchDepartures(p.transit, Math.min.apply(null, due) - 5 * 60 * 1000);
      for (var k = 0; k < due.length; k++) {
        var sched = due[k];
        var st = null;
        for (var j = 0; j < deps.length; j++) {
          if (Math.abs(Date.parse(deps[j].place.scheduledDeparture) - sched) < 60000) {
            st = deps[j];
            break;
          }
        }
        if (!st) continue;

        var key = p.id + '-' + sched;
        var state = seen[key] || {};
        // "RB10 (62082)" → "RB10"
        var line = (st.routeShortName || p.transit.line || 'Zug').split(' (')[0];
        var label = line + ' ' + hhmm(sched);
        var cancelled = !!(st.cancelled || st.tripCancelled || st.place.cancelled);
        var real = Date.parse(st.place.departure || st.place.scheduledDeparture);
        var delay = Math.round((real - sched) / 60000);
        var track = st.place.track || null;
        var schedTrack = st.place.scheduledTrack || null;

        if (cancelled && !state.cancelled) {
          notify(key + '-x', p.name + ': ' + label + ' fällt aus', 'Öffne die App für die nächste Verbindung.');
          state.cancelled = true;
        } else if (!cancelled && delay >= 3 && delay !== state.delay) {
          notify(key + '-d', p.name + ': ' + label + ' +' + delay + ' min', 'Neue Abfahrt ' + hhmm(real) + '. Du kannst ' + delay + ' min später los.');
          state.delay = delay;
        } else if (!cancelled && delay < 3 && state.delay >= 3) {
          notify(key + '-d', p.name + ': ' + label + ' wieder pünktlich', 'Abfahrt ' + hhmm(real) + '. Plane wieder mit der normalen Zeit.');
          state.delay = delay;
        }
        if (!cancelled && track && schedTrack && track !== schedTrack && track !== state.track) {
          notify(key + '-g', p.name + ': Gleiswechsel', label + ' fährt heute von Gleis ' + track + ' statt ' + schedTrack + '.');
          state.track = track;
        }
        state.until = sched + 60 * 60 * 1000;
        seen[key] = state;
      }
    }

    // Alte Einträge entfernen
    var keys = Object.keys(seen);
    for (var x = 0; x < keys.length; x++) if (seen[keys[x]].until < now) delete seen[keys[x]];
    CapacitorKV.set('seen', JSON.stringify(seen));
  } catch (e) {
    console.error('checkTrains: ' + e);
  }
  resolve();
});
