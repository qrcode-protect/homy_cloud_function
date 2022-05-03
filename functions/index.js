const functions = require("firebase-functions");
const admin = require('firebase-admin');
const moment = require('moment-timezone');


admin.initializeApp();

exports.openEtablissement = functions.pubsub.schedule('00,15,30,45 * * * *').onRun(async (context) => {
    const momentDate = moment.tz(new Date(), 'Europe/Paris');
    const db = admin.firestore();
    await db.collection('list_restaurant').get().then( async (queryRestaurant) => {
        for (let i = 0; i < queryRestaurant.docs.length; i++) {
            const restaurantData = queryRestaurant.docs[i].data();
            console.log(momentDate);
            console.log(Date.parse(restaurantData.openingTime).toLocaleString('fr'));
        }
    })

})