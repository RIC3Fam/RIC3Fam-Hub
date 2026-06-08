import { Router } from 'express';

import { usersData, gamesData, groupsData } from '../data/index.js';
import * as helpers from '../helpers.js';
import groups from '../data/groups.js';
const router = Router();

router
    .route('/')
    .post(async (req, res) => {
const groupName = req.body.groupName;
    const groupDescription = req.body.groupDescription;
    const uppercaseTitle = req.body.uppercaseTitle;
    const lowercaseTitle = req.body.lowercaseTitle;
    const numericTitle = req.body.numericTitle;       
        if(!req.session.user) return res.status(400).render('error', { error: "Must be logged in" });
        const groupLeader = req.session.user._id;
        try {
            helpers.validateGroup(groupName, groupDescription, groupLeader)
const createResult = await groupsData.create(
    groupName, 
    groupDescription, 
    groupLeader, 
    [], // Pass the empty array as the 4th argument
    uppercaseTitle, 
    lowercaseTitle, 
    numericTitle
);
    // ...other fields,uppercaseTitle, lowercaseTitle, numericTitle);                 
            res.redirect(`groups/${createResult._id}`);
        } catch (err) {
            return res.status(400).render('error', { title: 'Error', error: err });
        }
    });

router.route('/:groupId').get(async (req, res) => {
    try {

        function stringsAllCaps (string1, string2) {
   
            let string1AllCaps = string1 == string1.toUpperCase();
            let string2AllCaps = string2 == string2.toUpperCase();
            if (string1AllCaps == string2AllCaps) { return 0 }
            if (string1AllCaps > string2AllCaps) { return -1 }
            return 1;
        }


        let groupId = req.params.groupId;
        helpers.isValidId(groupId);
        const groupObj = await groupsData.get(groupId);
        let players=  groupObj.players;
        players = players.filter(player => player !== groupObj.groupLeader)
       // Get the list of group members from the database
let members = await usersData.getIDName(players);

// Separate the members into 3 distinct buckets based on their starting letters
// Separate the members into 3 distinct buckets based on character rules
// Separate the members based on what their username starts with
// Separate the members based on character rules
    // 1. MUST be all letters AND entirely uppercase (e.g., TEST, PRICETAG)
    const uppercaseMembers = members.filter(m => m.name && /^[A-Z]+$/.test(m.name));

    // 2. Contains numbers/digits anywhere or starts with a digit (e.g., 1firsttest)
    const numericMembers = members.filter(m => m.name && /[0-9]/.test(m.name));

    // 3. Anyone else who didn't fit the strict all-caps or numeric buckets (e.g., Alice, Wilkin Lai)
    const lowercaseMembers = members.filter(m => {
        return !uppercaseMembers.includes(m) && !numericMembers.includes(m);
    });

// Sort each bucket alphabetically so they look nice and organized
uppercaseMembers.sort((a, b) => a.name.localeCompare(b.name));
lowercaseMembers.sort((a, b) => a.name.localeCompare(b.name));
numericMembers.sort((a, b) => a.name.localeCompare(b.name));
        let games = await gamesData.getAllByGroup(groupId);
        games = games.map(game => ({_id: game._id, name: game.gameName}));
        let owner = null;
        if(groupObj.groupLeader !== null){
            owner = await usersData.getUser(groupObj.groupLeader);
        }
        let currentUser = req.session.user;
        let isMember = currentUser && groupObj.players.includes(currentUser._id);
        let isOwner = currentUser && owner._id == currentUser._id;

        groupObj.comments.forEach(async comment => {
            try{
                comment.sender = (await usersData.getIDName([comment.userId]))[0]
                if (req.session.user._id === comment.userId) {
                    comment.isSender = true;
                }
            }
            catch{
                comment.isSender = false;
            }
        });
        
        return res.render('group', {
        title: "Group: " + groupObj.groupName,
        group: groupObj,
        members: members,
        uppercaseMembers: uppercaseMembers,
        uppercaseTitle: groupObj.uppercaseTitle || "All Caps Members",
        lowercaseMembers: lowercaseMembers,
        lowercaseTitle: groupObj.lowercaseTitle || "Lowercase Members",
        numericMembers: numericMembers,
        numericTitle: groupObj.numericTitle || "Numbered Members",
        games: games,
        owner: owner,
        isMember: isMember,
        isOwner: isOwner
      });
    } catch (e) {
        return res.status(400).render('error', { title: 'Error', error: e });
    }
});

router.route('/:groupId/comments').post(async (req, res) => {
    try {
        let groupId = req.params.groupId;
        let comment = req.body.comment;
        let userId = req.session.user._id

        helpers.isValidId(groupId);
        helpers.isValidId(userId);
        helpers.stringHelper(comment, "Comment", 1, 1000);

        let groupRes = await groupsData.addComment(groupId, userId, comment);
        return res.redirect("/groups/" + groupId);
    } catch (e) {
        if (e === 'Could not update group successfully') return res.status(500).render('error', { error: e });
        return res.status(400).render('error', { title: 'Error', error: e });
    }
});

router.route('/:groupId/comments/delete').post(async (req, res) => {
    try{
        let groupId = req.params.groupId;
        let commentId = req.body.commentId;

        helpers.isValidId(groupId);
        helpers.isValidId(commentId);

        await groupsData.removeComment(groupId, commentId);
        return res.redirect('/groups/' + groupId);
    }
    catch (err) {
        return res.status(400).render('error', { title: 'Error', error: err })
    }
})

router
    .route('/edit/:groupId')
    .get(async (req, res) => {
        try {
            let groupId = req.params.groupId;

            helpers.isValidId(groupId);
            const groupObj = await groupsData.get(groupId);

            return res.render("editGroup", {title:"Edit group", groupObj});
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    })
    .post(async (req, res) => {
        try {
            let groupId = req.params.groupId;
            let currentUser = req.session.user;

            helpers.isValidId(groupId);
            let groupObj = await groupsData.get(groupId);


            if (!groupObj.players.includes(currentUser._id)) {
                throw 'You are not a member of this group';
            }
            else if (currentUser._id !== groupObj.groupLeader) {
                throw 'You are not the leader of this group';
            }
   
            await groupsData.update(groupId, req.body.groupName, req.body.groupDescription, currentUser._id);
            return res.redirect("/groups/" + groupId);
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/delete/:groupId')
    .post(async (req, res) => {
        try {
            let groupId = req.params.groupId;
            let currentUser = req.session.user;

            helpers.isValidId(groupId);
            let groupObj = await groupsData.get(groupId);

            if (!groupObj.players.includes(currentUser._id)) {
                throw 'You are not a member of this group';
            }
            else if (currentUser._id !== groupObj.groupLeader) {
                throw 'You are not the leader of this group';
            }

            await groupsData.remove(groupId);
            return res.redirect("/");
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router
    .route('/join/:groupId')
    .post(async (req, res) => {
        try {
            let groupId = req.params.groupId;
            let currentUser = req.session.user;

            helpers.isValidId(groupId);
            await groupsData.addUser(currentUser._id, groupId);

            return res.redirect("/groups/" + groupId);
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    })

router
    .route('/leave/:groupId')
    .post(async (req, res) => {
        try{
            let groupId = req.params.groupId;
            let currentUser = req.session.user;

            helpers.isValidId(groupId);

            await groupsData.leaveGroup(currentUser._id, groupId);
            return res.redirect("/groups/"+groupId);
        }
        catch(e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    })

export default router;
