import { Router } from 'express';

import { usersData, gamesData, groupsData } from '../data/index.js';
import * as helpers from '../helpers.js';

const router = Router();

function filterRecentProfileEvents(games) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    cutoff.setHours(0, 0, 0, 0);
    return games.filter((game) => {
        if (!game.gameDate) return true;
        const gameDate = new Date(`${game.gameDate}T00:00:00`);
        return Number.isNaN(gameDate.getTime()) || gameDate >= cutoff;
    });
}

router
    .route('/:userId')
    .get(async (req, res) => {
        try {

            let userId = req.params.userId;
            let notFriend = true;
            let userObj = await usersData.getUser(userId);

            if (!helpers.viewerCanAccessUser(req.session.user, userObj)) {
                return res.status(403).render('privateEntity', {
                    title: 'Private Profile',
                    entityType: 'profile',
                    entityName: userObj.name || userObj.username
                });
            }

            if(req.session.user){
                if(req.session.user.friends.includes(userId) || userObj.friendRequests.includes(req.session.user._id)){
                    notFriend = false;
                }
            }
            
            let isOwner = req.session.user != null && req.session.user._id.toString() == userId;
            let friends = await usersData.getIDName(userObj.friends);
            let games = await gamesData.getIDName(userObj.games);
            if (userObj.onlyRecentEvents) games = filterRecentProfileEvents(games);
            let groups = await groupsData.getIDName(userObj.groups);
            
            let requests = await usersData.getIDName(userObj.friendRequests)


            const isAdmin = req.session.user ? await usersData.isUserAdmin(req.session.user._id) : false;
            const shortDescription = (userObj.statement && userObj.statement.trim()) || '';
            const longDescription = (userObj.description && userObj.description.trim()) || '';
            const hasProfileGalleryInfo = !!(
                (userObj.slideshowImages && userObj.slideshowImages.length) ||
                userObj.slideshowDescription ||
                userObj.statement2 ||
                userObj.link3 ||
                userObj.link4
            );

            const ret = {
                title: "User", 
                user: userObj,
                friends: friends,
                groups: groups,
                games: games,
                requests: requests,
                isOwner: isOwner,
                notFriend: notFriend,
                slideshowImages: helpers.normalizeSlideshowSlides(userObj.slideshowImages || []),
                hasProfileGalleryInfo,
                shortDescription,
                longDescription,
                canSeePrivateCommunications: isAdmin,
                canSeeAdminNotes: isAdmin,
                isPublic: userObj.visibility !== 'private'
            }
            return res.render('user', ret);
        } catch (e) {  
            res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/:userId/friends/sendRequest')
    .post(async (req, res) => {
        let senderId = req.session.user._id;
        let friendUserId = req.params.userId;

        try {
            helpers.isValidId(senderId);
            helpers.isValidId(friendUserId);
        } catch (e) {
            return res.status(400).render('error', { error: e });
        }

        try {
            const userObj = await usersData.sendFriendRequest(senderId, friendUserId);
            return res.redirect("/users/" + friendUserId);
        } catch (e) {
            // Uber bandaid
            if (e === 'Could not update user successfully') return res.status(500).render('error', { error: e });
            else return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/:userId/friends/acceptRequest')
    .post(async (req, res) => {
        let userId = req.params.userId;
        let friendUserId = req.body.friendUserId;

        try {
            helpers.isValidId(userId);
            helpers.isValidId(friendUserId);
        } catch (e) {
            return res.status(400).render('error', { error: e });
        }

        try {
            const userObj = await usersData.acceptFriendRequest(userId, friendUserId);

            return res.redirect("/users/" + userId);
        } catch (e) {
            // Uber bandaid
            if (e === 'Could not update user(s) successfully') return res.status(500).render('error', { error: e });
            else return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/:userId/friends/rejectRequest')
    .post(async (req, res) => {
        let userId = req.params.userId;
        let friendUserId = req.body.friendUserId;

        try {
            helpers.isValidId(userId);
            helpers.isValidId(friendUserId);
        } catch (e) {
            return res.status(400).render('error', { error: e });
        }

        try {
            const userObj = await usersData.rejectFriendRequest(userId, friendUserId);

            return res.redirect("/users/" + userId);
        } catch (e) {
            // Uber bandaid
            if (e === 'Could not update user successfully') return res.status(500).render('error', { error: e });
            else return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/:userId/friends/removeFriend')
    .post(async (req, res) => {
        let userId = req.params.userId;
        let friendUserId = req.body.friendUserId;

        try {
            helpers.isValidId(userId);
            helpers.isValidId(friendUserId);
        } catch (e) {
            res.status(400).render('error', { error: e });
        }

        try {
            const userObj = await usersData.removeFriend(userId, friendUserId);

            return res.redirect("/users/" + userId);
        } catch (e) {
            // Uber bandaid
            if (e === 'Could not update user(s) successfully') return res.status(500).render('error', { error: e });
            else return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/edit/:userId')
    .get(async (req, res) => {
        try{
            let userId = req.params.userId;

            if (req.session.user == null || req.session.user._id != userId) {
                return res.status(400).render('error', {error: "Not allowed"});
            }

            // user obj will just be currentUser.
            return res.render("editUser", {title: "Edit user" });
        }
        catch (err){
            return res.status(400).render('error', { title: 'Error', error:err })
        }
    })
    .post(async (req, res) => {
        try {
            let userId = req.params.userId;
            let currentUser = req.session.user;
            let name = req.body.name;
            let username = req.body.username;
            let email = req.body.email;
            let description = req.body.description;
            
            let skills = req.body.skills;
            if (!skills || typeof skills !== 'object') {
                skills = currentUser.skills || {};
            }

            let link1 = req.body.link1;
            let link1desc = req.body.link1desc;
            let link2 = req.body.link2;
            let link2desc = req.body.link2desc;
            let link3 = req.body.link3;
            let link3desc = req.body.link3desc;
            let link4 = req.body.link4;
            let link4desc = req.body.link4desc;
            let statement = req.body.statement;
            let statement2 = req.body.statement2;
            let additionalDescription = req.body.additionalDescription;
            let slideshowDescription = req.body.slideshowDescription;
            let visibility = req.body.visibility;
            let privateDescription = req.body.privateDescription;
            let preferredEmail = req.body.preferredEmail;
            let preferredPhone = req.body.preferredPhone;
            let optInCreativeRealEstate = req.body.optInCreativeRealEstate;
            let optInFrisbeeNotices = req.body.optInFrisbeeNotices;
            let optInCcsnUpdates = req.body.optInCcsnUpdates;
            let onlyRecentEvents = req.body.onlyRecentEvents;

            //console.log(skills);
            if (currentUser._id !== userId) {
                throw Error("not allowed");
            }

            req.session.user = await usersData.editUser(
                currentUser._id,
                username,
                email,
                currentUser.profilePicture,
                description,
                skills,
                name,
                link1,
                link1desc,
                link2,
                link2desc,
                statement,
                additionalDescription,
                slideshowDescription,
                visibility,
                privateDescription,
                preferredEmail,
                preferredPhone,
                optInCreativeRealEstate,
                optInFrisbeeNotices,
                optInCcsnUpdates,
                null,
                statement2,
                link3,
                link3desc,
                link4,
                link4desc,
                onlyRecentEvents
            );
            return res.redirect("/users/" + currentUser._id);
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/:userId/admin-notes')
    .post(async (req, res) => {
        try {
            if (!req.session.user) throw 'Must be logged in';
            const isAdmin = await usersData.isUserAdmin(req.session.user._id);
            if (!isAdmin) throw 'Admin only';
            const userId = req.params.userId;
            await usersData.updateAdminNotes(userId, req.body.adminNotes);
            return res.redirect('/users/' + userId);
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/delete/:userId')
    .post(async (req, res) => {
        try {

            let userId = req.params.userId;
            let currentUser = req.session.user;
            if (currentUser._id !== userId) {
                throw Error("not allowed");
            }
            await usersData.deleteUser(currentUser._id);
            return res.redirect("/logout")
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

export default router;
