(function () {
  'use strict';

  var RK = window.RK;
  var generateTapPlate = RK.generateTapPlate;
  var generateNumberPlate = RK.generateNumberPlate;
  var analyzeResults = RK.analyzeResults;
  var VIEW = RK.VIEW;

  // --- iOS pinch-zoom çok katmanlı engelleme ---
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('gesturechange', function (e) { e.preventDefault(); });
  document.addEventListener('gestureend', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault(); // 2+ parmak = zoom
  }, { passive: false });

  // Çift dokunma zoom engeli
  var lastTouch = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  // --- SW kayıt (yalnız http/https altında) ---
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    try {
      navigator.serviceWorker.register('./sw.js').catch(function (err) {
        console.warn('SW kayıt hatası:', err);
      });
    } catch (e) {}
  }

  // --- state ---
  var state = {
    screen: 'welcome',
    stages: [],
    index: 0,
    results: [],
    locked: false
  };
  var app = document.getElementById('app');

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function buildStages() {
    // 10 aşama: 5 dokunma + 5 sayı, renk tipleri rastgele dağıtılmış
    var types = shuffle([
      'protan', 'deutan', 'tritan', 'achromatopsia',
      'protan', 'deutan', 'tritan', 'achromatopsia',
      'protan', 'deutan'
    ]);
    var modes = shuffle([
      'tap', 'tap', 'tap', 'tap', 'tap',
      'number', 'number', 'number', 'number', 'number'
    ]);
    var out = [];
    for (var i = 0; i < types.length; i++) out.push({ kind: modes[i], type: types[i] });
    return out;
  }

  // --- History: sadece ekran geçişlerinde push, aşama içi replaceState ---
  try { history.replaceState({ rk: 'welcome' }, '', ''); } catch (e) {}

  var suppressPop = false;
  window.addEventListener('popstate', function () {
    if (suppressPop) return;

    if (state.screen === 'test') {
      var ok = window.confirm('Testten çıkmak istiyor musunuz? İlerlemeniz kaybolacak.');
      if (!ok) {
        suppressPop = true;
        try { history.pushState({ rk: 'test' }, '', ''); } catch (e) {}
        setTimeout(function () { suppressPop = false; }, 0);
        return;
      }
      state.screen = 'welcome';
      state.index = 0;
      state.results = [];
      state.stages = [];
      try { history.replaceState({ rk: 'welcome' }, '', ''); } catch (e) {}
      render();
    }
  });

  // --- Ekran geçişi ---
  function showScreen(name, opts) {
    opts = opts || {};
    state.screen = name;
    state.locked = false;
    console.log('[RK] Ekran →', name);
    try {
      if (opts.replace) history.replaceState({ rk: name }, '', '');
      else               history.pushState({ rk: name }, '', '');
    } catch (e) {}
    render();
  }

  function render() {
    if (state.screen === 'welcome') return renderWelcome();
    if (state.screen === 'test')    return renderTest();
    if (state.screen === 'result')  return renderResult();
  }

  // --- WELCOME ---
  function renderWelcome() {
    app.innerHTML =
      '<section class="screen welcome">' +
        '<h1>Renk Körlüğü Testi</h1>' +
        '<p>10 aşamalı hızlı renk görme taraması.</p>' +
        '<p>5 aşamada farklı renkli alana dokunacak,<br>5 aşamada gizli sayıyı yazacaksınız.</p>' +
        '<button id="start" class="btn primary">Testi Başlat</button>' +
      '</section>';

    document.getElementById('start').onclick = function () {
      state.stages = buildStages();
      state.index = 0;
      state.results = [];
      showScreen('test');
    };
  }

  // --- Aşama ilerletme ---
  function nextStage() {
    state.index++;
    if (state.index >= state.stages.length) {
      showScreen('result');
    } else {
      showScreen('test', { replace: true });
    }
  }

  function showFeedback(text, ok) {
    var el = document.getElementById('feedback');
    if (!el) return;
    el.textContent = text;
    el.className = 'feedback ' + (ok ? 'correct' : 'wrong') + ' show';
  }

  function renderTest() {
    var s = state.stages[state.index];
    if (!s) { showScreen('result'); return; }
    var progress = ((state.index + 1) / state.stages.length) * 100;
    if (s.kind === 'tap') renderTapStage(s, progress);
    else                  renderNumberStage(s, progress);
  }

  // --- TAP AŞAMASI (pointerdown = anında tepki) ---
  function renderTapStage(s, progress) {
    var res = generateTapPlate(s.type);
    var target = res.target;

    app.innerHTML =
      '<section class="screen test">' +
        '<div class="progress-bar"><div class="fill" style="width:' + progress + '%"></div></div>' +
        '<p class="progress-text">' + (state.index + 1) + ' / ' + state.stages.length + '</p>' +
        '<h2>Farklı renkteki alana dokunun</h2>' +
        '<div class="plate" id="plate">' + res.svg + '</div>' +
        '<div id="feedback" class="feedback"></div>' +
        '<button id="skip" class="btn ghost">Bilmiyorum (boş geç)</button>' +
      '</section>';

    var plate = document.getElementById('plate');

    function handlePoint(clientX, clientY) {
      if (state.locked) return;
      state.locked = true;
      plate.style.pointerEvents = 'none';

      var rect = plate.getBoundingClientRect();
      var x = (clientX - rect.left) * (VIEW / rect.width);
      var y = (clientY - rect.top)  * (VIEW / rect.height);
      var dist = Math.hypot(x - target.cx, y - target.cy);
      var correct = dist <= target.r;

      state.results.push({ kind: 'tap', type: s.type, correct: correct });
      console.log('[RK] TAP', s.type, 'dist=' + dist.toFixed(1), 'r=' + target.r.toFixed(1), correct ? '✓' : '✗');

      showFeedback(correct ? '✓ Doğru' : '✗ Yanlış', correct);
      setTimeout(nextStage, 550);
    }

    if (window.PointerEvent) {
      plate.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        handlePoint(e.clientX, e.clientY);
      }, { once: true });
    } else {
      plate.addEventListener('touchstart', function (e) {
        var t = e.changedTouches[0];
        handlePoint(t.clientX, t.clientY);
      }, { once: true, passive: true });
      plate.addEventListener('click', function (e) {
        handlePoint(e.clientX, e.clientY);
      }, { once: true });
    }

    document.getElementById('skip').onclick = function () {
      if (state.locked) return;
      state.locked = true;
      state.results.push({ kind: 'tap', type: s.type, correct: false });
      nextStage();
    };
  }

  // --- SAYI AŞAMASI ---
  function renderNumberStage(s, progress) {
    var number = 1 + Math.floor(Math.random() * 99); // 1..99
    var gen = generateNumberPlate(s.type, number);

    app.innerHTML =
      '<section class="screen test">' +
        '<div class="progress-bar"><div class="fill" style="width:' + progress + '%"></div></div>' +
        '<p class="progress-text">' + (state.index + 1) + ' / ' + state.stages.length + '</p>' +
        '<h2>Görseldeki gizli sayıyı yazın</h2>' +
        '<div class="plate">' + gen.svg + '</div>' +
        '<div class="input-row" id="inputRow">' +
          '<input id="answer" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="1-99" autocomplete="off">' +
          '<button id="submit" class="btn primary">Onayla</button>' +
        '</div>' +
        '<div id="feedback" class="feedback"></div>' +
        '<button id="skip" class="btn ghost">Bilmiyorum (boş geç)</button>' +
      '</section>';

    var input = document.getElementById('answer');
    var inputRow = document.getElementById('inputRow');

    input.addEventListener('input', function () {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 2);
    });

    // Klavye açılınca input görünür kalsın
    input.addEventListener('focus', function () {
      setTimeout(function () {
        if (inputRow.scrollIntoView) {
          inputRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 300);
    });

    function submitFn() {
      if (state.locked) return;
      state.locked = true;
      var val = parseInt(input.value.trim(), 10);
      var correct = !isNaN(val) && val === number;
      state.results.push({ kind: 'number', type: s.type, correct: correct });
      console.log('[RK] NUMBER', s.type, 'beklenen:', number, 'girilen:', val, correct ? '✓' : '✗');
      showFeedback(correct ? '✓ Doğru' : '✗ Yanlış — cevap: ' + number, correct);
      setTimeout(nextStage, 750);
    }

    document.getElementById('submit').onclick = submitFn;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitFn(); }
    });
    document.getElementById('skip').onclick = function () {
      if (state.locked) return;
      state.locked = true;
      state.results.push({ kind: 'number', type: s.type, correct: false });
      nextStage();
    };

    // Sadece masaüstünde otomatik focus (mobil klavye pat diye açılmasın)
    if (!('ontouchstart' in window)) {
      setTimeout(function () { input.focus(); }, 120);
    }
  }

  // --- SONUÇ ---
  function renderResult() {
    var a = analyzeResults(state.results);
    var rows = '';
    var keys = Object.keys(a.byType);
    for (var i = 0; i < keys.length; i++) {
      var d = a.byType[keys[i]];
      if (d.total === 0) continue;
      rows +=
        '<div class="type-row">' +
          '<div class="type-name">' + d.name + '</div>' +
          '<div class="progress-bar"><div class="fill" style="width:' + d.percent + '%"></div></div>' +
          '<div class="type-stat">' + d.correct + '/' + d.total + ' doğru — %' + Math.round(d.percent) + '</div>' +
        '</div>';
    }

    app.innerHTML =
      '<section class="screen result">' +
        '<h1>Sonuç</h1>' +
        '<p class="score">' + a.overall.correct + ' / ' + a.overall.total + ' doğru</p>' +
        '<div class="suspicion">' +
          '<h2>' + a.label + '</h2>' +
          '<p>' + a.description + '</p>' +
        '</div>' +
        '<h3>Tip bazında analiz</h3>' +
        rows +
        '<button id="restart" class="btn primary" style="margin-top:12px">Yeniden Test Et</button>' +
      '</section>';

    document.getElementById('restart').onclick = function () {
      showScreen('welcome', { replace: true });
    };
  }

  // --- Başlat ---
  showScreen('welcome', { replace: true });
})();