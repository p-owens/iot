// ROUGH PSEUDOCODE FOR IRRIGATION DECISION
// NOTE THAT WE SHOULD INCLUDE A LOG FUNCTIONALITY
// THIS LOG WILL RECORD THE SENSOR DATA WE GET AND THE DECISIONS WE MAKE WITH TIMESTAMPS

// ASSUME IRRIGATION DECISION IS CALLED EVERY MORNING
function irrigation_decision{
	// SURFACE AREA OF SOIL SAMPLE, TO BE CONFIRMED
	const double soil_area = 0.5;
	// WATER PUMP DISCHARGE (litres per second), TO BE CONFIRMED
	const double pump_discharge = 1;

	// RETRIEVE DAILY MET EIREANN FORECAST
	var GetMetJSON = GetMet();

	// MET EIREANN (kPa)
	var met_atmos_pres = GetMetJSON.pressure;
	// MET EIREANN PRECIPITATION (mm per day)
	var met_precipitation = GetMetJSON.precipitation;

	// UNLESS SPECIFIED OTHERWISE, "SensorData()" RETURNS THE DAILY AVERAGE OF A READING
	var SensorDataJSON = SensorData();
	
	// TEMPERATURE VALUES (Kelvin), NEED DAILY MIN, MAX, AND AVERAGE FOR PENMAN-MONTEITH
	var sens_avg_t = SensorDataJSON.avg_t;
	var sens_min_t = SensorDataJSON.min_t;
	var sens_max_t = SensorDataJSON.max_t;
	// NET RADIATION (MJ per day per M^2), CONVERT FROM WATTS PER M^2 TO MJ PER DAY PER M^2
	var sens_net_rad = (SensorDataJSON.net_rad * 24 * 60 * 60) / 1000000;
	// WIND SPEED (m per s)
	// TODO: NOTE THE HEIGHT FROM WHICH THIS MEASUREMENT IS TAKEN, ALTER PENMAN-MONTEITH FUNC ACCORDINGLY (ASSUMES 1 METRE CURRENTLY)
	var sens_ws = SensorDataJSON.ws;
	// RELATIVE HUMIDITY (%)
	var sens_rh = SensorDataJSON.rs;
	
	var Penman_MonteithJSON = assemble_Penman_MonteithJSON(met_atmos_pres, sens_avg_t, sens_min_t, sens_max_t, sens_net_rad, sens_ws, sens_rh);
	// EVAPOTRANSPIRATION ESTIMATE (mm per day)
	// NB: NOTE THAT mm per day IS EQUIVALENT TO litres per m^2 per day!!
	var fao_transpiration = penman_monteith(Penman_MonteithJSON);
	
	if (met_precipitation < fao_transpiration){
		// IF DAILY PRECIPITATION DOES NOT MEET DAILY TRANSPIRATION
		
		// CALCULATE THE AMOUNT OF WATER NEEDED => AREA OF SOIL * DIFFERENCE BETWEEN PRECIPITATION AND TRANSPIRATION
		var water_needed = soil_area * (fao_transpiration - met_precipitation);
		// CALCULATE TIME IN SECONDS TO ACTIVATE PUMP FOR
		var pump_time = water_needed / pump_discharge;
		
		// SEND PUMP TIME DOWN TO MICROCONTROLLER (I HAVE NO IDEA HOW YOU DO THIS I JUST GUESSED)
		var IrrigateSignal = assemble_IrrigateHTTP(pump_time);
		return IrrigateSignal;
		
		// REMEMBER LOGGING FUNCTIONALITY SHOULD BE ADDED HERE
	} else {
		// DAILY PRECIPITATION MEETS REQUIREMENTS
		// IN THIS CASE WE WOULD LIKE TO VERIFY LATER THAT IT RAINED
		
		// LOG A MOISTURE READING FOR THE MORNING
		var sens_moisture_morning = SensorDataJSON.moisture;
		var met_rain_hour = GetMetJSON.rain_hour;
		var check_time = met_rain_hour + 1;
		var no_rain_pump_time = fao_transpiration * soil_area / pump_discharge;
		
		// ADDITIONAL CLOUD FUNCTION: RAIN CHECK
		// WE WANT TO QUEUE A CHECK 1 HOUR AFTER IT RAINS
		// WE COMPARE TO SEE IF MOISTURE HAS INCREASED SINCE THE MORNING
		// IF SO, WE ASSUME IT RAINED, IF NOT, IRRIGATE ACCORDING TO MORNING'S READINGS
		rain_check(check_time, sens_moisture_morning, no_rain_pump_time);
		
		return EmptyHTTP;
	}
}

