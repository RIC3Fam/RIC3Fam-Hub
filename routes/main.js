import { Router } from 'express';

import { usersData, gamesData, groupsData, mediaData } from "../data/index.js";
import * as helpers from '../helpers.js';

const router = Router();

router
    .route("/")
    .get(async (req, res) => {
        try {
            const home = await mediaData.getHomePageConfig();
            return res.render("index", { title: "Home", home });
        } catch (e) {
            return res.status(400).render('error', { title: "Error", error: e });
        }
    });

router
    .route('/edit-home')
    .get(async (req, res) => {
        try {
            if (!req.session.user) return res.redirect('/login');
            const isAdmin = await usersData.isUserAdmin(req.session.user._id);
            if (!isAdmin) throw 'Admin only';
            const home = await mediaData.getHomePageConfig();
            return res.render('editHome', { title: 'Edit Home', home });
        } catch (e) {
            return res.status(403).render('error', { title: 'Error', error: e });
        }
    })
    .post(async (req, res) => {
        try {
            if (!req.session.user) return res.redirect('/login');
            const isAdmin = await usersData.isUserAdmin(req.session.user._id);
            if (!isAdmin) throw 'Admin only';

            await mediaData.updateHomePageConfig({
                buildingImageUrl: req.body.buildingImageUrl,
                billboardVideoUrl: req.body.billboardVideoUrl,
                artistsResidenceLinkUrl: req.body.artistsResidenceLinkUrl,
                lowerCcsnLinkUrl: req.body.lowerCcsnLinkUrl,
                lowerFrisbeeLinkUrl: req.body.lowerFrisbeeLinkUrl,
                billboard: {
                    top: req.body.billboardTop,
                    left: req.body.billboardLeft,
                    width: req.body.billboardWidth,
                    height: req.body.billboardHeight,
                },
                towel1: {
                    imageUrl: req.body.towel1ImageUrl,
                    linkUrl: req.body.towel1LinkUrl,
                    top: req.body.towel1Top,
                    left: req.body.towel1Left,
                    width: req.body.towel1Width,
                    height: req.body.towel1Height,
                },
                towel2: {
                    imageUrl: req.body.towel2ImageUrl,
                    linkUrl: req.body.towel2LinkUrl,
                    top: req.body.towel2Top,
                    left: req.body.towel2Left,
                    width: req.body.towel2Width,
                    height: req.body.towel2Height,
                },
                hotspots: req.body.hotspots,
            });
            return res.redirect('/');
        } catch (e) {
            return res.status(400).render('error', { title: 'Error', error: e });
        }
    });

router  
    .route("/login")
    .get(async (req, res) => {
        return res.render("login", {title: "Login"});
    })
    .post(async (req, res) => {
        try {

            let username = req.body["login-username"];
            let password = req.body["login-password"];

            //helpers.validatePassword(password);
            
            let userInfo = await usersData.loginUser(username, password);
            req.session.user = userInfo;

            return res.redirect("/");

        } catch (e) {
            return res.status(400).render('error', {title: "Error", error: e});
        }
    });

router  
    .route("/register")
    .get(async (req, res) => {
        return res.render("register", {title: "Create Profile"});
    })
    .post(async (req, res) => {
        try {

            let emailAddress = req.body.emailAddress;
            let name = req.body.name;
            let password = req.body.password;
            let username = req.body.username;

            helpers.isValidEmail(emailAddress.toLowerCase());
            helpers.validatePassword(password);
            helpers.stringHelper(username, "Username", 3, 20);
            helpers.stringHelper(name, "Name", 1, 50);

            let createUserRes = await usersData.createUser(username, emailAddress, password, null, null, name);

            return res.redirect("/login");

        } catch (e) {
            return res.status(400).render('error', {title: "Error", error: e});
        }
    });

router  
    .route("/logout")
    .get(async (req, res) => {
        try {
            req.session.user = null;
            // Overwrites currentUser bc middleware sets it to user and we don't want that
            return res.render("logout", {title: "Logged out", currentUser: null});
        } catch (e) {
            return res.status(400).render('error', {title: "Error", error: e});
        }
    });

router
    .route("/create-group")
    .get(async (req, res) => {
        try {
            let allGroupObjs = await groupsData.getAll();
            return res.render('createGroup', {title:"Create group", groups: allGroupObjs});
        } catch (e) {
            return res.status(400).render('error', {title: "Error", error: e});
        }
    })

router
    .route("/create-event")
    .get(async (req, res) => {
        try {
            if (!req.session.user) return res.redirect('/login');
            const isAdmin = await usersData.isUserAdmin(req.session.user._id);
            if (!isAdmin) throw 'Admin only';
            let userId = req.session.user._id;
            const allGroupsData = await groupsData.getAllGroupsbyUserID(userId);
            return res.render('createGame', {title:"Create Event", groups: allGroupsData, states: helpers.states});
        } catch (e) {
            return res.status(403).render('error', {title: "Error", error: e});
        }
    })

export default router;
