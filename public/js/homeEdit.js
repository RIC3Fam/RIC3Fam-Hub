(function () {
    const errorLabel = document.getElementById('error-label');
    const messageLabel = document.getElementById('message-label');
    const mb = 1048576;

    function setError(err) {
        if (!errorLabel) return;
        errorLabel.hidden = false;
        errorLabel.textContent = String(err && err.message ? err.message : err);
        if (messageLabel) messageLabel.hidden = true;
    }

    function setMessage(msg) {
        if (!messageLabel) return;
        messageLabel.hidden = false;
        messageLabel.textContent = msg;
        if (errorLabel) errorLabel.hidden = true;
    }

    async function getSignedUrl(field, filename, contentType) {
        const response = await fetch('/pictures/home', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ field, filename, contentType }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Could not get upload URL');
        }
        const data = await response.json();
        return data.url;
    }

    async function putFile(file, signedUrl, contentType) {
        const response = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: file,
        });
        if (!response.ok) throw new Error('Upload failed');
    }

    function wireUpload(formId, inputId, field, acceptType, maxMb) {
        const form = document.getElementById(formId);
        const input = document.getElementById(inputId);
        if (!form || !input) return;

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            try {
                const file = input.files[0];
                if (!file) throw new Error('Please select a file');
                if (file.type !== acceptType) throw new Error(`Only ${acceptType} allowed`);
                if (file.size > maxMb * mb) throw new Error(`File too large (max ${maxMb}MB)`);

                const filename = file.name.replace(/\s/g, '-');
                const signedUrl = await getSignedUrl(field, filename, acceptType);
                await putFile(file, signedUrl, acceptType);
                setMessage('Upload complete — reloading…');
                window.location.reload();
            } catch (err) {
                setError(err);
            }
        });
    }

    wireUpload('home-poster-form', 'home-poster-upload', 'billboardPosterUrl', 'image/jpeg', 10);
    wireUpload('home-video-form', 'home-video-upload', 'billboardVideoUrl', 'video/mp4', 100);
    wireUpload('home-towel1-form', 'home-towel1-upload', 'towel1Image', 'image/jpeg', 10);
    wireUpload('home-towel2-form', 'home-towel2-upload', 'towel2Image', 'image/jpeg', 10);
})();
