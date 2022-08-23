const functions = require("firebase-functions");
const admin = require('firebase-admin');
const moment = require('moment-timezone');
const { firestore } = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

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

exports.checkPhoneNumber = functions.https.onCall(async (data, context) => {
    const phone = data.phone;
    let user;
    try {
        user = await admin.auth().getUserByPhoneNumber(phone);
    } catch (error) {
        if (error.code == 'auth/user-not-found') {
            user = null;
        } else {
            throw error;
        }
    }

    if (!user) {
        return false;
    } else {
        return true;
    }
})  

exports.onCommandeUpdated = functions.firestore.document('commandes_restauration/{commandeId}').onWrite( async (change, context) => {
    const commandeData = change.after.data();
    const commandeDataBefore = change.before.data();
    let payloadList = [];

    if (commandeData != undefined) {
        const vendeurToken = await firestore().collection('utilisateurs').where('idRestaurant', '==', commandeData.restaurant.id).get().then((snpshot) => {
            if (snpshot.docs.length > 0) {
                return snpshot.docs[0].data().token;
            }
        })
        if (vendeurToken != null) {
            if (commandeDataBefore == undefined && commandeData != undefined) {
                payloadList.push({
                    token: vendeurToken,
                    notification: {
                        title: 'Nouvelle commande !',
                        body: 'Vous avez recu une nouvelle commande.',
                    },
                });
            }
        }

        if (!commandeDataBefore.restaurantStatus.encours && commandeData.restaurantStatus.encours) {
            payloadList.push({
                token: commandeData.client.token,
                notification: {
                    title: 'Commande acceptée',
                    body: 'Le vendeur à accepté votre commande.',
                }
            });
        }

        if (!commandeDataBefore.restaurantStatus.annule && commandeData.restaurantStatus.annule) {
            if (!commandeData.clientAnnule) {
                payloadList.push({
                    token: commandeData.client.token,
                    notification: {
                        title: 'Commande refusée',
                        body: 'Le vendeur à refusé votre commande.',
                    }
                });
            }
        }

        if (!commandeDataBefore.restaurantStatus.termine && commandeData.restaurantStatus.termine) {
            let body;
            if (commandeData.livraison) {
                body = 'La commande est terminée, elle vous sera livrée dès que possible.'
            } else {
                body = 'La commande est terminée, vous pouvez aller la récuperer.'
            }
            payloadList.push({
                token: commandeData.client.token,
                notification: {
                    title: 'Commande terminée',
                    body: body,
                }
            });
        }

        if (!commandeDataBefore.livre && commandeData.livre) {
            payloadList.push({
                token: commandeData.client.token,
                notification: {
                    title: 'Commande livrée',
                    body: 'La commande vous à été livrée, n\'oubliez pas de la valider et de la noter dans le récapitulatif de la commande.',
                }
            });
        }
    }


    for (let index = 0; index < payloadList.length; index++) {
        const payload = payloadList[index];
        await admin.messaging().send(payload).then((result)=>{
            console.log(result);
        }).catch((error) => {
            console.log(error);
        });
    }

})