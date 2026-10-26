(function () {
  'use strict';
  var RK = window.RK;
  var PALETTES = RK.PALETTES;
  var pickColor = RK.pickColor;

  var VIEW = 320;

  function svgWrap(content) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VIEW + ' ' + VIEW +
           '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ' +
           'shape-rendering="geometricPrecision">' + content + '</svg>';
  }

  function dotsToSvg(dots) {
    var s = '';
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      s += '<circle cx="' + d.x.toFixed(2) + '" cy="' + d.y.toFixed(2) +
           '" r="' + d.r.toFixed(2) + '" fill="' + d.color + '"/>';
    }
    return s;
  }

  // Grid tabanlı nokta yerleşimi
  function placeDotsGrid(size, opts) {
    var cells       = opts.cells       != null ? opts.cells       : 26;
    var cellSize    = size / cells;
    var jitter      = opts.jitter      != null ? opts.jitter      : 0.06;
    var rMin        = opts.rMin        != null ? opts.rMin        : 0.40;
    var rMax        = opts.rMax        != null ? opts.rMax        : 0.46;
    var circleRatio = opts.circleRatio != null ? opts.circleRatio : 0.485;
    var dotPicker   = opts.dotPicker;

    var dots = [];
    var cx = size / 2, cy = size / 2;

    for (var gy = 0; gy < cells; gy++) {
      for (var gx = 0; gx < cells; gx++) {
        var jx = (Math.random() - 0.5) * cellSize * jitter;
        var jy = (Math.random() - 0.5) * cellSize * jitter;
        var px = (gx + 0.5) * cellSize + jx;
        var py = (gy + 0.5) * cellSize + jy;

        if (Math.hypot(px - cx, py - cy) > size * circleRatio) continue;

        var r = cellSize * (rMin + Math.random() * (rMax - rMin));
        var res = dotPicker(px, py, r);
        if (!res) continue;
        dots.push({ x: px, y: py, r: r, color: res.color, group: res.group });
      }
    }
    return dots;
  }

  // ---------- DOKUNMA PLAKASI ----------
  function generateTapPlate(type) {
    var p = PALETTES[type];
    var size = VIEW;

    var targetCx = size * 0.35 + Math.random() * size * 0.30;
    var targetCy = size * 0.35 + Math.random() * size * 0.30;
    var targetR  = size * 0.13 + Math.random() * size * 0.03;

    var dots = placeDotsGrid(size, {
      cells: 26, jitter: 0.06, rMin: 0.42, rMax: 0.48,
      dotPicker: function (px, py) {
        var inTarget = Math.hypot(px - targetCx, py - targetCy) <= targetR;
        return {
          color: pickColor(inTarget ? p.fg : p.bg),
          group: inTarget ? 1 : 0
        };
      }
    });

    var bg = dots.filter(function (d) { return d.group === 0; });
    var fg = dots.filter(function (d) { return d.group === 1; });

    return {
      svg: svgWrap('<rect width="' + size + '" height="' + size + '" fill="' + p.base + '"/>' +
                   dotsToSvg(bg.concat(fg))),
      target: { cx: targetCx, cy: targetCy, r: targetR * 1.35 }
    };
  }

  // ---------- SAYI PLAKASI ----------
  function generateNumberPlate(type, number) {
    var p = PALETTES[type];
    var size = VIEW;

    // === 1) Maske: Arial Black 900, strokeText YOK, ÇOK BÜYÜK ===
    var mask = document.createElement('canvas');
    mask.width = mask.height = size;
    var mctx = mask.getContext('2d');

    var text = String(number);
    var digits = text.length;

    // Sayı plakayı büyük oranda doldursun
    var fs = digits >= 2 ? size * 0.66 : size * 0.82;

    mctx.font = '900 ' + fs + 'px "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.fillStyle = '#000';

    // StrokeText YOK — Arial Black 900 zaten kalın. Stroke delikleri kapatıyordu.
    mctx.fillText(text, size / 2, size / 2);

    var maskData = mctx.getImageData(0, 0, size, size).data;

    function alphaAt(x, y) {
      var px = Math.floor(x), py = Math.floor(y);
      if (px < 0 || py < 0 || px >= size || py >= size) return 0;
      return maskData[(py * size + px) * 4 + 3];
    }

    // === 2) Grid noktalar + kenar yumuşatma için 5-nokta örnekleme ===
    var dots = placeDotsGrid(size, {
      cells: 26,
      jitter: 0.06,
      rMin: 0.40,
      rMax: 0.46,
      dotPicker: function (px, py, r) {
        // Nokta merkezinde ve yarıçapın %50'si uzaklıkta 4 yönde örnek al
        var sr = r * 0.5;
        var sum = alphaAt(px, py);
        sum += alphaAt(px + sr, py);
        sum += alphaAt(px - sr, py);
        sum += alphaAt(px, py + sr);
        sum += alphaAt(px, py - sr);

        var avgAlpha = sum / 5;
        // Eşik 120 — kenarlar rakamın parçası sayılmaz (daha net kontur)
        var isNumber = avgAlpha > 120;
        return {
          color: pickColor(isNumber ? p.fg : p.bg),
          group: isNumber ? 1 : 0
        };
      }
    });

    // BG önce, FG sonra → rakam daima üstte
    var bg = dots.filter(function (d) { return d.group === 0; });
    var fg = dots.filter(function (d) { return d.group === 1; });

    return {
      svg: svgWrap('<rect width="' + size + '" height="' + size + '" fill="' + p.base + '"/>' +
                   dotsToSvg(bg.concat(fg)))
    };
  }

  window.RK = window.RK || {};
  Object.assign(window.RK, {
    generateTapPlate: generateTapPlate,
    generateNumberPlate: generateNumberPlate,
    VIEW: VIEW
  });
})();