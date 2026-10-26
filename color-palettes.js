(function () {
  'use strict';

  // Ishihara prensibi: hue farkı YÜKSEK (renk körü göremez)
  // + luminans farkı ORTA (normal göz net okur, telefonda bile görünür)
  var PALETTES = {
    protan: {
      name: 'Protan (Kırmızı Körlüğü)',
      base: '#ece8d8',
      // BG: koyu yeşil (lum ~118)  |  FG: kırmızı (lum ~98)  → fark ~20
      bg: ['#6a9a30', '#628e28', '#72a238', '#5c8824', '#669430'],
      fg: ['#c83818', '#b83010', '#d04020', '#b02808', '#c03414']
    },
    deutan: {
      name: 'Deutan (Yeşil Körlüğü)',
      base: '#ece8d8',
      bg: ['#6a9a30', '#628e28', '#72a238', '#5c8824', '#669430'],
      fg: ['#c83818', '#b83010', '#d04020', '#b02808', '#c03414']
    },
    tritan: {
      name: 'Tritan (Mavi-Sarı Körlüğü)',
      base: '#e8e0c8',
      // BG: sarı (lum ~150)  |  FG: mavi (lum ~95)  → fark ~55 (kolay okunur)
      bg: ['#d8b030', '#cc9c20', '#e0bc40', '#c49410', '#d4a828'],
      fg: ['#4060b8', '#3650a8', '#5070c8', '#2c4498', '#3a58b0']
    },
    achromatopsia: {
      name: 'Tam Renk Körlüğü',
      base: '#cfcfcf',
      // BG: koyu kırmızı (lum ~100)  |  FG: koyu yeşil (lum ~80)  → fark ~20
      bg: ['#a85840', '#b06048', '#a05038', '#ac5c44', '#a4543c'],
      fg: ['#3a6a28', '#427030', '#345e20', '#3e6628', '#386024']
    }
  };

  function pickColor(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function analyzeResults(results) {
    var overall = { correct: 0, total: results.length };
    var byType = {};
    var keys = Object.keys(PALETTES);
    for (var k = 0; k < keys.length; k++) {
      byType[keys[k]] = { name: PALETTES[keys[k]].name, correct: 0, total: 0, percent: 0 };
    }
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r.correct) overall.correct++;
      if (byType[r.type]) {
        byType[r.type].total++;
        if (r.correct) byType[r.type].correct++;
      }
    }
    for (var kk = 0; kk < keys.length; kk++) {
      var t = byType[keys[kk]];
      t.percent = t.total > 0 ? (t.correct / t.total) * 100 : 0;
    }

    var accuracy = overall.total > 0 ? overall.correct / overall.total : 0;
    var label, description;

    var failures = keys
      .filter(function (k) { return byType[k].total > 0; })
      .map(function (k) { return { key: k, rate: 1 - byType[k].correct / byType[k].total }; })
      .sort(function (a, b) { return b.rate - a.rate; });

    var allHighFailure = failures.length > 0 && failures.every(function (f) { return f.rate >= 0.5; });

    if (accuracy >= 0.9) {
      label = '✅ Normal görme';
      description = 'Sonuçlarınız normal renk görme aralığında.';
    } else if (allHighFailure) {
      label = '⚫ Tam renk körlüğü şüphesi';
      description = 'Tüm renk tiplerinde belirgin zorluk görüldü. Kesin tanı için göz doktoruna başvurun.';
    } else if (failures.length === 0) {
      label = '✅ Normal görme';
      description = 'Sonuçlarınız normal renk görme aralığında.';
    } else {
      var worst = failures[0];
      if (worst.rate < 0.3) {
        label = '⚠️ Sınırda sonuç';
        description = 'Bazı aşamalarda zorlandınız; belirgin bir renk körlüğü paterni görülmedi.';
      } else if (worst.key === 'protan' || worst.key === 'deutan') {
        label = '🔴 Kırmızı-Yeşil renk körlüğü şüphesi';
        description = 'Kırmızı-yeşil tonlarında zorlandınız. Kesin tanı için göz doktoruna başvurun.';
      } else if (worst.key === 'tritan') {
        label = '🔵 Mavi-Sarı renk körlüğü şüphesi';
        description = 'Mavi-sarı tonlarında zorlandınız. Kesin tanı için göz doktoruna başvurun.';
      } else {
        label = '⚫ Tam renk körlüğü şüphesi';
        description = 'Renk ayrımında belirgin zorluk görüldü. Kesin tanı için göz doktoruna başvurun.';
      }
    }

    return { overall: overall, byType: byType, label: label, description: description };
  }

  window.RK = window.RK || {};
  Object.assign(window.RK, {
    PALETTES: PALETTES, pickColor: pickColor, rand: rand, analyzeResults: analyzeResults
  });
})();