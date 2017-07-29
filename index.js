const restify = require('restify')

const types = require('./types')
const wt = require('./handlerWebtorrent')
const translate = require('./translator')

function getTorrentDiff( torrentId, fields ) {
  // TODO: Pick proper torrent here
  let t = types.torrentDetail
  t.peers.push( types.peer )
  t.trackerStats.push( types.trackerDetail )

  let filteredTorrent = {}
  fields.forEach( item => filteredTorrent[item] = t[item] )
  filteredTorrent.peers = []
  filteredTorrent.trackerStats = []

  return {
    torrents: [ filteredTorrent ],
    removed: [],
  }
}

function getActive () {
  // Active is essentially torrents without totalSize, name, and addedDate...
  // But it doesnt seem to really care having too many arguments...
  return getTorrents()
}

function getTorrent( torrentId ) {
  const torrents = []

  const torrent = wt.client.get(torrentId)
  torrents.push( translate.wtToTransmissionTorrentDetail(torrent) )

  return {
    torrents,
    removed: [],
  }
}

function getTorrents() {
  const wtTorrents = wt.client.torrents || []
  const torrents = wtTorrents.map( translate.wtToTransmissionTorrent )

  return {
    torrents,
    removed: wt.returnRemoved()
  }
}

function parser (q){
  let arguments

  console.log('\r\n> ' + q.method )

  switch (q.method) {
    case 'session-get':
      arguments = JSON.parse(types.sessionGet) // Return dummy session data
      break

    case 'session-stats':
      arguments = JSON.parse(types.sessionStats) // Return dummy stats
      break

    case 'torrent-get':
      // Get all torrents
      if (!q.arguments.ids) {
        console.log(' + all torrents')
        arguments = getTorrents()

      // Recently active
      } else if (q.arguments.ids === 'recently-active') {
        console.log(' + recently active')
        arguments = getActive()

      // Get one specific torrent
      } else if (q.arguments.ids[0]) {
        // ... in some sort of diff view
        if ( q.arguments.fields.length < 15 ) {
          console.log(' + torrent ' + q.arguments.ids[0] + ' diff view ')
          arguments = getTorrentDiff( q.arguments.ids[0], q.arguments.fields )

        // Full stuff
        } else {
          console.log(' + torrent ' + q.arguments.ids[0] + ' full thing ')
          arguments = getTorrent(q.arguments.ids[0])
        }
      }
      break

    case 'torrent-set':
      if (q.arguments['files-unwanted']) {
        wt.deselect( q.arguments.ids[0], q.arguments['files-unwanted'][0] )
      } else if (q.arguments['files-wanted']) {
        wt.select( q.arguments.ids[0], q.arguments['files-wanted'][0] )
      }
      break

    case 'torrent-start':
      q.arguments.ids.forEach( wt.resumeTorrent )
      break

    case 'torrent-stop':
      q.arguments.ids.forEach( wt.pauseTorrent )
      break

    case 'torrent-add':
      wt.add(q.arguments)
      break

    case 'torrent-remove':
      wt.remove(q.arguments)
      break

    default:
      break
  }

  return {
    arguments: arguments || {},
    result: 'success'
  }
}

const server = restify.createServer()
server.use(restify.plugins.acceptParser(server.acceptable))
server.use(restify.plugins.bodyParser())

// Serve static folder
server.get(/\/?.*/, restify.plugins.serveStatic({
  directory: __dirname + '/static',
  default: 'index.html',
  match: /^((?!index.js).)*$/
}))

// Main endpoint for transmission ui
server.post('rpc', function (req, res, next) {
  req.query = JSON.parse( req.body.toString('utf8'), 0, 2)
  // console.log( JSON.stringify(req.query, 0, 2))

  res.json( parser(req.query) )
  return next()
})

// Init webtorrent
wt.start()

// TODO: Spec ip here !
server.listen(9081, function () {
  console.log('%s listening at %s', server.name, server.url)
})
