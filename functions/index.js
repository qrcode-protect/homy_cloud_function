const functions = require("firebase-functions");
const admin = require('firebase-admin');
const moment = require('moment-timezone');
const { ref } = require("firebase-functions/v1/database");


admin.initializeApp();

exports.openEtablissement = functions.pubsub.schedule('00,15,30,45 * * * *').onRun(async (context) => {
    try {
        const currentDate = moment.tz(new Date(), 'Europe/Paris');
        const db = admin.firestore();
        const writeBatch = db.batch();
        await db.collection('list_restaurant').get().then( async (queryRestaurant) => {
            for (let i = 0; i < queryRestaurant.docs.length; i++) {
                const restaurantData = queryRestaurant.docs[i].data();
                const restaurantRef = queryRestaurant.docs[i].ref; 
                if ((restaurantData.openingTime != null) && (restaurantData.openingTime != undefined) && (restaurantData.openingTime != '')) {
                    const openingTime = moment(Date.parse(restaurantData.openingTime)).tz('Europe/Paris', true);
                    console.log(`Current date : ${currentDate}`);
                    console.log(`Opening date : ${openingTime}`);
                    console.log(`Current date après opening date ? ${currentDate.isAfter(openingTime)}`)
                    if (currentDate.isAfter(openingTime)) {
                        console.log(`write batch update ${restaurantData.nom}`);
                        writeBatch.update(restaurantRef, {'enLigne': true, 'openingTime': null});
                    }
                }
            } 
        })
        await writeBatch.commit();      
    } catch (error) {
        throw new functions.https.HttpsError('error', error);
    }
    

})