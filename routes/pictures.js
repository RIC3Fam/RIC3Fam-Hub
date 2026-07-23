import { Router } from 'express';
import { usersData, picturesData, gamesData, groupsData, mediaData } from '../data/index.js';
import * as helpers from '../helpers.js';

const router = Router();

async function assertCanManageGroupSlideshow(userId, group) {
    if (!userId) throw 'Must be logged in';
    if (group.groupLeader === userId) return;
    if (await usersData.isUserAdmin(userId)) return;
    throw 'You are not the leader of this group';
}

// req in the form of {filenames: ['filename.jpeg']}
router
    .route('/slideshow')
    .get(function (req, res) {
        // TODO
        return res.render('addToSlideshow', {
            /* Stuff here */
        });
    })
    .post(async function (req, res) {
        const filenames = req.body.filenames;
        const isEventPage = req.body.isEventPage;
        const groupId = req.body.groupId;
        const gameId = req.body.gameId;
        let urls = [];
        let id = '';

        if (groupId) {
            try {
                helpers.isValidId(groupId);
                const group = await groupsData.get(groupId);
                await assertCanManageGroupSlideshow(req.session.user?._id, group);
                id = groupId;
            } catch (err) {
                console.log(err);
                return res.status(500).render('error', { title: 'Error', error: err });
            }
        } else if (gameId) {
            try {
                helpers.isValidId(gameId);
                const game = await gamesData.get(gameId);
                if (game.organizer !== req.session.user._id) {
                    throw 'You are not the admin of this event';
                }
                id = gameId;
            } catch (err) {
                console.log(err);
                return res.status(500).render('error', { title: 'Error', error: err });
            }
        } else if (isEventPage) {
            id = 'eventPage';
        } else {
            id = req.session.user._id;
        }

        console.log('Generating signed urls');

        // Gets signed urls for each image
        try {
            // Can change to whatever number of images we need
            for (let i = 0; i < filenames.length; i++) {
                const filename = helpers.stringHelper(filenames[i], 'Filename');
                if (filename.includes(' ')) throw 'Filename cannot contain spaces';

                urls.push(await picturesData.generateUploadSignedUrl(id, filenames[i], 'slideshow'));
            }
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        console.log('Urls generated');
        console.log('Adding to slideshow');

        // Updates image urls in the relevant collection
        try {
            for (let i = 0; i < urls.length; i++) {
                const imagePath = `slideshow/${filenames[i]}`;
                if (groupId) await groupsData.addSlideshowImage(groupId, imagePath);
                else if (gameId) await gamesData.addSlideshowImage(gameId, imagePath);
                else if (isEventPage) await mediaData.addEventPageSlideshowImage(imagePath);
                else await usersData.addSlideshowImage(req.session.user._id, imagePath);
            }
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        // Send array of valid urls
        return res.json(urls);
    })
    .patch(async function (req, res) {
        try {
            if (!req.session.user) throw 'Must be logged in';
            const imageUrl = helpers.stringHelper(req.body.imageUrl, 'Image URL', 1, 2048);
            const caption = helpers.optionalString(req.body.caption, 'Caption', 200);
            const groupId = req.body.groupId;
            const gameId = req.body.gameId;
            const isEventPage = !!(req.body.isEventPage === true || req.body.isEventPage === 'true');

            if (groupId) {
                helpers.isValidId(groupId);
                const group = await groupsData.get(groupId);
                await assertCanManageGroupSlideshow(req.session.user._id, group);
                await groupsData.updateSlideshowCaption(groupId, imageUrl, caption);
            } else if (gameId) {
                helpers.isValidId(gameId);
                const game = await gamesData.get(gameId);
                if (game.organizer !== req.session.user._id) throw 'You are not the admin of this event';
                await gamesData.updateSlideshowCaption(gameId, imageUrl, caption);
            } else if (isEventPage) {
                const isAdmin = await usersData.isUserAdmin(req.session.user._id);
                if (!isAdmin) throw 'Admin only';
                await mediaData.updateEventPageSlideshowCaption(imageUrl, caption);
            } else {
                await usersData.updateSlideshowCaption(req.session.user._id, imageUrl, caption);
            }
            return res.json({ ok: true, caption });
        } catch (err) {
            console.log(err);
            return res.status(400).json({ error: String(err) });
        }
    })
    .delete(async function (req, res) {
        // Updates image urls in the relevant collection
        const isEventPage = req.body.isEventPage;
        const groupId = req.body.groupId;
        const gameId = req.body.gameId;

        try {
            const filename = req.body.filename;
            const imagePath = `slideshow/${filename}`;
            const BUCKET_NAME = process.env.BUCKET_NAME;
            let id;
            if (groupId) {
                helpers.isValidId(groupId);
                const group = await groupsData.get(groupId);
                await assertCanManageGroupSlideshow(req.session.user?._id, group);
                id = groupId;
            } else if (gameId) {
                helpers.isValidId(gameId);
                const game = await gamesData.get(gameId);
                if (game.organizer !== req.session.user._id) {
                    throw 'You are not the admin of this event';
                }
                id = gameId;
            } else if (isEventPage) {
                id = 'eventPage';
            } else {
                id = req.session.user._id;
            }
            const bucketPath = `https://storage.googleapis.com/${BUCKET_NAME}/${id}/${imagePath}`;

            console.log('Removing from slideshow');
            if (groupId) await groupsData.removeSlideshowImage(groupId, imagePath);
            else if (gameId) await gamesData.removeSlideshowImage(gameId, imagePath);
            else if (isEventPage) await mediaData.removeEventPageSlideshowImage(imagePath);
            else await usersData.removeSlideshowImage(req.session.user._id, imagePath);

            console.log('Deleting from bucket');
            await picturesData.deleteImageFromBucket(bucketPath);
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        req.method = 'GET';
        if (groupId) return res.redirect(303, '/groups/' + groupId);
        if (gameId) return res.redirect(303, '/events/' + gameId);
        if (isEventPage) return res.redirect(303, '/events');
        return res.redirect(303, '/users/' + req.session.user._id);
    });

// req in the form of {filename: 'filename.jpeg'}
router
    .route('/pfp')
    .get(function (req, res) {
        // TODO
        return res.render('updatePfp', {});
    })
    .post(async function (req, res) {
        const filename = req.body.filename;
        const oldFilename = req.session.user.profilePicture;
        let url = '';

        console.log('Generating signed url');

        // Gets signed url for each image
        try {
            if (filename.includes(' ')) throw 'Filename cannot contain spaces';
            url = await picturesData.generateUploadSignedUrl(req.session.user._id, helpers.stringHelper(filename, 'Filename'), 'pfp');
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        console.log('Url generated');

        // Updates image url in user pfp collection
        try {
            const imagePath = `pfp/${filename}`;
            console.log('Updating pfp');
            await usersData.editPfp(req.session.user._id, imagePath);
            console.log('Deleting old pfp from bucket');
            await picturesData.deleteImageFromBucket(oldFilename);
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        // Send array of valid url
        return res.json(url);
    });

router
    .route('/games/:gameId')
    .get(async function (req, res) {
        return res.render('updateGameImage', {});
    })
    .post(async function (req, res) {
        const filename = req.body.filename;
        const gameId = req.params.gameId;
        let url = '';
        let game = {};

        try {
            game = await gamesData.get(gameId);
            if (game.organizer !== req.session.user._id) {
                throw 'You are not the organizer of this game';
            }
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        console.log('Generating signed url');

        // Gets signed url for each image
        try {
            if (filename.includes(' ')) throw 'Filename cannot contain spaces';
            url = await picturesData.generateUploadSignedUrl(game._id, helpers.stringHelper(filename, 'Filename'), 'gameImage');
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        console.log('Url generated');

        // Updates image url in user pfp collection
        try {
            const imagePath = `gameImage/${filename}`;
            console.log('Updating game image');
            await gamesData.editGameImage(game._id, imagePath);
            console.log('Deleting old game image from bucket');
            await picturesData.deleteImageFromBucket(game.gameImage);
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        // Send array of valid url
        return res.json(url);
    });

router
    .route('/groups/:groupId')
    .get(async function (req, res) {
        return res.render('updateGroupImage', {});
    })
    .post(async function (req, res) {
        const filename = req.body.filename;
        const groupId = req.params.groupId;
        let url = '';
        let group = {};

        try {
            group = await groupsData.get(groupId);
            if (group.groupLeader !== req.session.user._id) {
                throw 'You are not the leader of this group';
            }
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        console.log('Generating signed url');

        // Gets signed url for each image
        try {
            if (filename.includes(' ')) throw 'Filename cannot contain spaces';
            url = await picturesData.generateUploadSignedUrl(group._id, helpers.stringHelper(filename, 'Filename'), 'groupImage');
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        console.log('Url generated');

        // Updates image url in user pfp collection
        try {
            const imagePath = `groupImage/${filename}`;
            console.log('Updating group image');
            await groupsData.editGroupImage(group._id, imagePath);
            console.log('Deleting old group image from bucket');
            await picturesData.deleteImageFromBucket(group.groupImage);
        } catch (err) {
            console.log(err);
            return res.status(500).render('error', { title: 'Error', error: err });
        }

        // Send array of valid url
        return res.json(url);
    });

router.route('/home').post(async function (req, res) {
    try {
        if (!req.session.user) throw 'Must be logged in';
        const isAdmin = await usersData.isUserAdmin(req.session.user._id);
        if (!isAdmin) throw 'Admin only';

        const field = helpers.stringHelper(req.body.field, 'Field', 1, 40);
        const filename = helpers.stringHelper(req.body.filename, 'Filename', 1, 120);
        if (filename.includes(' ')) throw 'Filename cannot contain spaces';

        const allowed = {
            buildingImageUrl: { type: 'building', contentType: 'image/jpeg' },
            billboardVideoUrl: { type: 'billboard', contentType: 'video/mp4' },
            towel1Image: { type: 'towel1', contentType: 'image/jpeg' },
            towel2Image: { type: 'towel2', contentType: 'image/jpeg' },
        };
        const spec = allowed[field];
        if (!spec) throw 'Unknown home upload field';

        const contentType = req.body.contentType || spec.contentType;
        if (contentType !== spec.contentType) throw 'Invalid content type';

        const url = await picturesData.generateUploadSignedUrl('homePage', filename, spec.type, contentType);
        await mediaData.setHomeAssetUrl(field, `${spec.type}/${filename}`);
        return res.json({ url });
    } catch (err) {
        console.log(err);
        return res.status(400).json({ error: String(err) });
    }
});

export default router;
