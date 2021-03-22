// SENSOR HEALTH FUNCTION - RUNS DAILY
// This function checks that the measurement station is correctly updating every half hour
// If the measurement station is not responding, further investigation is required

const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();

exports.rainCheck = functions
	.region('europe-west2')
	.pubsub.topic('sensor-health').onPublish(message) => {
		var now = Date.now();
		// Adjust timestamp by 24 hours
		var yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
		
		// Get all sensor data readings in the past 24 hours (Note: Query is ordered latest->oldest)
		var todays_readings = admin.firestore().collection('sensor-data').where{'time', '>=', yesterday}.orderBy('time', Query.Direction.DESCENDING);
		
		// Tale initial lastReading time as current time
		var lastReading = now;
		
		// For each reading in the past 24 hours
		todays_readings.get().then((querySnapshot) => {
			querySnapshot.forEach((doc) => {
				// If the time between readings is greater than 45 mins
				if(lastReading - doc.time > (45 * 60 * 1000)) {
					// The sensor did not respond and has possibly been tampered with
					console.log("Sensor failure after between ", doc.time, " and ", lastReading);
					break;
				}
				
				// Update lastReading for next iteration of for loop
				lastReading = doc.time;
			});
		}		
	}
