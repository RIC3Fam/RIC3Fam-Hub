let createGameForm = document.getElementById('create-game-form');
let gameSubmitButton = document.getElementById('game-submit-button');

if (createGameForm) {
    let errorLabel = document.getElementById('error-label');
    let messageLabel = document.getElementById('message-label');
    errorLabel.hidden = true;
    createGameForm.addEventListener('submit', (event) => {
        //console.log('Form submission triggered');
        event.preventDefault();
        try {
            let gameName = document.getElementById('game-name');
            let state = document.getElementById('state');
            let zip = document.getElementById('zip');
            let streetAddress = document.getElementById('street-address');
            let city = document.getElementById('city');
            let description = document.getElementById('description');
            let date = document.getElementById('date');
            let startTime = document.getElementById('start-time');
            let endTime = document.getElementById('end-time');
            let maxPlayers = document.getElementById('max-players');
            let groupname = document.getElementById('group');
            if (groupname.value === 'NA') throw 'Must be a part of a group to create a game';
            let location = {
                streetAddress: streetAddress.value,
                city: city.value,
                state: state.value,
                zip: zip.value,
            };
            let link = document.getElementById('link');
            let linkdesc = document.getElementById('linkdesc');

            isValidNum(maxPlayers.value);
            let maxPlayersNumber = parseInt(maxPlayers.value, 10);
            validateGame(gameName.value, description.value, location, maxPlayersNumber, date.value, startTime.value, endTime.value, link.value, linkdesc.value);
            messageLabel.innerHTML = 'Event Created';
            messageLabel.hidden = false;

            createGameForm.submit();
            gameSubmitButton.disabled = true;
        } catch (err) {
            errorLabel.innerHTML = err;
            errorLabel.hidden = false;
        }
    });
}
function validateGame(gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, link, linkdesc) {
    // Input Validation

    if (!gameName) throw 'Event name is required';
    if (!gameDescription) throw 'Event description is required';
    if (!gameLocation || !gameLocation.streetAddress || !gameLocation.city || !gameLocation.state || !gameLocation.zip)
        throw 'Complete game location information is required';
    if (!maxCapacity) throw 'Max capacity is required';
    if (!gameDate) throw 'Event date is required';
    if (!startTime) throw 'Start time is required';
    if (!endTime) throw 'End time is required';
    if (link && !linkdesc) throw 'Link Description is required if link is included';

    if (
        typeof gameName !== 'string' ||
        typeof gameDescription !== 'string' ||
        typeof gameDate !== 'string' ||
        typeof startTime !== 'string' ||
        typeof endTime !== 'string'
    )
        throw 'One or more string fields not given as string';

    gameName = gameName.trim();
    gameDescription = gameDescription.trim();
    gameDate = gameDate.trim();
    startTime = startTime.trim();
    endTime = endTime.trim();
    //console.log(gameDate, startTime, endTime);
    //startTime = convertTo12Hour(startTime);
    //endTime = convertTo12Hour(endTime);
    //console.log(gameDate, startTime, endTime);
    if (gameName.length === 0 || gameDescription.length === 0 || gameDate.length === 0 || startTime.length === 0 || endTime.length === 0)
        throw 'One or more string fields empty';

    if (gameName.length < 5) throw 'Event name less than 5 chars';
    if (!isValidDay(gameDate)) throw 'Event Date is not valid';
    if (!isValidTime(startTime) || !isValidTime(endTime)) throw 'Start and/or end time is not valid';
    if (!compareTimes(startTime, endTime)) throw 'Start time has to be 30min before end time';

    if (typeof maxCapacity !== 'number') throw 'Max cap. and/or price not a number';
    if (maxCapacity <= 0) throw 'Max cap. should be > 0';
    if (maxCapacity.toString().split('.')[1]) throw 'Max cap. not a whole number';
    if (typeof gameLocation !== 'object') throw 'Event location is not an object';
    if (!gameLocation.streetAddress || !gameLocation.city || !gameLocation.state || !gameLocation.zip) throw 'Event location missing key(s)';
    if (
        typeof gameLocation.streetAddress !== 'string' ||
        typeof gameLocation.city !== 'string' ||
        typeof gameLocation.state !== 'string' ||
        typeof gameLocation.zip !== 'string'
    )
        throw 'Event location values not string';
    for (const key in gameLocation) gameLocation[key] = gameLocation[key].trim();
    if (gameLocation.streetAddress.length < 3) throw "Event location's street address too short";
    if (gameLocation.city.length < 3) throw "Event location's city name too short";
    gameLocation.state = gameLocation.state.toUpperCase();
    if (!states.includes(gameLocation.state)) throw 'State is not valid';
    if (gameLocation.zip.length !== 5 || isNaN(gameLocation.zip)) throw 'Zip code is not valid';
}
function compareDates(day1, day2) {
    if (!day1 || !day2) throw 'Error: Missing argument(s) to compareDates()';
    if (typeof day1 !== 'string' || typeof day2 !== 'string') throw 'Error: Argument(s) sent to compareDates not a string';

    // Get number array of [month, day, year]
    day1 = day1.split('/').map((day) => Number(day));
    day2 = day2.split('/').map((day) => Number(day));

    // Compare years
    if (day1[2] > day2[2]) return 1;
    if (day1[2] === day2[2]) {
        // Compare months
        if (day1[0] > day2[0]) return 1;
        if (day1[0] === day2[0]) {
            // Compare days
            if (day1[1] >= day2[1]) return 1;
        }
    }
    // day1 is less than day2
    return -1;
}

