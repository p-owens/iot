import requests
from lxml import etree as ET
import numpy as np


#function takes lattitude and longatiude as floats
#returns a np array of weather data for the next 48 hours
#in one hour intervals 

def get_data(lat, lon):
    #url to make requests from MetEireann
    url = "http://metwdb-openaccess.ichec.ie/metno-wdb2ts/locationforecast?lat={0};long={1}".format(str(lat), str(lon))
    

    resp = requests.get(url)                                    #making the request

    if resp.status_code != 200:                                 #if data not returned
        return -1   

    root = ET.fromstring(resp.text)                             #convert string retuend from MetEireann to valid XML
    child = root[1]

    entire = [["hour",                                          #data returned as a np array, first row is the headings
                "day",
                "month",
                "year",
                child[(0)][0][0].tag,                          #temperature
                child[(0)][0][1].tag,                          #windDirection
                child[(0)][0][2].tag,                          #windSpeed
                child[(0)][0][3].tag,                          #globalRadiation
                child[(0)][0][4].tag,                          #humidity
                child[(0)][0][5].tag,                          #pressure
                child[(0)][0][6].tag,                          #cloudiness
                child[(0)][0][7].tag,                          #lowClouds
                child[(0)][0][8].tag,                          #mediumClouds
                child[(0)][0][9].tag,                          #highClouds
                child[(0)][0][10].tag,                         #dewpointTemperature
                "value",                                       #precipitation
                "maxvalue",                                    #precipitation
                "minvalue"]]                                   #precipitation

    for x in range(94):                                         #parse xml -- 
        if x % 2 == 0:                                              
            mylist = [child[(x)].get("from")[11:13],            #<time datatype="forecast" from="2021-02-11T15:00:00Z" to="2021-02-11T15:00:00Z">
                        child[(x)].get("from")[8:10],           #<time datatype="forecast" from="2021-02-11T15:00:00Z" to="2021-02-11T15:00:00Z">
                        child[(x)].get("from")[5:7],            #<time datatype="forecast" from="2021-02-11T15:00:00Z" to="2021-02-11T15:00:00Z">
                        child[(x)].get("from")[0:4],            #<time datatype="forecast" from="2021-02-11T15:00:00Z" to="2021-02-11T15:00:00Z">
                        child[(x)][0][0].get("value"),          #<temperature id="TTT" unit="celsius" value="1.7"/>
                        child[(x)][0][1].get("deg"),            #<windDirection id="dd" deg="119.3" name="SE"/>
                        child[(x)][0][2].get("mps"),            #<windSpeed id="ff" mps="15.4" beaufort="7" name="Stiv kuling"/>
                        child[(x)][0][3].get("value"),          #<globalRadiation value="159.7" unit="W/m^2"/>
                        child[(x)][0][4].get("value"),          #<humidity value="66.2" unit="percent"/>
                        child[(x)][0][5].get("value"),          #<pressure id="pr" unit="hPa" value="1017.5"/>
                        child[(x)][0][6].get("percent"),        #<cloudiness id="NN" percent="99.9"/>
                        child[(x)][0][7].get("percent"),        #<lowClouds id="LOW" percent="68.3"/>
                        child[(x)][0][8].get("percent"),        #<mediumClouds id="MEDIUM" percent="96.7"/>
                        child[(x)][0][9].get("percent"),        #HighClouds id="HIGH" percent="97.2"/>
                        child[(x)][0][10].get("value"),         #<dewpointTemperature id="TD" unit="celsius" value="-4.2"/>
                        child[(x + 1)][0][0].get("value"),      #<precipitation unit="mm" value="0.0" minvalue="0.0" maxvalue="0.0" probability="8.2"/>
                        child[(x + 1)][0][0].get("minvalue"),   #<precipitation unit="mm" value="0.0" minvalue="0.0" maxvalue="0.0" probability="8.2"/>
                        child[(x + 1)][0][0].get("maxvalue")]   #<precipitation unit="mm" value="0.0" minvalue="0.0" maxvalue="0.0" probability="8.2"/>
            entire.append(mylist)        
            

    return np.asarray(entire)


"""
<weatherdata xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://api.met.no/weatherapi/locationforecast/1.9/schema" created="2021-02-11T14:19:48Z">
   <meta>
      <model name="harmonie" termin="2021-02-11T06:00:00Z" runended="2021-02-11T09:49:18Z" nextrun="2021-02-11T16:00:00Z" from="2021-02-11T15:00:00Z" to="2021-02-13T12:00:00Z" />
      <model name="ec_n1280_1hr" termin="2021-02-11T00:00:00Z" runended="2021-02-11T09:49:18Z" nextrun="2021-02-11T18:00:00Z" from="2021-02-13T13:00:00Z" to="2021-02-14T18:00:00Z" />
      <model name="ec_n1280_3hr" termin="2021-02-11T00:00:00Z" runended="2021-02-11T09:49:18Z" nextrun="2021-02-11T18:00:00Z" from="2021-02-14T21:00:00Z" to="2021-02-17T00:00:00Z" />
      <model name="ec_n1280_6hr" termin="2021-02-11T00:00:00Z" runended="2021-02-11T09:49:18Z" nextrun="2021-02-11T18:00:00Z" from="2021-02-17T06:00:00Z" to="2021-02-21T00:00:00Z" />
      </meta>
   <product class="pointData">
      <time datatype="forecast" from="2021-02-11T15:00:00Z" to="2021-02-11T15:00:00Z">
         <location altitude="9" latitude="54.7211" longitude="-8.7237">
            <temperature id="TTT" unit="celsius" value="1.7"/>
            <windDirection id="dd" deg="119.3" name="SE"/>
            <windSpeed id="ff" mps="15.4" beaufort="7" name="Stiv kuling"/>
            <globalRadiation value="159.7" unit="W/m^2"/>
            <humidity value="66.2" unit="percent"/>
            <pressure id="pr" unit="hPa" value="1017.5"/>
            <cloudiness id="NN" percent="99.9"/>
            <lowClouds id="LOW" percent="68.3"/>
            <mediumClouds id="MEDIUM" percent="96.7"/>
            <highClouds id="HIGH" percent="97.2"/>
            <dewpointTemperature id="TD" unit="celsius" value="-4.2"/>
         </location>
      </time>
      <time datatype="forecast" from="2021-02-11T14:00:00Z" to="2021-02-11T15:00:00Z">
         <location altitude="9" latitude="54.7211" longitude="-8.7237">
            <precipitation unit="mm" value="0.0" minvalue="0.0" maxvalue="0.0" probability="8.2"/>
<symbol id="Cloud" number="4"/>
         </location>
      </time>
"""