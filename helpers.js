import { ObjectId } from 'mongodb';
import xss from 'xss';

export let stringHelper = function (string, stringName, minLength, maxLength) {
    if (string == null) {
        throw stringName + ' was not provided!';
    }
    if (typeof string != 'string') {
        throw stringName + ' must be a string!';
    }
    string = string.trim();
    if (minLength != null && string.length < minLength) {
        throw 'The provided ' + stringName + " isn't long enough!";
    }
    if (maxLength != null && string.length > maxLength) {
        throw 'The provided ' + stringName + ' is too long!';
    }
    return xss(string);
};

export function validatePassword(password) {
    if (password.length < 8) {
        throw 'Password must be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(password)) {
        throw 'Password must contain at least one uppercase letter.';
    }
    if (!/[0-9]/.test(password)) {
        throw 'Password must contain at least one number.';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        throw 'Password must contain at least one special character.';
    }
}

export function validateGroup(groupName, groupDescription, groupLeader, coLeaders) { 
    if (groupName == null || groupDescription == null || groupLeader == null ) {
        throw 'All fields need to have valid values';
    }
    // ...
}

    if (typeof groupName !== 'string' || typeof groupDescription !== 'string') throw 'One or more string fields not given as string';

    groupName = groupName.trim();
    groupDescription = groupDescription.trim();

    if (groupName.length === 0 || groupDescription.length === 0) throw 'One or more string fields empty';

    if (groupName.length < 5) throw 'group name less than 5 chars';
    if (groupDescription.length == 0) throw 'group description is too short';
    isValidId(groupLeader);
}

export function validateLocation(gameLocation) {
    if (!gameLocation) throw 'No location given';
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

export function isValidZip(zip) {
    if (!zip) throw 'No zip code given';
    if (typeof zip !== 'string') throw 'Zip code is not a string';
    if (zip.length !== 5 || isNaN(zip)) throw 'Zip code is not valid';
}

export function isValidId(id) {
    if (!id) throw 'No id given';
    if (typeof id !== 'string') throw 'Id is not a string';
    if (!ObjectId.isValid(id.trim())) throw 'Id is not valid';
}

export function isValidName(name) {
    return /^[a-z' -]+$/.test(name);
}

let charIsLowercase = function (c) {
    return c >= 'a' && c <= 'z';
};
let charIsNumber = function (c) {
    return c >= '0' && c <= '9';
};
export let isValidEmail = function (email) {
    // Based on https://help.xmatters.com/ondemand/trial/valid_email_format.htm
    if (!email.includes('@')) return false;
    let s = email.split('@');
    if (s.length != 2) return false;
    let [prefix, domain] = s;
    if (!prefix.length || !domain.length) return false;

    for (let i = 0; i < prefix.length; i++) {
        if (charIsLowercase(prefix[i]) || charIsNumber(prefix[i])) {
            continue;
        } else if ('_.-'.includes(prefix[i])) {
            if (!i) return false;
            if (i == prefix.length - 1) return false;
            if ('_.-'.includes(prefix[i - 1])) return false;
            continue;
        } else {
            return false;
        }
    }

    let idx = -1;
    for (let i = domain.length - 1; i >= 0; i--) {
        if (domain[i] == '.') {
            idx = i;
            break;
        }
    }
    if (idx == -1 || idx == 0 || idx == domain.length - 1) return false;
    let tld = domain.substring(idx + 1);
    let site = domain.substring(0, idx - 1);
    for (let i = 0; i < site.length; i++) {
        if (!(charIsLowercase(site[i]) || charIsNumber(site[i]) || site[i] == '-')) {
            return false;
        }
    }
    if (tld.length < 2) return false;
    return true;
};

// Checks for valid number of days in given month
export function isValidDay(eventDate) {
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

export function compareDates(day1, day2) {
    if (!day1 || !day2) throw 'Error: Missing argument(s) to compareDates()';
    if (typeof day1 !== 'string' || typeof day2 !== 'string') throw 'Error: Argument(s) sent to compareDates not a string';

    // Get number array of [year, month, day]
    day1 = day1.split('-').map((day) => Number(day));
    day2 = day2.split('-').map((day) => Number(day));

    // Compare years
    if (day1[0] > day2[0]) return 1; // year 1 is after than year 2
    if (day1[0] === day2[0]) {
        // Compare months
        if (day1[1] > day2[1]) return 1; // month 1 is after than month 2
        if (day1[1] === day2[1]) {
            // Compare days
            if (day1[2] > day2[2]) return 1; // day 1 is after than day 2
        }
    }
    // day1 is less than day2
    return -1;
}

export function isDateInFuture(gameDate) {
    let currentDate = new Date();
    currentDate = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;

    return compareDates(currentDate, gameDate) === 1; // Date is in the future
}

export function isValidTime(time) {
    return /^(([01][0-9])|(2[0-3])):[0-5][0-9]$/.test(time);
    //return /^(([1-9])|(1[0-2])):[0-5][0-9] (AM|PM)$/.test(time);
}

export function compareTimes(time1, time2) {
    time1 = time1.split(':'); // Splits into [HR, MN]
    time1[0] = Number(time1[0]) * 60 + Number(time1[1]); // [Minutes]

    time2 = time2.split(':');
    time2[0] = Number(time2[0]) * 60 + Number(time2[1]);
    return time1[0] + 30 <= time2[0];
}

function isValid24(time) {
    var regex = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
    return regex.test(time);
}
export function convertTo12Hour(timeString) {
    //HTML uses 24 hours
    //Input validation
    if (!timeString) {
        throw 'Could not find string';
    }
    if (typeof timeString !== 'string') {
        throw 'Not of type string';
    }
    if (!isValid24(timeString)) {
        throw 'Not correct time string';
    }

    const [hours, minutes] = timeString.split(':').map(Number);
    if (hours === 0) {
        throw 'Invalid time';
    }
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const twelveHour = hours % 12 || 12;
    return `${twelveHour.toString()}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}
export function isValidDayBritainEdition(eventDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return 0;
    const date = eventDate.split('-');
    const month = Number(date[1]);
    const day = Number(date[2]);

    // Checks if number of days is valid for the month
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

export function convertToMMDDYYYY(dateString) {
    //HTML form uses different formating for the data so this used to convert back to ours
    //Input validation
    if (!dateString) {
        throw 'Could not find string';
    }
    if (typeof dateString !== 'string') {
        throw 'Not of type date';
    }
    if (!isValidDayBritainEdition(dateString)) {
        throw 'Not in correct format';
    }
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
}

export function isValidNum(string) {
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

export const states = [
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
