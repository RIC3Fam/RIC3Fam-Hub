(function () {
    const video = document.getElementById('home-billboard-video');
    const unmuteBtn = document.getElementById('home-billboard-unmute');
    if (!video) return;

    function tryPlay() {
        video.muted = true;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                // Autoplay blocked until a gesture; keep muted for next attempt.
            });
        }
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

    function toggleMute(event) {
        if (event) event.stopPropagation();
        video.muted = !video.muted;
        if (!video.muted && video.paused) {
            video.play().catch(() => {});
        }
        updateUnmuteLabel();
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

    // Some mobile browsers need a delayed retry after layout.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && video.paused) tryPlay();
    });

    if (unmuteBtn) {
        unmuteBtn.addEventListener('click', toggleMute);
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
