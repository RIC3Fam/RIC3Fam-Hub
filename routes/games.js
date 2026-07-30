import { Router } from 'express';

import { usersData, gamesData, groupsData, mediaData } from '../data/index.js';
import * as helpers from '../helpers.js';

const router = Router();

router
    .route('/')
    .get(async (req, res) => {
        try {
            const viewerId = req.session.user?._id;
            const allEvents = await gamesData.getAll(false, viewerId);
            const pastEvents = await gamesData.getPast(viewerId);
            const eventsPageSlideshow = await mediaData.getEventPageSlideshow();

            const ret = {
                title: 'Events',
                events: allEvents,
                pastEvents,
                slideshowImages: helpers.normalizeSlideshowSlides(eventsPageSlideshow.slideshowImages),
                portraitSlideshow: true,
            };

            return res.render('eventsList', ret);
        } catch (err) {
            console.log(err);
            return res.status(500).json({ error: 'An error occurred while retrieving events' });
        }
    })
    .post(async (req, res) => {
        const gameName = req.body.gameName;
        const gameDescription = req.body.gameDescription;
        const zip = req.body.zip;
        const state = req.body.state;
        const streetAddress = req.body.streetAddress;
        const city = req.body.city;
        const maxCapacity = req.body.maxPlayers;
        let gameDate = req.body.date;
        let startTime = req.body.startTime;
        let endTime = req.body.endTime;
        const group = req.body.group;
        const group2 = req.body.group2;
        const group3 = req.body.group3;
        let gameLocation = { zip: zip, state: state, streetAddress: streetAddress, city: city };
        const organizer = req.session.user._id;
        let link = req.body.link;
        let linkdesc = req.body.linkdesc;
        let link2 = req.body.link2;
        let link2desc = req.body.link2desc;
        const visibility = req.body.visibility;
        const privateDescription = req.body.privateDescription;

        try {
            helpers.isValidNum(req.body.maxPlayers);
            let maxPlayersNumber = parseInt(maxCapacity, 10);
            startTime = helpers.stringHelper(startTime, 'Start Time');
            endTime = helpers.stringHelper(endTime, 'End Time');
            gameDate = helpers.stringHelper(gameDate, 'Event Date');
            gamesData.formatAndValidateGame(gameName, gameDescription, gameLocation, maxPlayersNumber, gameDate, startTime, endTime, organizer, link, linkdesc);

            const createResult = await gamesData.create(
                gameName,
                gameDescription,
                gameLocation,
                maxPlayersNumber,
                gameDate,
                startTime,
                endTime,
                group,
                organizer,
                link,
                linkdesc,
                visibility,
                privateDescription,
                link2,
                link2desc,
                group2,
                group3
            );
            return res.redirect(`/events/${createResult._id}`);
        } catch (err) {
            return res.status(400).render('error', { title: 'Error', error: err || 'An error occurred while creating the event' });
        }
    });

