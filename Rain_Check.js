// RAIN CHECK FUNCTION - RUNS HOURLY
// CHECKS IF RAIN CHECK FLAG HAS BEEN SET, IF SO CHECK IF CURRENT HOUR MATCHES (RAIN HOUR + 1)
// IN THIS CASE WE KNOW THERE SHOULD HAVE BEEN SOME RAIN
// THEN CHECK LAST RECEIVED MOISTURE READING AND MORNING MOISTURE READING
// IF MOISTURE HAS NOT INCREASED, INTERVENE AND WATER THE SOIL

/* STORE SENSOR DATA SAMPLE CODE
const functions = require("firebase-functions");

const admin = require('firebase-admin');
admin.initializeApp();

exports.storeSensorData = functions
	.region('europe-west2')
	.pubsub.topic('sensor-data').onPublish((message) => {
		admin.firestore().collection('sensor-data').add({message: message.json});
	});
*/

const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();

exports.rainCheck = functions
	.region('europe-west2')
	.pubsub.topic('rain_check').onPublish(message) => {
		var now = Date.now();
		var morning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
		
		var morning_readings = admin.firestore().collection('sensor-data').where{'time', '>=', morning}.orderBy('time').limit(1);
		var current_readings = admin.firestore().collection('sensor-data').orderBy('time', Query.Direction.DESCENDING).limit(1);
		
		var rainCheck_readings = admin.firestore().collection('rain-check').orderBy('time', Query.Direction.DESCENDING).limit(1);
		var penmanMonteith_readings = admin.firestore().collection('penman-monteith').orderBy('time', Query.Direction.DESCENDING).limit(1);
		
		if (rainCheck_readings.enable == 1 && rainCheck_readings.checkHour == now.getHours) {
			if (current_readings.moisture < morning_readings.moisture) {
				// WRITE MQTT TO IRRIGATE ACCORDING TO LAST PENMAN-MONTEITH CALCULATION
			}
		}		
	}
