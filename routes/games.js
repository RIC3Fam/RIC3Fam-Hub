import { Router } from 'express';

import { usersData, gamesData, groupsData, mediaData } from '../data/index.js';
import * as helpers from '../helpers.js';

const router = Router();

router
    .route('/')
    .get(async (req, res) => {
        try {
            const allEvents = await gamesData.getAll();
            const eventsPageSlideshow = await mediaData.getEventPageSlideshow();
            //const eventsPage = await gamesData.getGamesPage();

            const ret = {
                title: 'Events',
                events: allEvents,
                slideshowImages: eventsPageSlideshow.slideshowImages,
            };

            return res.render('eventsList', ret);
        } catch (err) {
            console.log(err);
            return res.status(500).json({ error: 'An error occurred while retrieving games' });
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
        let gameLocation = { zip: zip, state: state, streetAddress: streetAddress, city: city };
        const organizer = req.session.user._id;
        let link = req.body.link;
        let linkdesc = req.body.linkdesc;

        try {
            helpers.isValidNum(req.body.maxPlayers);
            let maxPlayersNumber = parseInt(maxCapacity, 10);
            startTime = helpers.stringHelper(startTime, 'Start Time');
            endTime = helpers.stringHelper(endTime, 'End Time');
            gameDate = helpers.stringHelper(gameDate, 'Game Date');
            if(link != null && link != ""){
                link = helpers.stringHelper(link, 'Link');
                linkdesc = helpers.stringHelper(linkdesc, 'Link Description', 1, 300);
            }
            //startTime = helpers.convertTo12Hour(startTime);
            //endTime = helpers.convertTo12Hour(endTime);
            //gameDate = helpers.convertToMMDDYYYY(gameDate);
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
                linkdesc
            );
            return res.redirect(`games/${createResult._id}`);
        } catch (err) {
            return res.status(400).render('error', { title: 'Error', error: err || 'An error occurred' });
        }
    });

router.route('/:gameId').get(async (req, res) => {
    try {
        let gameId = req.params.gameId;

        helpers.isValidId(gameId);
        let gameObj = await gamesData.get(gameId);
        let hostGroup = null;

        if (gameObj.group !== 'N/A') {
            hostGroup = await groupsData.get(gameObj.group);
        }

        gameObj.startTime = helpers.convertTo12Hour(gameObj.startTime);
        gameObj.endTime = helpers.convertTo12Hour(gameObj.endTime);
        gameObj.gameDate = helpers.convertToMMDDYYYY(gameObj.gameDate);

        let players = gameObj.players;
        // players = players.filter(player => player !== gameObj.organizer)
        let playersArr = await usersData.getIDName(players);

        let currentUser = req.session.user;
        let isOwner = currentUser && gameObj.organizer == currentUser._id;
        let isMember = currentUser && gameObj.players.includes(currentUser._id);
        let organizerArr = [null];

        if (gameObj.organizer !== null) {
            organizerArr = await usersData.getIDName([gameObj.organizer]);
        }

        //const weather = await weatherData.getWeather(gameObj.gameLocation.zip);

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
            title: 'Game: ' + gameObj.gameName,
            game: gameObj,
            players: playersArr,
            organizer: organizerArr[0],
            hostGroup: hostGroup,
            isOwner: isOwner,
            isMember: isMember,
            //weather: weather,
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

            return res.render('editGame', { title: 'Edit Games', user: req.session.user, gameObj, states: helpers.states, groups: allGroupsData });
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
            let gameDate = helpers.stringHelper(req.body.date, 'Game Date');
            let map = helpers.stringHelper(req.body.map, 'Map Link');
            let directions = helpers.stringHelper(req.body.directions, 'Directions');
            const organizer = req.session.user._id;
            let link = helpers.stringHelper(req.body.link, "Link");
            let linkdesc = helpers.stringHelper(req.body.linkdesc, "Link Description");


            if (!helpers.isValidDay(gameDate)) throw 'Event Date is not valid';

            // let startTime = helpers.convertTo12Hour(req.body.startTime);
            // let endTime = helpers.convertTo12Hour(req.body.endTime);
            // let gameDate = helpers.convertToMMDDYYYY(req.body.date);
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
                link,
                linkdesc
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
                link,
                linkdesc
            );

            return res.redirect('/games/' + gameId);
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

        return res.redirect('/games/' + gameId);
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
        return res.redirect('/games/' + gameId);
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

        return res.redirect('/games/' + gameId);
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
        return res.redirect('/games/' + gameId);
    } catch (e) {
        return res.status(400).render('error', { title: 'Error', error: e });
    }
});

export default router;
