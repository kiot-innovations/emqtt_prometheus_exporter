const http = require('http')
const pClient = require('prom-client')
const Config = require('../config/config')
const request = require('request-promise')
const prefix = 'emq'

const gaugeProps = [
  {
    name: 'client_count',
    help: 'This is help'

  },
  {
    name: 'retained_count',
    help: 'This is help2'
  },
  {
    name: 'routes_count',
    help: 'This is help3'
  },
  {
    name: 'session_count',
    help: 'This is help'
  },
  {
    name: 'subscribers_count',
    help: 'This is help'
  },
  {
    name: 'subscriptions_count',
    help: 'This is help'
  },
  {
    name: 'topics_count',
    help: 'This is help'
  },
  {
    name: 'qos0_recvd',
    help: 'This is help'
  },
  {
    name: 'qos0_sent',
    help: 'This is help'
  },
  {
    name: 'qos0_dropped',
    help: 'This is help'
  },
  {
    name: 'qos1_recvd',
    help: 'This is help'
  },
  {
    name: 'qos1_sent',
    help: 'This is help'
  },
  {
    name: 'qos1_dropped',
    help: 'This is help'
  },
  {
    name: 'qos2_recvd',
    help: 'This is help'
  },
  {
    name: 'qos2_sent',
    help: 'This is help'
  },
  {
    name: 'qos2_dropped',
    help: 'This is help'
  },
  {
    name: 'connect_requests',
    help: 'This is help'
  },
  {
    name: 'disconnect_requests',
    help: 'This is help'
  }
]
const commonGaugeProps = [
  {
    name: 'node_count',
    help: 'Number of nodes in cluster'
  }
]
const labelNames = ['nodename']
function getMetrics () {
  // return pClientise.resolve("Hello");
  let allMetrics = {}
  pClient.register.clear()
  gaugeProps.map(metric => {
    allMetrics[metric.name] = new pClient.Gauge({
      name: prefix + '_' + metric.name,
      help: metric.help,
      labelNames: labelNames
    })
  })
  commonGaugeProps.map(metric => {
    allMetrics[metric.name] = new pClient.Gauge({
      name: prefix + '_' + metric.name,
      help: metric.help
    })
  })

  return fetchEmqStats().then(data => {
    const metrics = data.metrics
    const stats = data.stats
    if (!metrics.result || !stats.result) {
      // Unknown Response Format
      console.error('Unknow API Response format')
      return
    }

    // From Stats Obtained
    const sRes = stats.result[0]
    Object.keys(sRes).map(node => {
      if (!sRes.hasOwnProperty(node)) return
      const labels = {
        nodename: node
      }
      const values = {
        'client_count': sRes[node]['clients/count'],
        'retained_count': sRes[node]['retained/count'],
        'routes_count': sRes[node]['routes/count'],
        'session_count': sRes[node]['sessions/count'],
        'subscribers_count': sRes[node]['subscribers/count'],
        'subscriptions_count': sRes[node]['subscriptions/count'],
        'topics_count': sRes[node]['topics/count']
      }

      Object.keys(values).map(value => {
        if (!values.hasOwnProperty(value)) return
        allMetrics[value].set(labels, values[value])
      })
    })

    // From Metrics Obtained
    const mRes = metrics.result[0]
    Object.keys(mRes).map(node => {
      if (!mRes.hasOwnProperty(node)) return
      const labels = {
        nodename: node
      }
      const values = {
        'qos0_recvd': mRes[node]['messages/qos0/received'],
        'qos0_sent': mRes[node]['messages/qos0/sent'],
        'qos0_dropped': mRes[node]['messages/qos0/dropped'],
        'qos1_recvd': mRes[node]['messages/qos1/received'],
        'qos1_sent': mRes[node]['messages/qos1/sent'],
        'qos1_dropped': mRes[node]['messages/qos1/dropped'],
        'qos2_recvd': mRes[node]['messages/qos2/received'],
        'qos2_sent': mRes[node]['messages/qos2/sent'],
        'qos2_dropped': mRes[node]['messages/qos2/dropped'],
        'connect_requests': mRes[node]['packets/connect'],
        'disconnect_requests': mRes[node]['packets/disconnect']
      }

      Object.keys(values).map(value => {
        if (!values.hasOwnProperty(value)) return
        allMetrics[value].set(labels, values[value] || 0)
      })
    })

    const commonValues = {
      'node_count': _getObjectLength(sRes)   
    }
    Object.keys(commonValues).map(value => {
      if (!commonValues.hasOwnProperty(value)) return
      allMetrics[value].set(commonValues[value])
    })

    return pClient.register.metrics()
  })
}

function fetchEmqStats () {
  const statsOpts = {
    method: 'GET',
    url: `${Config.apiBase}${Config.emqApis.stats}`,
    'auth': {
      'username': `${Config.emq_username}`,
      'password': `${Config.emq_password}`,
      'sendImmediately': false
    }
  }
  const metricsOpts = {
    method: 'GET',
    url: `${Config.apiBase}${Config.emqApis.metrics}`,
    'auth': {
      'username': `${Config.emq_username}`,
      'password': `${Config.emq_password}`,
      'sendImmediately': false
    }
  }

  return Promise.all([
    request(statsOpts),
    request(metricsOpts)
  ]).then(data => {
    const stats = JSON.parse(data[0])
    const metrics = JSON.parse(data[1])
    return { stats: stats, metrics: metrics }
  })
}

function App () {
  const server = http.createServer(handleRequest)
  server.listen(Config.port)
  server.on('listening', () => {
    console.log('Listening on port ', Config.port)
  })
  server.on('error', (err) => {
    console.log('An error occured in starting server')
    console.error(err)
  })
}
function handleRequest (req, res) {
  const url = req.url
  if (url == '/metrics') {
    getMetrics().then(data => {
      return res.end(data)
    }).catch(err => {
      console.log(err)
      res.writeHead(500)
      res.end()
    })
  } else {
    res.writeHead(404)
    res.end()
  }
}
function _getObjectLength (obj) {
  let n = 0
  Object.keys(obj).map(i => {
    if (obj.hasOwnProperty(i)) n++
  })
  return n
}
// Begin the game
App()