function isDateInFuture(gameDate) {
    let currentDate = new Date();
    currentDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}/${currentDate.getFullYear()}`;

    return compareDates(currentDate, gameDate) === 1;
}

function compareTimes(time1, time2) {
    time1 = time1.split(':'); // Splits into [HR, MN(AM|PM)]
    time1.push(time1[1].substr(-2, 2)); // [HR, MN(AM|PM), (AM|PM)]
    time1[1] = time1[1].substr(0, 2); // [HR, MN, (AM|PM)]

    if (time1[0] === '12') {
        time1[0] = time1[2] === 'AM' ? '0' : '12';
    } else if (time1[2] === 'PM') {
        time1[0] = (Number(time1[0]) + 12).toString();
    }
    time1[0] = Number(time1[0]) * 60 + Number(time1[1]); // [Minutes, __, (AM|PM)]

    time2 = time2.split(':');
    time2.push(time2[1].substr(-2, 2));
    time2[1] = time2[1].substr(0, 2);
    if (time2[0] === '12') {
        time2[0] = time2[2] === 'AM' ? '0' : '12';
    } else if (time2[2] === 'PM') {
        time2[0] = (Number(time2[0]) + 12).toString();
    }
    time2[0] = Number(time2[0]) * 60 + Number(time2[1]);
    return time1[0] + 30 <= time2[0];
}

function isValidDay(eventDate) {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(eventDate)) return 0;
    const [year, month, day] = eventDate.split('-').map(Number);
    switch (month) {
        case 1:
            return day <= 31;
        case 2:
            return day <= 28;
        case 3:
            return day <= 31;
        case 4:
            return day <= 30;
        case 5:
            return day <= 31;
        case 6:
            return day <= 30;
        case 7:
            return day <= 31;
        case 8:
            return day <= 31;
        case 9:
            return day <= 30;
        case 10:
            return day <= 31;
        case 11:
            return day <= 30;
        case 12:
            return day <= 31;
        default:
            return false;
    }
}

function isValidTime(time) {
    return /^(([01][0-9])|(2[0-3])):[0-5][0-9]$/.test(time);
    //return /^(([1-9])|(1[0-2])):[0-5][0-9] (AM|PM)$/.test(time);
}

function convertTo12Hour(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    if (hours === 0) {
        throw 'Hours cannot be 0';
    }
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const twelveHour = hours % 12 || 12;
    return `${twelveHour.toString()}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function editGame() {}

function isValidNum(string) {
    if (!string) {
        throw 'String expected';
    }
    if (typeof string !== 'string') {
        throw 'String expected';
    }
    const number = Number(string);
    if (isNaN(number)) {
        throw 'Max cap is not a number';
    }
}

const states = [
    'AK',
    'AL',
    'AR',
    'AZ',
    'CA',
    'CO',
    'CT',
    'DC',
    'DE',
    'FL',
    'GA',
    'HI',
    'IA',
    'ID',
    'IL',
    'IN',
    'KS',
    'KY',
    'LA',
    'MA',
    'MD',
    'ME',
    'MI',
    'MN',
    'MO',
    'MS',
    'MT',
    'NC',
    'ND',
    'NE',
    'NH',
    'NJ',
    'NM',
    'NV',
    'NY',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VA',
    'VT',
    'WA',
    'WI',
    'WV',
    'WY',
];
