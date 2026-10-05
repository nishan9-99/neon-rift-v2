(function() {
  'use strict';
  const N = window.NR;
  N.save.load();
  N.save.sanitizeLoadout();
  N.ui.init();
  N.input.init();
  N.audio.applyVolumes();
  N.game.init();
  const s = N.save.data.settings;
  document.body.dataset.touch = s.touchControls === 'on' || s.touchControls === 'auto' && N.input.touchCapable ? 'on' : 'off';
  document.body.dataset.left = s.leftHanded ? 'on' : 'off';
  document.body.dataset.reduced = N.reduced() ? 'on' : 'off';
  if (N.save.notice) N.ui.toast(N.save.notice, 5);
})();
