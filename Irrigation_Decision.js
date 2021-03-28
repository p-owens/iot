const functions = require("firebase-functions");

const admin = require('firebase-admin')
admin.initializeApp();

// Reworked irrigation decision
// I think instead of having irrigationDecision, get_met, and penman-monteith we should have just 1 cloud function
// This would mean rewriting the fao library and the get_met function into javascript
// But from what I've been googling, you should try to avoid calling cloud functions from other cloud functions ... So this might be better

exports.irrigationDecision = functions
    .region('europe-west2')
	// Set schedule for every 15 minutes for test purposes, in reality this would be run once a day (Ideally at 9am)
    .pubsub.schedule('every 15 minutes').onRun((context) => { // .pubsub.schedule('every day').onRun((context) => {
		
		const BlanchLatitude = 53.3842;
		const BlanchLongitude = -6.3760;
		const soilArea = 1;			// Estimated value
		const pumpDischarge = 1;	// Estimated value
		
		var rainCheck = false;
		var rainTime = Date.now();
		var pumpTime = 0;
		
		// Call the get_data function from weather.py - Need to convert to JavaScript
		var metEireannData = weather.get_data(BlanchLatitude, BlanchLongitude); // Passed Latitude & Longitude of Blanchardstown, Dublin
		
		// If rain is expected set rainTime accordingly
		if (metEireannData["precip_time"] != -1) {
			rainTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), metEireannData["precip_time"], 0, 0, 0);
		}		
		
		// calcAvgReadings needs to be written
		// It will return a struct with the variables called below
		// This struct will primarily be avgs from the past 24 hours, but also include min and max temps
		var penmanMonteithReadings = calcAvgReadings(); // Parse last 24 hours of sensor data for relevant penman-monteith data
		
		// Store penman-monteith parameters in variables
		var net_rad = penmanMonteithReadings.net_rad;
		var t_avg = penmanMonteithReadings.t_avg + 273.15; // Convert temperature readings to kelvin for calculations
		var t_min = penmanMonteithReadings.t_min + 273.15;
		var t_max = penmanMonteithReadings.t_max + 273.15;
		var ws = penmanMonteithReadings.ws;
		var svp = fao.svp_from_t(t_avg);
		var svp_t_min = fao.svp_from_t(t_min)
		var svp_t_max = fao.svp_from_t(t_max)
		var avp = fao.avp_from_rhmean(svp_t_min, svp_t_max, penmanMonteithReadings.rh_avg);
		var delta_svp = fao.delta_svp(t_avg);
		var psy_const = fao.psy_const(penmanMonteithReadings.atmos_pres);
		
		// Calculate ETo - Need to convert to JavaScript
		faoTranspiration = fao.fao56_penman_monteith(net_rad, t_avg, ws, svp, avp, psy_const);
				
		if (metEireannData["precip"] < faoTranspiration){
			// If daily precipication does not meet transpiration requirements
			
			// Calculate water needed => Soil Area * Precipitation Deficit
			var waterNeeded = soilArea * (faoTranspiration - metPrecipitation);
			// Calculate time in seconds to activate pump
			var pumpTime = waterNeeded / pumpDischarge;
			
			// *** SEND PUMP TIME TO ESP32 HERE ***
			
			// We do not need to rainCheck in this scenario
			rainCheck = false;
		} else {
			// Daily precipitation meets requirements
			// Implement a verification strategy => Set flag to perform the rainCheck cloud function
			
			// Calculate water needed => Soil Area * Evapotranspiration
			var waterNeeded = soilArea * faoTranspiration;
			// Calculate time in seconds to activate pump
			var pumpTime = waterNeeded / pumpDischarge;
			
			rainCheck = true;
		}
		
		// Log processed data to databases
		// Penman-Montieth transpiration calculation
		admin.firestore().collection('penman-monteith').add(
            {
                deviceID: 69,
                time: Date.now(),
                transpiration: faoTranspiration,
				netRad: net_rad,
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
                deviceID: 69,
                time: Date.now(),
                precipitation: metEireannData["precip"],
				rainTime: metEireannData["precip_time"]
            });
		
		// Rain Check Database, referenced by rain check function
		admin.firestore().collection('rain-check').add(
            {
                deviceID: 69,
                time: Date.now(),
				enable: rainCheck,
				checkHour: (rainTime + 60*60*1000).getHours() // Check on next hour after it rains
            });
    });