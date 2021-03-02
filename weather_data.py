import requests
import numpy as np
import json
import xmltodict

#function takes lattitude and longatiude as floats
#returns a np array of weather data for the next 48 hours
#in one hour intervals 

def get_data(json_in):
      
   #parse the input
   ip = json.loads(json_in)
   lat = ip["latitude"]
   lon = ip["longitude"]
   
   #url to make requests from MetEireann
   url = "http://metwdb-openaccess.ichec.ie/metno-wdb2ts/locationforecast?lat={0};long={1}".format(str(lat), str(lon))


   resp = requests.get(url)                                                #making the request

   if resp.status_code != 200:                                             #if data not returned
      return -1   

   data_dict = xmltodict.parse(resp.text)                                  #convert the data returned from the Met to a dict  
   next48hrs = data_dict.get("weatherdata").get("product").get("time")     #strip out only the data we want - the weather predictions
   return json.dumps(next48hrs[0:96])                                      #return the weather predictions as .json