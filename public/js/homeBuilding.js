(function () {
    const video = document.getElementById('home-billboard-video');
    const unmuteBtn = document.getElementById('home-billboard-unmute');
    const playBtn = document.getElementById('home-billboard-play');
    if (!video) return;

    let userPaused = false;

    function tryPlay() {
        video.muted = true;
        userPaused = false;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                // Autoplay blocked until a gesture; keep muted for next attempt.
            });
        }
        updatePlayLabel();
        updateUnmuteLabel();
    }

    function updateUnmuteLabel() {
        if (!unmuteBtn) return;
        if (video.muted) {
            unmuteBtn.textContent = 'Unmute';
            unmuteBtn.setAttribute('aria-label', 'Unmute video');
            unmuteBtn.title = 'Unmute';
        } else {
            unmuteBtn.textContent = 'Mute';
            unmuteBtn.setAttribute('aria-label', 'Mute video');
            unmuteBtn.title = 'Mute';
        }
    }

    function updatePlayLabel() {
        if (!playBtn) return;
        if (video.paused) {
            playBtn.textContent = 'Play';
            playBtn.setAttribute('aria-label', 'Play video');
            playBtn.title = 'Play';
        } else {
            playBtn.textContent = 'Pause';
            playBtn.setAttribute('aria-label', 'Pause video');
            playBtn.title = 'Pause';
        }
    }

    function toggleMute(event) {
        if (event) event.stopPropagation();
        video.muted = !video.muted;
        if (!video.muted && video.paused) {
            userPaused = false;
            video.play().catch(() => {});
        }
        updateUnmuteLabel();
        updatePlayLabel();
    }

    function togglePlay(event) {
        if (event) event.stopPropagation();
        if (video.paused) {
            userPaused = false;
            video.play().catch(() => {});
        } else {
            userPaused = true;
            video.pause();
        }
        updatePlayLabel();
    }

    function enterFullscreen() {
        const target = video;
        if (target.requestFullscreen) return target.requestFullscreen();
        if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen();
        if (target.webkitEnterFullscreen) return target.webkitEnterFullscreen();
        return null;
    }

    tryPlay();
    updateUnmuteLabel();
    updatePlayLabel();

    video.addEventListener('play', updatePlayLabel);
    video.addEventListener('pause', updatePlayLabel);

    // Resume only if the visitor did not intentionally pause.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && video.paused && !userPaused) {
            video.play().catch(() => {});
            updatePlayLabel();
        }
    });

    if (unmuteBtn) {
        unmuteBtn.addEventListener('click', toggleMute);
    }

    if (playBtn) {
        playBtn.addEventListener('click', togglePlay);
    }

    video.addEventListener('dblclick', (event) => {
        event.preventDefault();
        enterFullscreen();
    });

    // Touch double-tap fullscreen (mobile).
    let lastTap = 0;
    video.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            event.preventDefault();
            enterFullscreen();
        }
        lastTap = now;
    });
})();
