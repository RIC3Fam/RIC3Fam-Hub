import { Router } from 'express';
import { groupsData, gamesData, usersData } from '../data/index.js';
import * as helpers from '../helpers.js';

const router = Router();

router
    .route('/')
    .get(async (req, res) => {

        let term = req.query.term;
        if (term == null) {
            return res.render("search", {title: "Search"});
        }
        helpers.stringHelper(term, 'Search term');
        term = term.trim();

        const viewer = req.session.user;
        let usersList, groupsList, gamesList;

        try {
            if (term == "") {
                usersList = await usersData.getAllUsers();
                usersList = usersList.filter((u) => helpers.viewerCanAccessUser(viewer, u));
            } else {
                usersList = await usersData.searchUsers(term, viewer);
            }
        } catch (e) {
            usersList = [];
        }
        try {
            if (term == "") {
                groupsList = await groupsData.getAll(viewer?._id);
            } else {
                groupsList = await groupsData.searchGroups(term, viewer?._id);
            }
        } catch (e) {
            groupsList = [];
        }
        try {
            if (term == "") {
                gamesList = await gamesData.getAll(false, viewer?._id);
            } else {
                gamesList = await gamesData.searchGames(term, viewer?._id);
            }
        } catch (e) {
            gamesList = [];
        }

        let data = {users: usersList, groups: groupsList, games: gamesList};

        return res.json(data);
    });

export default router;
