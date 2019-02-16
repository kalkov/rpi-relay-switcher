require('colors')
const mqtt = require('mqtt')
const config = require('config')
const Gpio = require('onoff').Gpio

const statusLed = new Gpio(22, 'out')
const connectedLed = new Gpio(23, 'out')

const relay0 = new Gpio(26, 'out')
const relay1 = new Gpio(20, 'out')
const relay2 = new Gpio(21, 'out')
const relays = [relay0, relay1, relay2]

const username = config.get('username')
const password = config.get('password')
const mqttUrl = config.get('mqtt_url')
const device = config.get('device')
const publishInterval = config.get('publish_interval')
const defaultRelaysStates = config.get('relays.default_states')

const clientId = `${username}/${device}`

const deviceTopic = `devices/${device}`
const eventTopic = `${deviceTopic}/event`
const commandTopic = `${deviceTopic}/command`
const measurementsTopic = `${deviceTopic}/measurements`

const options = { clientId: clientId, username: username, password: password }
const client = mqtt.connect(mqttUrl, options)

const currentTime = () => {
  return `[${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')}]`
}

console.log(`${currentTime()} Connecting to: ${mqttUrl} as ${username}`.yellow)

client.on('connect', () => {
  console.log(`${currentTime()} Connected to: ${mqttUrl}`.green)
  connectedLed.writeSync(1)
})

client.on('offline', () => {
  console.log(`${currentTime()} Disconnected from: ${mqttUrl}`.red)
  setDefaultStates()
})

client.on('end', () => {
  console.log(`${currentTime()} Connection ended from: ${mqttUrl}`.red)
  setDefaultStates()
})

client.on('error', error => {
  console.log(`${currentTime()} Connection closed from: ${mqttUrl}`.red)
  console.error(`${currentTime()} ${error}`)
  setDefaultStates()
})

client.on('close', () => {
  console.log(`${currentTime()} Connection closed from: ${mqttUrl}`.red)
  setDefaultStates()
})

client.subscribe(commandTopic)

const setDefaultStates = () => {
  connectedLed.writeSync(0)
  relays[0].writeSync(defaultRelaysStates[0])
  relays[1].writeSync(defaultRelaysStates[1])
  relays[2].writeSync(defaultRelaysStates[2])
}

const executeCommand = (command) => {
  if (command.type === 'change-devices') {
    let changedDevices = []

    command.devices.forEach((device) => {
      let oldState = relays[device.id].readSync()
      relays[device.id].writeSync(device.state)
      let newState = relays[device.id].readSync()

      console.log(`${currentTime()} Current state of relay_${device.id} is ${newState}`.cyan)
      changedDevices.push({ device: device.id, new_state: newState, old_sitate: oldState })
    })

    let eventPayload = JSON.stringify({ type: 'changed-devices', devices: changedDevices })
    console.log(`${currentTime()} Publishing to ${eventTopic}: `.yellow + eventPayload)
    client.publish(eventTopic, eventPayload)
  }
}

const fetchRelayState = (relayNumber) => {
  return new Promise((resolve, reject) => {
    relays[relayNumber].read((err, data) => {
      if (err) return reject(err)
      resolve({ name: `relay_${relayNumber}`, data: data })
    })
  })
}

const fetchAndPublish = () => {
  Promise
    .all([fetchRelayState(0), fetchRelayState(1), fetchRelayState(2)])
    .then(results => {
      statusLed.writeSync(1)

      const sensors = results.reduce((a, b) => a.concat(b), []).filter((result) => result)
      const measurementsPayload = JSON.stringify({ sensors: sensors })
      console.log(`${currentTime()} Publishing to ${measurementsTopic}: `.yellow + measurementsPayload)

      client.publish(measurementsTopic, measurementsPayload)
      statusLed.writeSync(0)
    })
    .catch(error => console.error(error))
}

client.on('message', (topic, message) => {
  console.log(`${currentTime()} Received command: ${message}`.magenta)
  let command = JSON.parse(message.toString())
  executeCommand(command)
})

setInterval(() => fetchAndPublish(), publishInterval)
