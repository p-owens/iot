const functions = require("firebase-functions");
const admin = require('firebase-admin')
admin.initializeApp();

const convert = require('xml-js');

// ESP Device ID (Currently set to Cian Mac's)
const deviceId = "esp32_E6E3CC";

// IoT Core parameters
const iot = require('@google-cloud/iot');
const iotClient = new iot.v1.DeviceManagerClient();
const iotRegion = 'europe-west1';
const iotRegistry = 'iot-registry';

// Store sensor data function: Responds to sensor data published to Google pub/sub topic
// Stores sensor readings retrieved from ESP-32
exports.storeSensorData = functions
    .region('europe-west2')
    .pubsub.topic('sensor-data').onPublish((message) => {
        let msg = message.json;
        msg.time = new Date();
        admin.firestore().collection('sensor-data').add(
            msg
        );
    });

// Irrigation decision function: Runs every day, retrieves Met Eireann data and executes Penman-Monteith Calculations
// Compares results to derive adequate level of irrigation
exports.irrigationDecision = functions
    .region('europe-west2')
	// Set schedule for every 15 minutes for test purposes, in reality this would be run once a day (Ideally at 9am)
    .pubsub.schedule('every 15 minutes').onRun((context) => { // .pubsub.schedule('every day').onRun((context) => {
		
		console.log("Running irrigation decision at ", Date.now());

		const BlanchLatitude = 53.3842;
		const BlanchLongitude = -6.3760;
		const soilArea = 0.372;			// 4 ft x 4 ft bed
		const pumpDischarge = 1.67;	    // 100 Litres per minute
		
		var rainCheck = false;
		var rainTime = Date.now();
		var pumpTime = 0;

		// Retrieve Met Eireann Data
		var http = require('http');
		var metData = '';

		console.log("Making HTTP Request to Met Eireann...")

		var now = new Date(Date.now());
		var tomorrow = new Date(Date.now() + (24 * 60 * 60 * 1000));

		var nowString = now.getFullYear().toString() + "-";
		nowString += (now.getMonth() + 1).toString() + "-";
		nowString += now.getDate().toString() + "T";
		nowString += now.getHours().toString() + ":00";

		var tomorrowString = tomorrow.getFullYear().toString() + "-";
		tomorrowString += (tomorrow.getMonth() + 1).toString() + "-";
		tomorrowString += tomorrow.getDate().toString() + "T";
		tomorrowString += tomorrow.getHours().toString() + ":00";

		var url = 'http://metwdb-openaccess.ichec.ie/metno-wdb2ts/locationforecast?lat=' + BlanchLatitude.toString() 
					+ ';long=' + BlanchLongitude.toString() + ';from=' + nowString + ';to=' + tomorrowString;

		console.log(url);

		function metEireannRequest() {
			return new Promise(function(resolve, reject) {
				http.get(url, 
				(resp) => {
					resp.on('data', (chunk) => {
						metData += chunk;
					});

					resp.on('end', function() {
						resolve('Success!');
					});
				});
			});
		}

		var metEireannPromise = metEireannRequest();

		metEireannPromise.then(() => {
			console.log("HTTP Request Received");

			// Parse data from HTTP request
			let json = JSON.parse(convert.xml2json(metData, {compact: true, spaces: 4})).weatherdata.product.time;

			// Retrieve forecasts only for next 24 hours
            json = json.filter((t) => {
                var tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                let d = new Date(t._attributes.to);
                return d < tomorrow;
            });

			// Data to be retrieved from forecasts
            var net_rad = 0;
            var totalPrecipitation = 0;
            var precipitationExpected = null;

            json.forEach((v, i, _) => {
                if (i % 2 == 0) {
                    net_rad += parseFloat(v.location.globalRadiation._attributes.value);
                } else if (i % 2 == 1) {
                    totalPrecipitation += parseFloat( v.location.precipitation._attributes.value );

                    if (totalPrecipitation >= 0.5) {
                        precipitationExpected = v._attributes.to;
                    }
                }
            });

			// Find average radiation reading
            net_rad /= json.length / 2;

			// Report Met Eireann recordings
            console.log({'averageRadiation': net_rad, 'totalPrecipitation': totalPrecipitation, 'precipitationExpected': precipitationExpected});

			// Set raintime to expected precipitation time
			if (precipitationExpected != null){
				rainTime = precipitationExpected;
			}

			// Get timestamp for 24 hours prior to function execution
			var yesterday = new Date(Date.now() - (24 * 60 * 60 * 1000));		
			// Construct query to get all sensor readings in past 24 hours
			var todays_readings =  admin.firestore().collection('sensor-data').where('time', '>=', yesterday);
			
			// Need to find average values for all sensor readings, and min and max values for temperature
			// Initial conditions for average, min, and max values
			var t_avg = 0;
			var t_min = 999;
			var t_max = 0;
			var ws = 0;
			var rh_avg = 0;
			var atmos_pres = 0;

			// Initial conditions for total values
			var t_tot = 0;
			var ws_tot = 0;
			var rh_tot = 0;
			var atmos_pres_tot = 0;

			console.log("Entering sensor data query...");	
			// Get result of sensor readings query
			todays_readings.get()
			.then((querySnapshot) => {
				console.log("Entered sensor data query!");	
				// Log the size returned by the query
				size = querySnapshot.size;
				console.log("Query size = ", size);

				// For each sensor reading in the past 24 hours
				querySnapshot.forEach((doc) => {
					// Update total values         
					t_tot = t_tot + doc.data().sensors.temperature;
					ws_tot = ws_tot + doc.data().sensors.ws;
					rh_tot = rh_tot + doc.data().sensors.humidity;
					atmos_pres_tot = atmos_pres_tot + doc.data().sensors.pressure;

					// Detect a new max temp
					if (t_max < doc.data().sensors.temperature) {
						t_max = doc.data().sensors.temperature;
					}

					// Detect a new min temp
					if (t_min > doc.data().sensors.temperature) {
						t_min = doc.data().sensors.temperature;
					}
				});

				if(size > 0){
					t_avg = t_tot / size;
					ws = ws_tot / size;
					rh_avg = rh_tot / size;
					atmos_pres = atmos_pres_tot / size;
				}
			
			// }).then(() => {
				console.log("Average Sensor Readings: t_avg = ", t_avg, " ws = ", ws, " rh_avg = ", rh_avg, "atmos_pres = ", atmos_pres);
						
				// Convert temperature readings to kelvin for penman-montieth calculations
				t_avg = t_avg + 273.15; 
				t_min = t_min + 273.15;
				t_max = t_max + 273.15;
				// The below calculations require the FAO library in JavaScript
				var svp = svp_from_t(t_avg);
				var svp_t_min = svp_from_t(t_min);
				var svp_t_max = svp_from_t(t_max);
				var avp = avp_from_rhmean(svp_t_min, svp_t_max, rh_avg);
				var delta_svp = delta_svp_from_t(t_avg);
				var psy_const = psy_const_from_pres(atmos_pres);
				
				// Calculate ETo
				console.log("FAO Vars: net_rad = ", net_rad, " t_avg = ", t_avg, " ws = ", ws, " svp = ", svp,
						 " avp = ", avp, " delta_svp = ", delta_svp, " psy_const = ", psy_const);
				faoTranspiration = fao56_penman_monteith(net_rad, t_avg, ws, svp, avp, delta_svp, psy_const);

				// console.log("Met Precipitation = ", totalPrecipitation, " ETo = ", faoTranspiration);		
				if (totalPrecipitation < faoTranspiration){
					console.log("Irrigation Required!");
					// If daily precipication does not meet transpiration requirements
					
					// Calculate water needed => Soil Area * Precipitation Deficit
					var waterNeeded = soilArea * (faoTranspiration - totalPrecipitation);
					// Calculate time in seconds to activate pump
					var pumpTime = waterNeeded / pumpDischarge;
					
					// Send pump time to ESP device
					// var irrigate_command = "irrigate:" + pumpTime.toString();
					var irrigate_command = {
						'command': 'irrigate',
						'arguments': {
							'pumpTime': pumpTime
						}
					};
					console.log("Sending command to ESP: '" + irrigate_command + "'");
					var request = generateRequest(deviceId, irrigate_command, false);
					iotClient.sendCommandToDevice(request);
					
					// We do not need to rainCheck in this scenario
					rainCheck = false;
				} else {
					// Daily precipitation meets requirements
					// Implement a verification strategy => Set flag to perform the rainCheck cloud function
					rainCheck = true;
					
					// Calculate water needed => Soil Area * Evapotranspiration
					var waterNeeded = soilArea * faoTranspiration;
					// Calculate time in seconds to activate pump
					var pumpTime = waterNeeded / pumpDischarge;					
				}
				
				// Log processed data to databases
				// Penman-Montieth transpiration calculation
				admin.firestore().collection('penman-monteith').add(
					{
						deviceID: 70,
						time: Date.now(),
						transpiration: faoTranspiration,
						tAvg: t_avg,
						tMin: t_min,
						tMax: t_max,
						ws: ws,
						svp: svp,
						avp: avp,
						deltaSvp: delta_svp,
						psyConst: psy_const,
						pumpTime: pumpTime
					});
				
				
				// Met Eireann Request Data
				admin.firestore().collection('met-eireann').add(
					{
						deviceID: 70,
						time: Date.now(),
						netRad: net_rad,
						precipitation: totalPrecipitation,
						rainTime: precipitationExpected
					});
				
				
				// Rain Check Database, referenced by rain check function
				var rainCheckTime = new Date(rainTime + 60*60*1000);
				admin.firestore().collection('rain-check').add(
					{
						deviceID: 70,
						time: Date.now(),
						enable: rainCheck,
						checkHour: rainCheckTime.getHours() // Check on next hour after it rains
					});
			});
		});
    });

