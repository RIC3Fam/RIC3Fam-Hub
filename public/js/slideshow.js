// Photo gallery behaviour:
//   - captions come from the server (stored) with filename fallback,
//   - click a caption to expand/collapse it,
//   - double-click a picture to enlarge it in a lightbox,
//   - owners can edit captions via the caption inputs,
//   - owner/admin delete (unchanged).

function captionFromUrl(url) {
    try {
        const file = decodeURIComponent(url.split('/').pop().split('?')[0]);
        const base = file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        return base || 'Untitled';
    } catch (e) {
        return 'Untitled';
    }
}

function setError(err) {
    const errorLabel = document.getElementById('error-label');
    if (!errorLabel) return;
    errorLabel.hidden = false;
    errorLabel.textContent = String(err && err.message ? err.message : err);
}

function setMessage(msg) {
    const messageLabel = document.getElementById('message-label');
    if (!messageLabel) return;
    messageLabel.hidden = false;
    messageLabel.textContent = msg;
}

const lightbox = document.getElementById('gallery-lightbox');
const lightboxImg = lightbox ? lightbox.querySelector('.gallery-lightbox-image') : null;
const lightboxCap = lightbox ? lightbox.querySelector('.gallery-lightbox-caption') : null;
const lightboxClose = lightbox ? lightbox.querySelector('.gallery-lightbox-close') : null;

function openLightbox(src, caption) {
    if (!lightbox) return;
    lightboxImg.src = src;
    lightboxCap.textContent = caption;
    lightbox.hidden = false;
}

function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImg.src = '';
}

if (lightbox) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
}

document.querySelectorAll('.gallery-item').forEach((item) => {
    const img = item.querySelector('.gallery-image');
    const caption = item.querySelector('.gallery-caption');
    if (!img) return;

    const text = caption ? caption.textContent.trim() : captionFromUrl(img.src);

    if (caption) {
        caption.addEventListener('click', (e) => {
            e.stopPropagation();
            item.classList.toggle('caption-open');
        });
    }

    img.addEventListener('dblclick', () =>
        openLightbox(img.src, (caption && caption.textContent.trim()) || '')
    );
});

async function saveCaptionFromControl(control, nextValue = null) {
    const wrap = control.closest('[data-image-url]') || control.closest('.gallery-item');
    const input = wrap ? wrap.querySelector('.gallery-caption-input') : null;
    const imageUrl = wrap ? wrap.getAttribute('data-image-url') : null;
    if (!wrap || !input || !imageUrl) return;

    if (nextValue != null) input.value = nextValue;

    try {
        const groupSlideshowId = document.getElementById('group-slideshow-id');
        const groupId = groupSlideshowId ? groupSlideshowId.innerText.trim() : null;
        const gameSlideshowId = document.getElementById('game-slideshow-id');
        const gameId = gameSlideshowId ? gameSlideshowId.innerText.trim() : null;
        const isEventPage = document.getElementById('is-event-page') != null;

        const body = { imageUrl, caption: input.value };
        if (groupId) body.groupId = groupId;
        if (gameId) body.gameId = gameId;
        if (isEventPage) body.isEventPage = true;

        const response = await fetch('/pictures/slideshow', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Could not save caption');
        }

        const figure = document.querySelector(`.gallery-item[data-image-url="${CSS.escape(imageUrl)}"]`);
        const figcaption = figure ? figure.querySelector('.gallery-caption') : null;
        if (figcaption) figcaption.textContent = input.value.trim() || '\u00a0';

        const slide = document.querySelector(`.picture-slider-slide img[src="${CSS.escape(imageUrl)}"]`);
        if (slide) {
            const slideCap = slide.closest('figure')?.querySelector('.picture-slider-caption');
            if (slideCap) slideCap.textContent = input.value.trim() || '\u00a0';
        }

        setMessage(input.value.trim() ? 'Caption saved' : 'Caption cleared');
    } catch (err) {
        setError(err);
    }
}

document.querySelectorAll('.gallery-caption-save').forEach((button) => {
    button.addEventListener('click', async () => {
        await saveCaptionFromControl(button);
    });
});

document.querySelectorAll('.gallery-caption-clear').forEach((button) => {
    button.addEventListener('click', async () => {
        await saveCaptionFromControl(button, '');
    });
});

document.querySelectorAll('.gallery-delete-button').forEach((button) => {
    button.addEventListener('click', async () => {
        const item = button.closest('.gallery-item') || button.closest('.picture-slider-slide');
        const img = item ? item.querySelector('img') : null;
        if (!img) return;

        try {
            const response = await handleDeletion(img.src);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Delete failed with status ${response.status}`);
            }
            setMessage('Successfully deleted image');
            item.remove();
            location.reload();
        } catch (err) {
            console.log(err);
            setError(err);
        }
    });
});

async function handleDeletion(fullImagePath) {
    const filename = decodeURIComponent(fullImagePath.split('/').pop().split('?')[0]);

    const isEventPage = document.getElementById('is-event-page') != null;
    const groupSlideshowId = document.getElementById('group-slideshow-id');
    const groupId = groupSlideshowId ? groupSlideshowId.innerText.trim() : null;
    const gameSlideshowId = document.getElementById('game-slideshow-id');
    const gameId = gameSlideshowId ? gameSlideshowId.innerText.trim() : null;

    const body = {
        filename: filename,
        isEventPage: isEventPage,
    };
    if (groupId) body.groupId = groupId;
    if (gameId) body.gameId = gameId;

    const response = await fetch('/pictures/slideshow', {
        mode: 'cors',
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    return response;
}