router.route('/:gameId').get(async (req, res) => {
    try {
        let gameId = req.params.gameId;

        helpers.isValidId(gameId);
        let gameObj = await gamesData.get(gameId);

        if (!helpers.viewerCanAccessGame(req.session.user, gameObj)) {
            return res.status(403).render('privateEntity', {
                title: 'Private Event',
                entityType: 'event',
                entityName: gameObj.gameName,
                canJoin: !!req.session.user,
                joinUrl: '/events/join/' + gameId
            });
        }

        let hostGroups = [];
        const groupIds =
            Array.isArray(gameObj.groups) && gameObj.groups.length
                ? gameObj.groups
                : gameObj.group && gameObj.group !== 'N/A'
                  ? [gameObj.group]
                  : [];
        for (const gid of groupIds) {
            try {
                hostGroups.push(await groupsData.get(gid));
            } catch (e) {
                continue;
            }
        }

        const start12 = helpers.convertTo12Hour(gameObj.startTime);
        const end12 = helpers.convertTo12Hour(gameObj.endTime);
        const eventSchedule = helpers.formatEventSchedule(gameObj.gameDate, start12, end12);
        gameObj.startTime = start12;
        gameObj.endTime = end12;
        gameObj.gameDate = helpers.convertToMMDDYYYY(gameObj.gameDate);

        let players = (gameObj.players || []).filter((id) => id !== gameObj.organizer);
        let playersArr = await usersData.getIDName(players);

        let currentUser = req.session.user;
        let isOwner = currentUser && gameObj.organizer == currentUser._id;
        let isMember = currentUser && gameObj.players.includes(currentUser._id);
        let organizerDisplay = null;
        if (gameObj.organizer !== null) {
            try {
                const org = await usersData.getUser(gameObj.organizer);
                organizerDisplay = {
                    _id: org._id,
                    name: org.name || org.username,
                    username: org.username,
                };
            } catch (e) {
                organizerDisplay = null;
            }
        }

        const leaders = [];
        for (const row of gameObj.leaders || []) {
            try {
                const person = await usersData.getUser(row.userId);
                leaders.push({
                    title: row.title,
                    _id: person._id,
                    name: person.name || person.username,
                    username: person.username,
                });
            } catch (e) {
                continue;
            }
        }

        const currentUserId = req.session.user ? req.session.user._id : null;
        for (const comment of gameObj.comments) {
            try {
                comment.sender = (await usersData.getIDName([comment.userId]))[0];
                comment.isSender = currentUserId === comment.userId;
            } catch {
                comment.isSender = false;
            }
        }

        return res.render('game', {
            title: 'Event: ' + gameObj.gameName,
            game: gameObj,
            players: playersArr,
            organizer: organizerDisplay,
            leaders,
            hostGroups,
            eventSchedule,
            isOwner: isOwner,
            isMember: isMember,
            slideshowImages: helpers.normalizeSlideshowSlides(gameObj.slideshowImages || []),
            canSeePrivateBox: helpers.viewerCanSeePrivateBox(currentUser, gameObj, 'game'),
            isPublic: gameObj.visibility !== 'private',
        });
    } catch (e) {
        res.status(400).render('error', { title: 'Error', error: e });
    }
});

