import { Router } from 'express';
import { usersData, picturesData, gamesData, groupsData, mediaData } from '../data/index.js';
import * as helpers from '../helpers.js';

const router = Router();

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
                if (group.groupLeader !== req.session.user._id) {
                    throw 'You are not the leader of this group';
                }
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
                if (group.groupLeader !== req.session.user._id) {
                    throw 'You are not the leader of this group';
                }
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
        if (gameId) return res.redirect(303, '/games/' + gameId);
        if (isEventPage) return res.redirect(303, '/games');
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

export default router;
