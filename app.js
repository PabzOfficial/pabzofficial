(() => {
  const tracks = window.PABZ_TRACKS || [];
  const $ = (id) => document.getElementById(id);
  const audio = $('audio');
  const screen = document.querySelector('.screen');
  const menu = document.createElement('div');
  menu.className = 'screen-menu';
  menu.setAttribute('aria-label', 'iPod song menu');
  screen.insertBefore(menu, document.querySelector('.screen-main'));

  let active = 0;
  let view = 'root';
  let rootSelection = 0;
  let socialSelection = 0;
  const socials = [
    { label: 'Spotify', href: 'https://open.spotify.com/artist/4eYAclu6VpSHshFtuBjzCL' },
    { label: 'Apple Music', href: 'https://music.apple.com/us/artist/pabzofficial/1491766460' },
    { label: 'SoundCloud', href: 'https://soundcloud.com/pabzofficial' },
    { label: 'Instagram', href: 'https://www.instagram.com/pabzofficial/' },
    { label: 'YouTube Music', href: 'https://music.youtube.com/@PabzOfficial' }
  ];
  let loadedTrack = -1;
  let previewRequest = 0;
  let spotifyApi = null;
  let spotifyController = null;
  let spotifyControllerPending = false;
  let spotifyIndex = -1;
  let spotifyPlaying = false;
  let spotifyPendingPlay = null;

  window.onSpotifyIframeApiReady = (api) => { spotifyApi = api; };

  const wrap = (index) => (index + tracks.length) % tracks.length;
  const current = () => tracks[active];

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:30';
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  }

  function renderMenu() {
    if (!tracks.length) return;
    const fragment = document.createDocumentFragment();
    const visible = Math.min(5, tracks.length);
    const start = Math.max(0, Math.min(active - 2, tracks.length - visible));
    for (let index = start; index < start + visible; index++) {
      const track = tracks[index];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'screen-menu-row' + (index === active ? ' selected' : '');
      button.setAttribute('aria-label', `Select ${track.title}`);
      button.setAttribute('aria-current', index === active ? 'true' : 'false');
      button.innerHTML = '<img alt=""><span></span><b>›</b>';
      button.querySelector('img').src = track.art;
      button.querySelector('span').textContent = track.title;
      button.onclick = () => selectAndPlay(index);
      fragment.appendChild(button);
    }
    menu.replaceChildren(fragment);
  }

  function renderSectionMenu() {
    const entries = view === 'root' ? [{ label: 'Music' }, { label: 'Socials' }] : socials;
    const selected = view === 'root' ? rootSelection : socialSelection;
    menu.replaceChildren(...entries.map((entry, index) => {
      const row = document.createElement(view === 'social' && entry.href ? 'a' : 'button');
      row.className = 'screen-menu-row section-row' + (index === selected ? ' selected' : '');
      row.setAttribute('aria-current', String(index === selected));
      const label = document.createElement('span');
      label.textContent = entry.label;
      const marker = document.createElement('b');
      marker.textContent = '›';
      row.append(label, marker);
      if (view === 'social' && entry.href) {
        row.href = entry.href; row.target = '_blank'; row.rel = 'noopener noreferrer';
        row.onclick = () => { socialSelection = index; renderSectionMenu(); };
      } else {
        row.type = 'button';
        if (view === 'social') {
          row.disabled = true; row.setAttribute('aria-label', entry.label + ' — link pending');
          marker.textContent = '—';
        } else row.onclick = () => { rootSelection = index; setView(index === 0 ? 'menu' : 'social'); };
      }
      return row;
    }));
  }

  function setView(mode) {
    view = mode;
    const isMenu = mode !== 'now';
    screen.classList.toggle('menu-visible', isMenu);
    $('screen-back').hidden = mode === 'root';
    $('screen-back').textContent = mode === 'now' ? '‹ Music' : '‹ Menu';
    $('screen-top-label').hidden = mode === 'now';
    $('screen-top-label').textContent = mode === 'root' ? 'PabzOfficial' : mode === 'menu' ? 'Music' : 'Socials';
    $('screen-links').hidden = isMenu;
    $('screen-number').hidden = mode === 'root';
    $('screen-number').textContent = mode === 'social' ? '05 LINKS' : String(active + 1).padStart(2, '0') + ' / ' + tracks.length;
    $('screen-state').textContent = isMenu ? 'USE WHEEL TO BROWSE' : (audio.paused && !spotifyPlaying ? 'READY TO PLAY' : 'NOW PLAYING');
    if (mode === 'menu') renderMenu();
    else if (isMenu) renderSectionMenu();
  }

  function browseMenu(direction) {
    if (view === 'root') { rootSelection = (rootSelection + direction + 2) % 2; renderSectionMenu(); }
    else if (view === 'social') { socialSelection = (socialSelection + direction + socials.length) % socials.length; renderSectionMenu(); }
    else if (view === 'menu') selectTrack(active + direction, 'menu');
  }

  function chooseSelection() {
    if (view === 'root') setView(rootSelection === 0 ? 'menu' : 'social');
    else if (view === 'social') {
      const href = socials[socialSelection].href;
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    } else if (view === 'menu') selectAndPlay(active);
    else togglePreview(false);
  }

  function goBack() { setView(view === 'now' ? 'menu' : 'root'); }

  function selectTrack(index, mode = 'menu') {
    if (!tracks.length) return;
    const next = wrap(index);
    const changed = next !== active;
    if (changed) {
      previewRequest++;
      audio.pause();
      spotifyController?.pause();
      spotifyPlaying = false;
      spotifyPendingPlay = null;
      audio.removeAttribute('src');
      audio.load();
      loadedTrack = -1;
      document.body.classList.remove('is-playing');
      $('progress-fill').style.width = '0%';
      $('current-time').textContent = '0:00';
      $('total-time').textContent = '0:30';
      $('embed-fallback').hidden = true;
      $('embed-frame').removeAttribute('src');
      $('spotify-player').hidden = true;
    }
    active = next;
    const track = current();
    $('screen-number').textContent = String(active + 1).padStart(2, '0') + ' / ' + String(tracks.length).padStart(2, '0');
    $('screen-title').textContent = track.title;
    $('screen-art').src = track.art;
    $('screen-art').alt = `Cover art for ${track.title}`;
    const spotifyTarget = track.spotify || `https://open.spotify.com/search/${encodeURIComponent(`PabzOfficial ${track.title}`)}`;
    $('screen-spotify-link').hidden = false;
    $('screen-spotify-link').href = spotifyTarget;
    $('screen-spotify-link').firstChild.textContent = track.spotify ? 'Spotify ' : 'Spotify search ';
    $('screen-spotify-link').setAttribute('aria-label', track.spotify
      ? `Open ${track.title} on Spotify`
      : `Search Spotify for ${track.title} by PabzOfficial`);
    $('screen-apple-link').hidden = !track.apple;
    if (track.apple) {
      $('screen-apple-link').href = track.apple;
      $('screen-apple-link').setAttribute('aria-label', `Open ${track.title} on Apple Music`);
    }
    $('preview-button').disabled = false;
    $('preview-button').textContent = track.preview
      ? (audio.paused || changed ? '▶ Play 30-second preview' : '❚❚ Pause preview')
      : '▶ Play on Spotify';
    setView(mode);
  }

  function selectAndPlay(index) {
    selectTrack(index, 'now');
    playPreview();
  }

  function navigateTrack(direction) {
    if (view === 'now') selectAndPlay(active + direction);
    else browseMenu(direction);
  }

  function spotifyEventMatches(data) {
    if (current()?.preview || !current()?.spotify || spotifyIndex !== active) return false;
    const expected = current().spotify.split('/').pop().split('?')[0];
    return !data?.playingURI || data.playingURI === `spotify:track:${expected}`;
  }

  function showSpotifyPlayer(reveal = false, autoplay = false) {
    const track = current();
    $('embed-title').textContent = `Preview ${track.title} on Spotify`;
    $('embed-fallback').hidden = false;
    if (!spotifyApi) {
      $('spotify-player').hidden = true;
      $('embed-frame').hidden = false;
      if ($('embed-frame').src !== track.embed) $('embed-frame').src = track.embed;
    } else {
      $('embed-frame').hidden = true;
      $('embed-frame').removeAttribute('src');
      $('spotify-player').hidden = false;
      if (spotifyController) {
        if (spotifyIndex !== active) {
          spotifyController.loadEntity(track.spotify);
          spotifyIndex = active;
        }
        if (autoplay) spotifyController.play();
      } else {
        if (autoplay) spotifyPendingPlay = { index: active, request: previewRequest };
        if (!spotifyControllerPending) {
          spotifyControllerPending = true;
          const slot = document.createElement('div');
          $('spotify-player').replaceChildren(slot);
          try {
            spotifyApi.createController(slot, { url: track.spotify }, (controller) => {
              spotifyControllerPending = false;
              spotifyController = controller;
              controller.addListener('playback_started', (event) => {
                if (!spotifyEventMatches(event.data)) return;
                spotifyPlaying = true;
                document.body.classList.add('is-playing');
                $('screen-state').textContent = 'NOW PLAYING';
                $('preview-button').textContent = '❚❚ Pause preview';
              });
              controller.addListener('playback_update', (event) => {
                if (!spotifyEventMatches(event.data)) return;
                spotifyPlaying = !event.data.isPaused && !event.data.isBuffering;
                document.body.classList.toggle('is-playing', spotifyPlaying);
                $('screen-state').textContent = spotifyPlaying ? 'NOW PLAYING' : 'PLAY IN SPOTIFY PLAYER';
                $('preview-button').textContent = spotifyPlaying ? '❚❚ Pause preview' : '▶ Play on Spotify';
              });
              if (current()?.preview || !current()?.spotify) {
                controller.pause();
                return;
              }
              controller.loadEntity(current().spotify);
              spotifyIndex = active;
              if (spotifyPendingPlay?.index === active && spotifyPendingPlay.request === previewRequest) controller.play();
              spotifyPendingPlay = null;
            });
          } catch (error) {
            spotifyControllerPending = false;
            spotifyPendingPlay = null;
            $('spotify-player').hidden = true;
            $('embed-frame').hidden = false;
            $('embed-frame').src = track.embed;
          }
        }
      }
    }
    if (reveal) $('embed-fallback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showPlatformPlayer(reveal = true) {
    const track = current();
    if (!track.preview) return showSpotifyPlayer(reveal, false);
    if (!audio.paused) {
      previewRequest++;
      audio.pause();
      document.body.classList.remove('is-playing');
    }
    $('screen-state').textContent = 'OPEN MUSIC PLAYER';
    $('preview-button').textContent = '▶ Play preview';
    $('spotify-player').hidden = true;
    $('embed-frame').hidden = false;
    if ($('embed-frame').src !== track.embed) $('embed-frame').src = track.embed;
    $('embed-title').textContent = `Preview ${track.title} with Apple Music`;
    $('embed-fallback').hidden = false;
    if (reveal) $('embed-fallback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function playPreview(stayInMenu = false, revealFallback = false) {
    if (!tracks.length) return;
    if (!stayInMenu && view !== 'now') setView('now');
    const index = active;
    const track = current();
    const request = ++previewRequest;
    if (!track.preview) {
      $('screen-state').textContent = 'PLAY IN SPOTIFY PLAYER';
      $('preview-button').textContent = '▶ Play on Spotify';
      showSpotifyPlayer(revealFallback || !spotifyController, true);
      return;
    }
    if (!audio.paused) {
      $('preview-button').textContent = '❚❚ Pause preview';
      $('screen-state').textContent = 'NOW PLAYING';
      return;
    }
    if (loadedTrack !== active) {
      audio.src = track.preview;
      loadedTrack = active;
    }
    $('screen-state').textContent = 'LOADING PREVIEW';
    try {
      await audio.play();
      if (request !== previewRequest || index !== active) return;
      $('preview-button').textContent = '❚❚ Pause preview';
      $('screen-state').textContent = 'NOW PLAYING';
      if (view === 'menu') renderMenu();
    } catch (error) {
      if (request !== previewRequest || index !== active) return;
      if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
        $('screen-state').textContent = 'TAP PLAY FOR PREVIEW';
        $('preview-button').textContent = '▶ Play preview';
        return;
      }
      $('screen-state').textContent = 'OPEN MUSIC PLAYER';
      $('preview-button').textContent = '▶ Open music player';
      showPlatformPlayer(revealFallback);
    }
  }

  function togglePreview(stayInMenu = false) {
    if (!tracks.length) return;
    if (!current().preview) {
      if (!stayInMenu && view !== 'now') setView('now');
      if (spotifyPlaying && spotifyController) {
        spotifyController.pause();
        spotifyPlaying = false;
        document.body.classList.remove('is-playing');
        $('screen-state').textContent = 'PAUSED';
        $('preview-button').textContent = '▶ Play on Spotify';
      } else {
        previewRequest++;
        $('screen-state').textContent = 'PLAY IN SPOTIFY PLAYER';
        showSpotifyPlayer(true, true);
      }
      return;
    }
    if (audio.paused) return playPreview(stayInMenu, true);
    previewRequest++;
    if (!stayInMenu) setView('now');
    audio.pause();
    $('preview-button').textContent = '▶ Resume preview';
    $('screen-state').textContent = 'PAUSED';
    if (view === 'menu') renderMenu();
  }

  function render() {
    if (tracks.length) selectTrack(0, 'root');
    else setView('root');
  }

  $('prev-button').onclick = () => navigateTrack(-1);
  $('next-button').onclick = () => navigateTrack(1);
  $('menu-button').onclick = goBack;
  $('screen-back').onclick = goBack;
  $('select-button').onclick = chooseSelection;
  $('play-button').onclick = () => { if (view === 'menu' || view === 'now') togglePreview(false); };
  $('preview-button').onclick = () => togglePreview(false);
  $('apple-player-button').onclick = () => showPlatformPlayer(true);

  let wheelAccum = 0;
  let lastWheelTime = 0;
  $('wheel').addEventListener('wheel', (event) => {
    if (event.ctrlKey) return;
    if (view === 'now') { event.preventDefault(); wheelAccum = 0; return; }
    const rawDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!rawDelta) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheelTime > 280) wheelAccum = 0;
    lastWheelTime = now;
    const delta = event.deltaMode === 1 ? rawDelta * 16 : event.deltaMode === 2 ? rawDelta * 100 : rawDelta;
    wheelAccum += delta;
    if (Math.abs(wheelAccum) >= 45) {
      const direction = Math.sign(wheelAccum);
      wheelAccum = 0;
      navigateTrack(direction);
    }
  }, { passive: false });

  let pointerAngle = null;
  let pointerTravel = 0;
  let pointerId = null;
  let pointerMoved = false;
  let suppressWheelClickUntil = 0;
  const wheel = $('wheel');
  const wheelStep = .35;
  function wheelPoint(event) {
    const bounds = wheel.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    return { angle: Math.atan2(y, x), radius: Math.hypot(x, y), size: bounds.width };
  }
  wheel.addEventListener('pointerdown', (event) => {
    if (pointerId !== null || event.isPrimary === false || event.button > 0) return;
    // A fresh tap must work immediately, including SELECT after a rotation.
    suppressWheelClickUntil = 0;
    if (event.target instanceof Element && event.target.closest('.wheel-center')) return;
    if (event.pointerType === 'mouse' && event.target instanceof Element && event.target.closest('button')) return;
    const point = wheelPoint(event);
    if (point.radius < point.size * .25) return;
    pointerId = event.pointerId;
    pointerAngle = point.angle;
    pointerTravel = 0;
    pointerMoved = false;
    // Capture on the original button so a stationary touch still produces its tap.
    const target = event.target instanceof Element ? event.target : wheel;
    target.setPointerCapture(event.pointerId);
  });
  wheel.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const point = wheelPoint(event);
    // Ignore the centre, where tiny finger movements can create large angle jumps.
    if (point.radius < point.size * .25) { pointerAngle = null; return; }
    if (pointerAngle === null) { pointerAngle = point.angle; return; }
    let step = point.angle - pointerAngle;
    if (step > Math.PI) step -= Math.PI * 2;
    if (step < -Math.PI) step += Math.PI * 2;
    pointerTravel += step;
    pointerAngle = point.angle;
    if (Math.abs(pointerTravel) > .12) pointerMoved = true;
    while (Math.abs(pointerTravel) >= wheelStep) {
      const direction = Math.sign(pointerTravel);
      pointerTravel -= direction * wheelStep;
      browseMenu(direction);
    }
  });
  const endWheelPointer = (event) => {
    if (pointerId !== event.pointerId) return;
    if (pointerMoved) suppressWheelClickUntil = Date.now() + 500;
    pointerId = null;
    pointerAngle = null;
    pointerTravel = 0;
    pointerMoved = false;
  };
  wheel.addEventListener('pointerup', endWheelPointer);
  wheel.addEventListener('pointercancel', endWheelPointer);
  wheel.addEventListener('lostpointercapture', endWheelPointer);
  wheel.addEventListener('click', (event) => {
    if (event.detail !== 0 && Date.now() < suppressWheelClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);


  audio.ontimeupdate = () => {
    $('progress-fill').style.width = (audio.duration ? Math.min(100, audio.currentTime / audio.duration * 100) : 0) + '%';
    $('current-time').textContent = formatTime(audio.currentTime);
    if (Number.isFinite(audio.duration)) $('total-time').textContent = formatTime(audio.duration);
  };
  audio.onplay = () => { document.body.classList.add('is-playing'); if (view === 'menu') renderMenu(); };
  audio.onpause = () => { document.body.classList.remove('is-playing'); if (view === 'menu') renderMenu(); };
  audio.onended = () => {
    document.body.classList.remove('is-playing');
    $('preview-button').textContent = '▶ Replay preview';
    $('screen-state').textContent = 'PREVIEW FINISHED';
    if (view === 'menu') renderMenu();
  };
  audio.onerror = () => {
    if (loadedTrack !== active || !current()?.preview || audio.currentSrc !== current().preview) return;
    document.body.classList.remove('is-playing');
    $('screen-state').textContent = 'OPEN MUSIC PLAYER';
    $('preview-button').textContent = '▶ Open music player';
    showPlatformPlayer(false);
  };

  document.addEventListener('keydown', (event) => {
    if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const playerFocused = event.target instanceof Element && !!event.target.closest('.ipod,.coverflow');
    if ((event.key.startsWith('Arrow') || event.key === ' ') && !playerFocused) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); navigateTrack(1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); navigateTrack(-1); }
    if (event.key === 'Escape' || event.key === 'Backspace') { event.preventDefault(); goBack(); }
    if (event.key === ' ' && !(event.target instanceof Element && event.target.closest('button,a'))) { event.preventDefault(); chooseSelection(); }
  });

  // Rotate the device around its centre; touch browsing stays independent.
  const device = document.querySelector('.device-float');
  const tiltEnabled = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tiltFrame = null;
  let tiltX = 0;
  let tiltY = 0;
  function applyTilt() {
    tiltFrame = null;
    device.style.setProperty('--tilt-x', tiltX.toFixed(2) + 'deg');
    device.style.setProperty('--tilt-y', tiltY.toFixed(2) + 'deg');
  }
  function resetTilt() {
    tiltX = 0; tiltY = 0;
    if (tiltFrame !== null) window.cancelAnimationFrame(tiltFrame);
    applyTilt();
  }
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !tiltEnabled.matches || reducedMotion.matches) {
      resetTilt(); return;
    }
    const bounds = document.querySelector('.device-stage').getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left - bounds.width / 2) / Math.max(window.innerWidth / 2, 1);
    const vertical = (event.clientY - bounds.top - bounds.height / 2) / Math.max(window.innerHeight / 2, 1);
    tiltY = Math.max(-1, Math.min(1, horizontal)) * 10;
    tiltX = -Math.max(-1, Math.min(1, vertical)) * 8;
    if (tiltFrame === null) tiltFrame = window.requestAnimationFrame(applyTilt);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', resetTilt);
  window.addEventListener('blur', resetTilt);
  tiltEnabled.addEventListener('change', resetTilt);
  reducedMotion.addEventListener('change', resetTilt);

  render();
})();