// RainCheck function: This function runs every hour, and verifies that a weather reading for precipitation was accurate
// If a reading was inaccurate, the function triggers irrigation according to the last Penman-Monteith recording
exports.rainCheck = functions
	.region('europe-west2')
	.pubsub.schedule('0 * * * *').onRun((context) => {
		// Define queries for most recent entries into rain-check and penman-monteith databases
		var rainCheck_readings = admin.firestore().collection("rain-check").orderBy("time", "desc").limit(1);
		var penmanMonteith_readings = admin.firestore().collection("penman-monteith").orderBy("time", "desc").limit(1);			

		// Store most recent data in these variables
		var lastRainCheck, lastPenmanMonteith;
		// Get time of function exection
		var now = Date.now();

		console.log("Running rain check at ", now);

		// Execute first query; retrieving the most recent rain-check entry
		rainCheck_readings.get()
		.then((querySnapshot) => {
			lastRainCheck = querySnapshot.docs[0].data();
		})
		.then(() => {
			// If a rain-check is required and the current hour matches the hour to check for rain
			if (lastRainCheck.enable == 1 && lastRainCheck.checkHour == now.getHours()) {	
				console.log("Rain check has been enabled for ", now.getHours());
				// Retrieve all sensor readings since rain-check reading was taken
				var todays_readings = admin.firestore().collection("sensor-data").where("time", ">=", lastRainCheck.time).orderBy("time", "asc");

				// Initially assume it has not rained
				var hasRained = false;

				// Check all sensor readings for a rain sensor signal, indicating that it rained at some point
				todays_readings.get()
				.then((querySnapshot) => {
					querySnapshot.forEach((doc) => {
						if (doc.data().sensors.rain == 1) {
							hasRained = true;
						}
					});
				})
				.then(() => {
					// If after checking all readings there is no indication of rain assume no rain occured
					if (hasRained == false) {						
						console.log("It has not rained despite forecast");

						// Intervention necessary, trigger irrigation system
						// Retrieve most recent Penman-Monteith calculation		
						penmanMonteith_readings.get().then((querySnapshot) => {
							lastPenmanMonteith = querySnapshot.docs[0].data();
						})
						.then(() => {	
							// Trigger pump according to most recent penman-monteith
							var irrigate_command = "irrigate:" + pumpTime.toString();
							console.log("Sending command to ESP: '" + irrigate_command + "'");
							var request = generateRequest(deviceId, irrigate_command, false);
							iotClient.sendCommandToDevice(request);
						});
					}
				});	
			}
		});					
	});
	
