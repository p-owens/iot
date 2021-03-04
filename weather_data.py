#  you need to pip install requests 
#  and xmltodict packages

import requests
import json
import xmltodict

#  the function takes a request in the form of a .json string
#  eg:
#  {
#     "lat":"[lattitude]",
#     "long":"[longitude]"
#  }
#
#  returns a json string of weather data for the next 48 hrs

def get_met(request):

   #parse the input   
   request_json = request.get_json()
   if request_json and 'lat' in request_json and 'long' in request_json:
      lat = request_json['lat']
      lon = request_json['long']
   else:
#  return an error if the input isn't specified correctly      
      return f'Error'   
   
#  make a request from MetEireann   
   url = "http://metwdb-openaccess.ichec.ie/metno-wdb2ts/locationforecast?lat={0};long={1}".format(str(lat), str(lon))
   resp = requests.get(url)                                               

#  check to make sure the request was successful 
   if resp.status_code != 200:                   
      return f'Error'  

#  turn the xml returned from the Met into a dict
   data_dict = xmltodict.parse(resp.text)                 

#  we only care about the weather predictions drop everything else   
   next48hrs = data_dict.get("weatherdata").get("product").get("time")   

#  convert the dict to .json and return it   
   weather = json.dumps(next48hrs[0:96])                                 
   return weather
   