router
    .route('/edit/:gameId')
    .get(async (req, res) => {
        try {
            let gameId = req.params.gameId;
            helpers.isValidId(gameId);
            let gameObj = await gamesData.get(gameId);
            let allGroupsData = null;

            if (req.session.user) {
                let userId = req.session.user._id;
                allGroupsData = await groupsData.getAllGroupsbyUserID(userId);
            }

            const leadersForEdit = [];
            for (const row of gameObj.leaders || []) {
                try {
                    const person = await usersData.getUser(row.userId);
                    leadersForEdit.push({
                        title: row.title,
                        userId: person._id,
                        label: `${person.name || person.username} (@${person.username})`,
                    });
                } catch (e) {
                    continue;
                }
            }

            const selectedGroups = Array.isArray(gameObj.groups) && gameObj.groups.length
                ? gameObj.groups
                : gameObj.group && gameObj.group !== 'N/A'
                  ? [gameObj.group]
                  : [];

            return res.render('editGame', {
                title: 'Edit Event',
                user: req.session.user,
                gameObj,
                states: helpers.states,
                groups: allGroupsData,
                leaders: leadersForEdit,
                selectedGroup1: selectedGroups[0] || 'N/A',
                selectedGroup2: selectedGroups[1] || 'N/A',
                selectedGroup3: selectedGroups[2] || 'N/A',
                slideshowImages: helpers.normalizeSlideshowSlides(gameObj.slideshowImages || []),
                isOwner: true,
            });
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    })
    .post(async (req, res) => {
        try {
            let gameId = req.params.gameId;
            let currentUser = req.session.user;
            helpers.isValidId(gameId);
            const gameObj = await gamesData.get(gameId);

            if (!gameObj.players.includes(currentUser._id)) {
                throw 'You are not a player in this game';
            } else if (gameObj.organizer !== currentUser._id) {
                throw 'You are not the organizer of this game';
            }

            helpers.isValidNum(req.body.maxPlayers);
            let maxPlayersNumber = parseInt(req.body.maxPlayers, 10);
            let startTime = helpers.stringHelper(req.body.startTime, 'Start Time');
            let endTime = helpers.stringHelper(req.body.endTime, 'End Time');
            let gameDate = helpers.stringHelper(req.body.date, 'Event Date');
            let map = req.body.map != null ? helpers.optionalString(req.body.map, 'Map Link') : '';
            let directions = req.body.directions != null ? helpers.optionalString(req.body.directions, 'Directions') : '';
            const organizer = req.session.user._id;

            if (!helpers.isValidDay(gameDate)) throw 'Event Date is not valid';

            let gameLocation = { zip: req.body.zip, state: req.body.state, streetAddress: req.body.streetAddress, city: req.body.city };

            gamesData.formatAndValidateGame(
                req.body.gameName,
                req.body.gameDescription,
                gameLocation,
                maxPlayersNumber,
                gameDate,
                startTime,
                endTime,
                organizer,
                req.body.link,
                req.body.linkdesc
            );

            await gamesData.update(
                gameId,
                organizer,
                req.body.gameName,
                req.body.gameDescription,
                gameLocation,
                maxPlayersNumber,
                gameDate,
                startTime,
                endTime,
                req.body.group,
                null,
                map,
                directions,
                req.body.link,
                req.body.linkdesc,
                req.body.visibility,
                req.body.privateDescription,
                req.body.leaders,
                req.body.link2,
                req.body.link2desc,
                req.body.group2,
                req.body.group3,
                req.body.listOnEventsPage === 'on'
            );

            return res.redirect('/events/' + gameId);
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router.route('/:gameId/comments').post(async (req, res) => {
    try {
        let gameId = req.params.gameId;
        let comment = req.body.comment;
        let userId = req.session.user._id;

        helpers.isValidId(gameId);
        helpers.isValidId(userId);
        helpers.stringHelper(comment, 'Comment', 1, 1000);

        await gamesData.addComment(gameId, userId, comment);

        return res.redirect('/events/' + gameId);
    } catch (e) {
        if (e === 'Could not update group successfully') return res.status(500).render('error', { error: e });
        return res.status(400).render('error', { title: 'Error', error: e });
    }
});

router.route('/:gameId/comments/delete').post(async (req, res) => {
    try {
        let gameId = req.params.gameId;
        let commentId = req.body.commentId;

        helpers.isValidId(gameId);
        helpers.isValidId(commentId);

        await gamesData.removeComment(gameId, commentId);
        return res.redirect('/events/' + gameId);
    } catch (err) {
        return res.status(400).render('error', { title: 'Error', error: err });
    }
});

router.route('/delete/:gameId').post(async (req, res) => {
    try {
        let gameId = req.params.gameId;
        let currentUser = req.session.user;

        helpers.isValidId(gameId);
        const gameObj = await gamesData.get(gameId);

        let owner = await usersData.getUser(gameObj.organizer);

        if (!gameObj.players.includes(currentUser._id)) {
            throw 'You are not a player in this game';
        } else if (currentUser._id !== owner._id) {
            throw 'You are not the organizer of this game';
        }

        await gamesData.remove(gameId);

        return res.redirect(`/`);
    } catch (e) {
        return res.status(400).render('error', { title: 'Error', error: e });
    }
});

router.route('/join/:gameId').post(async (req, res) => {
    try {
        let gameId = req.params.gameId;
        let currentUser = req.session.user;

        helpers.isValidId(gameId);

        await gamesData.addUser(currentUser._id, gameId);

        return res.redirect('/events/' + gameId);
    } catch (e) {
        return res.status(400).render('error', { title: 'Error', error: e });
    }
});

router.route('/leave/:gameId').post(async (req, res) => {
    try {
        let gameId = req.params.gameId;
        let currentUser = req.session.user;

        helpers.isValidId(gameId);

        await gamesData.leaveGame(currentUser._id, gameId);
        return res.redirect('/events/' + gameId);
    } catch (e) {
        return res.status(400).render('error', { title: 'Error', error: e });
    }
});

export default router;