// SensorHealth function: This function runs every day, and verifies that there are no anomalous readings
// If a reading is anomalous, a warning is logged to the console
exports.sensorHealth = functions
	.region('europe-west2')
    .pubsub.schedule('0 12 * * *').onRun((context) => {
		var yesterday = new Date(Date.now() - (24 * 60 * 60 * 1000));
		
		// Get all sensor data readings in the past 24 hours (Note: Query is ordered latest->oldest)
		var todays_readings = admin.firestore().collection("sensor-data").where("time", ">=", yesterday).orderBy("time", "desc");
		
        console.log("Running sensor health at ", Date.now());

		// For each reading in the past 24 hours
		todays_readings.get().then((querySnapshot) => {
            // Track number of anomalies spotted
            var numAnomalies = 0;

			querySnapshot.forEach((doc) => {
                // If the temperature is outside expected values (-20C to 40C)
                if(doc.sensors.temperature < -20 || doc.sensors.temperature > 40) {
                    numAnomalies = numAnomalies + 1;
                    // Unusual temperature sensor data
					console.log("Anomaly in temperature sensor at ", doc.sensors.time, ". Temp = ", doc.sensors.temperature);
                }

                // If the humidity is outside expected values (0% to 100%)
                if(doc.sensors.humidity < 0 || doc.sensors.humidity > 100) {
                    numAnomalies = numAnomalies + 1;
                    // Unusual humidity sensor data
					console.log("Anomaly in humidity sensor at ", doc.sensors.time, ". Humidity = ", doc.sensors.humidity);
                }

                // If the pressure is outside expected values (92.7 kPa to 105.2 kPa)
                if(doc.sensors.pressure < 92.7  || doc.sensors.pressure > 105.2) {
                    // Unusual pressure sensor data
					console.log("Anomaly in pressure sensor at ", doc.sensors.time, ". Pressure = ", doc.sensors.pressure);
                }

                // If the wind speed is outside expected values (0 ms^-1 to 53.05 ms^-1)
                if(doc.sensors.ws < 0  || doc.sensors.ws > 53.05) {
                    numAnomalies = numAnomalies + 1;
                    // Unusual wind speed sensor data
					console.log("Anomaly in wind speed sensor at ", doc.sensors.time, ". Wind Speed = ", doc.sensors.ws);
                }

                // If the radiation is outside expected values (0 W/m^2 to 1000 W/m^2)
                if(doc.sensors.radiation < 0  || doc.sensors.radiation > 1000) {
                    numAnomalies = numAnomalies + 1;
                    // Unusual radiation sensor data
					console.log("Anomaly in radiation sensor at ", doc.sensors.time, ". Radiation = ", doc.sensors.radiation);
                }
			})

            console.log("Found ", numAnomalies, " anomalies");
		});
	});

