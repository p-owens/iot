load('api_config.js');
load('api_mqtt.js');
load('api_sys.js');
load('api_timer.js');

let commandTopic = '/devices/' + Cfg.get('device.id') + '/commands/#';
let stateTopic = '/devices/' + Cfg.get('device.id') + '/state';
let sensorTopic = '/devices/' + Cfg.get('device.id') + '/events/sensor-data';

let led = Cfg.get('board.led1.pin');

function publishSensorData() {
  let msg = JSON.stringify({
    deviceID: Cfg.get('device.id'),
    sensors: {
      "temperature": Math.random() * (253.15 - 313.13) + 253.15,
      "humidity": Math.random() * 100.0,
      "pressure": Math.random() * (105.2 - 92.7) + 92.7,
      "ws": Math.random() * 53.05,
      "radiation": Math.random() * 1000,
      "rain": Math.random() < 0.1 ? true : false
    }
  });
  print(sensorTopic, '->', msg);
  MQTT.pub(sensorTopic, msg, 1);
}

Timer.set(900000 /* milliseconds */, Timer.REPEAT, publishSensorData, null);

MQTT.sub(commandTopic, function (conn, topic, command) {
  if ( command === 'publish' ) {
    publishSensorData();
  }
}, null);
