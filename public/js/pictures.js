let pfpForm = document.getElementById('pfp-form');
let slideshowForm = document.getElementById('slideshow-form');
let gameForm = document.getElementById('game-image-form');
let groupForm = document.getElementById('group-image-form');
let gameId = document.getElementById('game-id');
let groupId = document.getElementById('group-id');
let submitButton = document.getElementById('image-submit-button');

const mb = 1048576; // 1 MB
const maxSize = 10 * mb; // 10 MB

// Usable for pfp uploads
if (pfpForm) {
    let pfpInput = document.getElementById('pfp-upload');

    pfpForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            let file = pfpInput.files[0];

            if (!file) {
                throw Error('Please select a file!');
            }

            if (file.type != 'image/jpeg') {
                throw Error('Only JPEG allowed!');
            }

            if (file.size > maxSize) {
                throw Error('File too large!');
            }

            const filename = file.name.replace(/\s/g, '-');
            const signedUrl = await getPfpUrl(filename);

            console.log('Got signed url');

            await handleUpload([file], [signedUrl]);
            //event.currentTarget.submit();
            submitButton.disabled = true;
        } catch (err) {
            setError(err);
        }
    });
}

// Usable for game image uploads
if (gameForm) {
    let gameInput = document.getElementById('game-upload');

    gameForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            let file = gameInput.files[0];

            if (!file) {
                throw Error('Please select a file!');
            }

            if (file.type != 'image/jpeg') {
                throw Error('Only JPEG allowed!');
            }

            if (file.size > maxSize) {
                throw Error('File too large!');
            }

            const filename = file.name.replace(/\s/g, '-');
            const signedUrl = await getGameUrl(filename);

            console.log('Got signed url');

            await handleUpload([file], [signedUrl]);
            //event.currentTarget.submit();
            submitButton.disabled = true;
        } catch (err) {
            setError(err);
        }
    });
}

// Usable for group image uploads
if (groupForm) {
    let groupInput = document.getElementById('group-upload');

    groupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            let file = groupInput.files[0];

            if (!file) {
                throw Error('Please select a file!');
            }

            if (file.type != 'image/jpeg') {
                throw Error('Only JPEG allowed!');
            }

            if (file.size > maxSize) {
                throw Error('File too large!');
            }

            const filename = file.name.replace(/\s/g, '-');
            const signedUrl = await getGroupUrl(filename);

            console.log('Got signed url');

            await handleUpload([file], [signedUrl]);
            //event.currentTarget.submit();
            submitButton.disabled = true;
        } catch (err) {
            setError(err);
        }
    });
}

// Usable for slideshow uploads
if (slideshowForm) {
    let slideshowInput = document.getElementById('slideshow-upload');

    // Check to see if this is the event page
    let isEventPage = document.getElementById('is-event-page');
    if (typeof isEventPage != 'undefined' && isEventPage != null) {
        isEventPage = true;
    } else {
        isEventPage = false;
    }

    let groupSlideshowId = document.getElementById('group-slideshow-id');
    let groupId = groupSlideshowId ? groupSlideshowId.innerText.trim() : null;
    let gameSlideshowId = document.getElementById('game-slideshow-id');
    let gameId = gameSlideshowId ? gameSlideshowId.innerText.trim() : null;

    slideshowForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            let files = slideshowInput.files;

            if (!files || files.length === 0) {
                console.log('No files selected');
                throw Error('Please select a file!');
            }

            for (const file of files) {
                if (file.type != 'image/jpeg') {
                    console.log('File type not jpeg');
                    throw Error('Only JPEG allowed!');
                }

                if (file.size > maxSize) {
                    throw Error(`File: ${file.name} too large!`);
                }
            }

            let filenames = [];

            for (var i = 0; i < files.length; i++) {
                filenames.push(files[i].name.replace(/\s/g, '-'));
            }

            console.log('Getting signed urls');

            const signedUrls = await getSlideshowUrls(filenames, isEventPage, groupId, gameId);

            console.log('Uploading');

            await handleUpload(files, signedUrls);
            //event.currentTarget.submit();
            submitButton.disabled = true;
        } catch (err) {
            setError(err);
        }
    });
}

/**
 * Gets the signed Url for a new pfp
 * @param {string} filename
 */
async function getPfpUrl(filename) {
    const options = {
        filename: filename,
    };

    const signedUrl = await getUrls(options, 'pfp');

    return signedUrl;
}

/**
 * Gets the signed Url for a new game image
 * @param {string} filename
 */
async function getGameUrl(filename) {
    const options = {
        filename: filename,
    };
    const signedUrl = await getUrls(options, `games/${gameId.innerText}`);

    return signedUrl;
}

/**
 * Gets the signed Url for a new group image
 * @param {string} filename
 */
async function getGroupUrl(filename) {
    const options = {
        filename: filename,
    };
    const signedUrl = await getUrls(options, `groups/${groupId.innerText}`);

    return signedUrl;
}

/**
 * Gets the signed url(s) for new slideshow image(s)
 * @param {[string]} filenames
 */
async function getSlideshowUrls(filenames, isEventPage = false, groupId = null, gameId = null) {
    const options = {
        filenames: filenames,
        isEventPage: isEventPage,
    };
    if (groupId) options.groupId = groupId;
    if (gameId) options.gameId = gameId;

    const signedUrls = await getUrls(options, 'slideshow');

    return signedUrls;
}

/**
 * Fetches signed urls from server
 * @param {[string]} fileNames
 * @param {string} type
 * @returns
 */
async function getUrls(options, type) {
    console.log('Getting signed urls');
    const url = `/pictures/${type}`;
    console.log(options, type);
    console.log(url);

    const response = await fetch(url, {
        mode: 'cors',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
    });

    if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data; // Return the data received from the server (an array of signed URLs)
}

/**
 *
 * @param {[File]} files
 * @param {[string]} signedUrls
 * @returns
 */
async function handleUpload(files, signedUrls) {
    setMessage('Preparing to upload');
    console.log('Preparing to upload', files);
    try {
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > maxSize) throw `File ${files[i].name} too large`;

            const response = await fetch(signedUrls[i], {
                mode: 'cors',
                method: 'PUT',
                body: files[i],
                headers: { 'Content-Type': 'image/jpeg' },
            });

            if (response.ok) {
                setMessage(`File ${files[i].name} uploaded successfully.`);
            } else {
                setError(`File ${files[i].name} upload failed with status ${response.status}.`);
            }
        }
        console.log('Done');
        setMessage('Files done uploading!');
    } catch (error) {
        setError(`File upload failed: ${error.message}`);
        console.log(`Error uploading: ${error.message}`);
        return;
    }
    location.reload();
}

function setMessage(message) {
    let messageLabel = document.getElementById('message-label');
    let errorLabel = document.getElementById('error-label');

    if (messageLabel.hidden) {
        messageLabel.hidden = false;
    }
    if (!errorLabel.hidden) {
        errorLabel.hidden = true;
    }

    messageLabel.innerHTML = message;
}

function setError(error) {
    let messageLabel = document.getElementById('message-label');
    let errorLabel = document.getElementById('error-label');

    if (errorLabel.hidden) {
        errorLabel.hidden = false;
    }
    if (!messageLabel.hidden) {
        messageLabel.hidden = true;
    }

    errorLabel.innerHTML = error;
}