// Penman-Monteith Calculation Functions ... Adapted from PyETo! URL: https://pyeto.readthedocs.io/
function svp_from_t(t){
	return 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
}	

function avp_from_rhmean(svp_tmin, svp_tmax, rh_mean){
	return (rh_mean / 100.0) * ((svp_tmax + svp_tmin) / 2.0);
}

function delta_svp_from_t(t){
	var tmp = 4098 * (0.6108 * Math.exp((17.27 * t) / (t + 237.3)));
	return tmp / Math.pow((t + 237.3), 2);
}

function psy_const_from_pres(atmos_pres) {
	return 0.000665 * atmos_pres;
}

function fao56_penman_monteith(net_rad, t, ws, svp, avp, delta_svp, psy){
	var a1 = (0.408 * (net_rad) * delta_svp / (delta_svp + (psy * (1 + 0.34 * ws))));
    var a2 = (900 * ws / t * (svp - avp) * psy / (delta_svp + (psy * (1 + 0.34 * ws))));
    return a1 + a2;
}

// Generate Request Function: For sending commmands to ESP32
function generateRequest(deviceId, configData, isBinary) {
    const formattedName = iotClient.devicePath(process.env.GCLOUD_PROJECT, iotRegion, iotRegistry, deviceId);
    let dataValue;
    if (isBinary) {
        const encoded = cbor.encode(configData);
        dataValue = encoded.toString("base64");
    } else {
        dataValue = Buffer.from(JSON.stringify(configData)).toString("base64");
    }
    return {
        name: formattedName,
        binaryData: dataValue
    };
}
