import { dbConnection, closeConnection } from './config/mongoConnection.js';
import { usersData, gamesData, groupsData, mediaData } from './data/index.js';

export async function seed() {
    const userData = [
        ['jdoe123', 'jdoe123@example.com', 'P@ssw0rd', "Hi, I'm John Doe. I love coding and coffee."],
        ['alex90', 'alex90@mail.com', 'Alex@123', "Hello, I'm Alex. I'm a fan of technology and music."],
        ['sam_5', 'sam_5@domain.com', '1aS$word', "Hey, I'm Sam. I enjoy outdoor activities and reading."],
        ['kellyC', 'kellyC@email.com', 'Ke11y#C7', "Hi, I'm Kelly. I'm passionate about design and travel."],
        ['brian8', 'brian8@web.com', 'Br1an$88', "Hello, I'm Brian. I love sports and cooking."],
        ['laraT2', 'laraT2@site.com', 'L@raT234', "Hey, I'm Lara. I enjoy painting and photography."],
        ['tommyJ', 'tommyJ@mail.net', 'T0mmyJ!11', "Hi, I'm Tommy. I'm a fan of movies and hiking."],
        ['ninaP3', 'ninaP3@example.org', 'NinaP#3!', "Hello, I'm Nina. I love dancing and writing."],
        ['dave01', 'dave01@internet.com', 'D@v2e0101', "Hey, I'm Dave. I enjoy gaming and gardening."],
        ['elleZ', 'elleZ@online.com', 'Elle23Z@12', "Hi, I'm Elle. I'm passionate about fashion and yoga."],
        ['ronM', 'ronM@mailservice.com', 'Ron3M#987', "Hello, I'm Ron. I love astronomy and cycling."],
        ['ivy45', 'ivy45@contact.com', 'Ivy$234567', "Hey, I'm Ivy. I enjoy pottery and swimming."],
        ['zoeQ', 'zoeQ@network.com', 'Z0eQ!23234', "Hi, I'm Zoe. I'm a fan of baking and drawing."],
        ['max22', 'max22@hub.com', 'Max@223211', "Hello, I'm Max. I love chess and photography."],
        ['liz9', 'liz9@connect.com', 'Liz239$876', "Hey, I'm Liz. I enjoy knitting and bird watching."],
        ['kateB', 'kateB@talk.com', 'KateB#01', "Hi, I'm Kate. I'm passionate about volunteering and running."],
        ['ian5', 'ian5@message.com', '1anF2ive!', "Hello, I'm Ian. I love soccer and playing guitar."],
        ['ginaL', 'ginaL@inbox.com', 'Gina23L#5!', "Hey, I'm Gina. I enjoy sculpting and singing."],
        ['seth3', 'seth3@post.com', 'Seth#2333', "Hi, I'm Seth. I'm a fan of magic tricks and rock climbing."],
        ['amyR', 'amyR@comms.com', 'AmyR@789', "Hello, I'm Amy. I love puzzles and playing piano."],
        ['user21', 'user21@email.com', 'Us21@er!', "Hey, I'm User21. I enjoy coding and coffee."],
        ['johnDoe', 'johnDoe@mail.net', 'John@123', "Hi, I'm John Doe. I'm a fan of technology and music."],
        ['annaB', 'annaB@web.com', 'AnnaB$4!', "Hello, I'm Anna. I enjoy outdoor activities and reading."],
        ['markZ4', 'markZ4@site.org', 'MarkZ@42', "Hi, I'm Mark. I'm passionate about design and travel."],
        ['lucyL', 'lucyL@domain.com', 'Lucy#123', "Hello, I'm Lucy. I love sports and cooking."],
        ['steveJobs', 'steveJobs@apple.com', 'SteveJ1!', "Hey, I'm Steve. I enjoy painting and photography."],
        ['billG', 'billG@microsoft.com', 'BillG@123', "Hi, I'm Bill. I'm a fan of movies and hiking."],
        ['elonM', 'elonM@tesla.com', 'ElonM$3!', "Hello, I'm Elon. I love dancing and writing."],
        ['jeffB', 'jeffB@amazon.com', 'JeffB42!', "Hey, I'm Jeff. I enjoy gaming and gardening."],
        ['timC', 'timC@apple.com', 'TimC@789', "Hi, I'm Tim. I'm passionate about fashion and yoga."],
        ['user31', 'user31@example.com', 'U3!serpw', "Hey, I'm User31. I enjoy coding and coffee."],
        ['chris12', 'chris12@mail.com', 'Ch12!ris', "Hi, I'm Chris. I'm a fan of technology and music."],
        ['sara7', 'sara7@web.com', 'S@ra7pwd', "Hello, I'm Sara. I enjoy outdoor activities and reading."],
        ['leoX', 'leoX@domain.net', 'X!eoL789', "Hi, I'm Leo. I'm passionate about design and travel."],
        ['mikeY', 'mikeY@site.org', 'MiY@ke00', "Hello, I'm Mike. I love sports and cooking."],
        ['luna21', 'luna21@internet.com', 'L21una!#', "Hey, I'm Luna. I enjoy painting and photography."],
        ['bobK', 'bobK@online.com', 'B0bK!234', "Hi, I'm Bob. I'm a fan of movies and hiking."],
        ['zoeS', 'zoeS@connect.com', 'Zoe@S123', "Hello, I'm Zoe. I love dancing and writing."],
        ['jayM', 'jayM@network.com', 'JayM!#45', "Hey, I'm Jay. I enjoy gaming and gardening."],
        ['lilyB', 'lilyB@mailservice.com', 'Lily@B12', "Hi, I'm Lily. I'm passionate about fashion and yoga."],
        ['tomH', 'tomH@contact.com', 'TomH#456', "Hello, I'm Tom. I love astronomy and cycling."],
        ['jackO', 'jackO@message.com', 'Ja@ckO12', "Hey, I'm Jack. I enjoy pottery and swimming."],
        ['emmaW', 'emmaW@inbox.com', 'Emm@W321', "Hi, I'm Emma. I'm a fan of baking and drawing."],
        ['noahC', 'noahC@post.com', 'No1ah!C4', "Hello, I'm Noah. I love chess and photography."],
        ['avaL', 'avaL@comms.com', 'Ava3L@789', "Hey, I'm Ava. I enjoy knitting and bird watching."],
        ['masonD', 'masonD@hub.com', 'Mas30n!D', "Hi, I'm Mason. I'm passionate about volunteering and running."],
        ['sophiaN', 'sophiaN@talk.com', 'S3oph!aN2', "Hello, I'm Sophia. I love soccer and playing guitar."],
        ['loganT', 'loganT@apple.com', 'Log3anT@1', "Hey, I'm Logan. I enjoy sculpting and singing."],
        ['ameliaR', 'ameliaR@site.com', 'Ame3li@R3', "Hi, I'm Amelia. I'm a fan of magic tricks and rock climbing."],
        ['oliverP', 'oliverP@domain.com', 'Ol3i@verP', "Hello, I'm Oliver. I love puzzles and playing piano."],
    ];

    console.log('Creating all users...');

    const userPromises = userData.map((user) => usersData.createUser(user[0], user[1], user[2], undefined, user[3], user[0]));
    await Promise.all(userPromises);

    const allUsers = await usersData.getAllUsers();

    console.log('Creating all groups...');
    const group1 = await groupsData.create('Frisbee Enthusiasts Group', 'A community for all Frisbee lovers', allUsers[0]._id);
    const group2 = await groupsData.create(
        'Ultimate Frisbee Competitors',
        'Focused on competitive ultimate Frisbee games and tournaments',
        allUsers[1]._id
    );
    const group3 = await groupsData.create('Frisbee Skills Workshop', 'Workshops and training sessions to improve Frisbee skills', allUsers[2]._id);
    const group4 = await groupsData.create('Youth Frisbee Club', 'Engaging youth in Frisbee activities and games', allUsers[3]._id);
    const group5 = await groupsData.create('Casual Frisbee Meetups', 'Casual and fun Frisbee meetups for all skill levels', allUsers[4]._id);

    console.log('Adding comments to group...');
    await groupsData.addComment(group1._id, allUsers[0]._id, 'This is a great group!');
    await groupsData.addComment(group2._id, allUsers[1]._id, 'I love this group!');
    await groupsData.addComment(group3._id, allUsers[2]._id, 'This group is awesome!');
    await groupsData.addComment(group4._id, allUsers[3]._id, "I'm so glad I joined this group!");
    await groupsData.addComment(group5._id, allUsers[4]._id, 'This group is so much fun!');

    console.log('Creating all games...');
    const game1 = await gamesData.create(
        'Sunset Frisbee Fun',
        'Relaxed Frisbee game at sunset',
        { streetAddress: '101 Beach Blvd', city: 'Santa Monica', state: 'CA', zip: '90401' },
        15,
        '2024-12-12',
        '17:00',
        '19:00',
        group1._id,
        allUsers[0]._id
    );
    const game2 = await gamesData.create(
        'Morning Frisbee in the Park',
        'Start your day with a fun Frisbee game',
        { streetAddress: '500 Park Ave', city: 'New York', state: 'NY', zip: '10001' },
        20,
        '2024-12-20',
        '08:00',
        '10:00',
        group1._id,
        allUsers[0]._id
    );

    const game3 = await gamesData.create(
        'Ultimate Frisbee Showdown',
        'Competitive ultimate Frisbee match',
        { streetAddress: '123 Sunshine Ave', city: 'Miami', state: 'FL', zip: '33101' },
        20,
        '2024-12-10',
        '10:00',
        '13:00',
        group2._id,
        allUsers[1]._id
    );
    const game4 = await gamesData.create(
        'Frisbee Champions League',
        'High-level ultimate Frisbee game',
        { streetAddress: '200 Sports Way', city: 'Chicago', state: 'IL', zip: '60601' },
        22,
        '2024-12-15',
        '15:00',
        '18:00',
        group2._id,
        allUsers[1]._id
    );

    const game5 = await gamesData.create(
        'Frisbee Skills Bootcamp',
        'Intensive skill-building session for serious players',
        { streetAddress: '750 Field Rd', city: 'Austin', state: 'TX', zip: '78701' },
        25,
        '2025-01-05',
        '09:00',
        '12:00',
        group3._id,
        allUsers[2]._id
    );
    const game6 = await gamesData.create(
        'Throw and Catch Workshop',
        'Learn advanced throwing and catching techniques',
        { streetAddress: '320 Green Park', city: 'Denver', state: 'CO', zip: '80014' },
        30,
        '2025-01-19',
        '14:00',
        '16:00',
        group3._id,
        allUsers[2]._id
    );

    const game7 = await gamesData.create(
        'Junior Frisbee Tournament',
        'Friendly tournament for young Frisbee enthusiasts',
        { streetAddress: '980 Youth Ave', city: 'San Francisco', state: 'CA', zip: '94102' },
        16,
        '2025-02-10',
        '10:00',
        '12:00',
        group4._id,
        allUsers[3]._id
    );
    const game8 = await gamesData.create(
        'Youth Frisbee Fun Day',
        'A day full of Frisbee games and activities for youngsters',
        { streetAddress: '400 Kids Park Rd', city: 'Portland', state: 'OR', zip: '97209' },
        18,
        '2025-02-24',
        '11:00',
        '14:00',
        group4._id,
        allUsers[3]._id
    );

    const game9 = await gamesData.create(
        'Beach Frisbee Gathering',
        'Casual Frisbee play on the beach',
        { streetAddress: '220 Ocean View Blvd', city: 'Los Angeles', state: 'CA', zip: '90012' },
        12,
        '2025-03-05',
        '15:00',
        '17:00',
        group5._id,
        allUsers[4]._id
    );
    const game10 = await gamesData.create(
        'Park Frisbee Meetup',
        'Relaxed Frisbee game at the city park',
        { streetAddress: '555 Central Park', city: 'New York', state: 'NY', zip: '10001' },
        15,
        '2025-03-18',
        '16:00',
        '18:00',
        group5._id,
        allUsers[4]._id
    );

    const allGroups = [group1, group2, group3, group4, group5];
    const allGames = [game1, game2, game3, game4, game5, game6, game7, game8, game9, game10];

    console.log('Adding users to groups, games, and friends...');
    for (let i = 5; i < userData.length; i++) {
        if (i % 5 === 0) {
            await groupsData.addUser(allUsers[i]._id, group1._id);
            await gamesData.addUser(allUsers[i]._id, game1._id);
            await gamesData.addUser(allUsers[i]._id, game2._id);
            await usersData.sendFriendRequest(allUsers[i]._id, allUsers[0]._id);
            await usersData.acceptFriendRequest(allUsers[0]._id, allUsers[i]._id);
        } else if (i % 5 === 1) {
            await groupsData.addUser(allUsers[i]._id, group2._id);
            await gamesData.addUser(allUsers[i]._id, game3._id);
            await gamesData.addUser(allUsers[i]._id, game4._id);
            await usersData.sendFriendRequest(allUsers[i]._id, allUsers[1]._id);
            await usersData.acceptFriendRequest(allUsers[1]._id, allUsers[i]._id);
        } else if (i % 5 === 2) {
            await groupsData.addUser(allUsers[i]._id, group3._id);
            await gamesData.addUser(allUsers[i]._id, game5._id);
            await gamesData.addUser(allUsers[i]._id, game6._id);
            await usersData.sendFriendRequest(allUsers[i]._id, allUsers[2]._id);
            await usersData.acceptFriendRequest(allUsers[2]._id, allUsers[i]._id);
        } else if (i % 5 === 3) {
            await groupsData.addUser(allUsers[i]._id, group4._id);
            await gamesData.addUser(allUsers[i]._id, game7._id);
            await gamesData.addUser(allUsers[i]._id, game8._id);
            await usersData.sendFriendRequest(allUsers[i]._id, allUsers[3]._id);
            await usersData.acceptFriendRequest(allUsers[3]._id, allUsers[i]._id);
        } else if (i % 5 === 4) {
            await groupsData.addUser(allUsers[i]._id, group5._id);
            await gamesData.addUser(allUsers[i]._id, game9._id);
            await gamesData.addUser(allUsers[i]._id, game10._id);
            await usersData.sendFriendRequest(allUsers[i]._id, allUsers[4]._id);
            await usersData.acceptFriendRequest(allUsers[4]._id, allUsers[i]._id);
        }
    }

    console.log('Creating all media...');
    await mediaData.createEventPageSlideshow();
    await mediaData.createHomePageConfig();

    console.log('Done inserting all data.');
}

const db = await dbConnection();
console.log('Connected');
await db.dropDatabase(); //Clears database before insert
console.log('Database cleared');
await seed();
console.log('Seed data entered');
await closeConnection();
console.log('finished');
