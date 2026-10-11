// Renders each <section class="stage"> once into phone and/or PC frames.
// The markup lives in a <template>; data-show="phone pc" picks the frames.
(function () {
  document.querySelectorAll('.stage').forEach(function (stage) {
    var tpl = stage.querySelector('template');
    var mount = stage.querySelector('.devices');
    if (!tpl || !mount) return;
    var kinds = (stage.dataset.show || 'phone pc').split(' ');
    kinds.forEach(function (kind) {
      var wrap = document.createElement('div');
      wrap.className = 'device-wrap';
      var cap = document.createElement('div');
      cap.className = 'cap';
      cap.textContent = kind === 'phone' ? 'Телефон 390 × 844' : 'ПК 1024 × 576';
      // one frame per device; the template's children go inside it, so absolute children stay inside
      var scr = document.createElement('div');
      scr.className = 'screen ' + kind + (stage.hasAttribute('data-tall') ? ' tall' : '');
      Array.prototype.forEach.call(tpl.content.children, function (el) { scr.appendChild(el.cloneNode(true)); });
      if (stage.hasAttribute('data-board')) fillBoard(scr);
      wrap.appendChild(cap);
      wrap.appendChild(scr);
      mount.appendChild(wrap);
    });
  });

  // Board maps: '#' closed, '.' open, digits open with a clue, '^' nest, 'q' queued, 'w' working,
  // '!' danger mark, 's' safe mark, '*' selected, 'x' destroyed nest (open), 'b' building (decor only)
  var GLYPH = { '#': '', '.': '', 'x': '✕', '^': '▲', 'q': '', 'w': '', '!': '⚠', 's': '✓', '*': '', 'b': '' };
  function fillBoard(scr) {
    var board = scr.querySelector('.board[data-map]');
    if (!board) return;
    var rows = board.dataset.map.trim().split('\n').map(function (r) { return r.trim(); });
    var cols = rows[0].length;
    board.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    rows.forEach(function (row, r) {
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        var c = document.createElement('div');
        c.className = 'cell';
        if (ch === '#') { c.classList.add('closed'); c.innerHTML = ''; }
        else if (/[1-8]/.test(ch)) {
          c.innerHTML = '<span class="' + (ch === '1' || ch === '3' ? 'n-find' : ch === '8' ? 'n-demon' : '') + '">' + ch + '</span>';
        }
        else if (ch === '^') { c.classList.add('nest'); c.textContent = '▲'; }
        else if (ch === 'q') { c.classList.add('queue'); }
        else if (ch === 'w') { c.innerHTML = '<span class="work"></span>'; }
        else if (ch === '!') { c.classList.add('danger'); c.textContent = '!'; }
        else if (ch === 's') { c.classList.add('safe'); }
        else if (ch === '*') { c.classList.add('sel'); }
        else if (ch === 'x') { c.classList.add('nest'); c.style.opacity = '.55'; c.textContent = '✕'; }
        board.appendChild(c);
        // closed cells from the map get a tape border when they touch open land
        if (ch === '#' && hasOpenNeighbour(rows, cols, r, i)) { c.innerHTML = '<span class="tape"></span>'; }
      }
    });
    function hasOpenNeighbour(rs, w, r, col) {
      var d = [[-1,0],[1,0],[0,-1],[0,1]];
      return d.some(function (p) {
        var y = r + p[0], x = col + p[1];
        if (y < 0 || y >= rs.length || x < 0 || x >= w) return false;
        return rs[y][x] !== '#';
      });
    }
  }
})();
