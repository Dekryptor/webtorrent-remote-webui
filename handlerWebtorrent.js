const webtorrent = require('webtorrent')
const fs = require('fs')
const parseTorrent = require('parse-torrent')
const rimraf = require('rimraf')

const client = new webtorrent()
const torrentFolder = 'torrent_folder/'
const downloadFolder = 'downloads/'
const webtorrentOpts = {
  path: downloadFolder
}

const pathStateFile = './state.json'

const upBacklog = {}
let state = {}
state.paused = {}
state.up = {}

let removed = []

function getState () {
  try {
    state = JSON.parse( fs.readFileSync(pathStateFile, 'utf-8') )
    state.paused = state.paused || {}
    state.up = state.up || {}
  } catch (err) {
    console.log('Error reading state file')
  }
}

function storeState() {
  fs.writeFileSync(pathStateFile, JSON.stringify(state) , 'utf-8');
}

function returnState() {
  return state
}

function returnRemoved() {
  const toReturn = removed
  removed = []
  return toReturn
}

function checkInterval() {
  setTimeout( checkInterval, 10*1000 )

  console.log( '-------------------' )
  client.torrents.forEach( t => {
    const name = t.name || ''
    console.log(name.slice(0, 10) + ' is complete : ' + (t.progress || '0') + ', uploaded : ' + state.up[t.infoHash])

    // Need to keep track of what's been uploaded in the past 5 secs in backlog
    state.up[t.infoHash] += (t.uploaded - upBacklog[t.infoHash]) || 0
    upBacklog[t.infoHash] = t.uploaded || 0
  })

  storeState()
}

// Loop over all the torrents in ./torrents
function start (){
  getState()
  checkInterval()

  fs.readdir(torrentFolder, (err, files) => {
    if(err || !files) {
      return console.log(err, files)
    }

    files = files.filter( file => file.includes('.torrent') )

    files.forEach( file => {
      const path = torrentFolder + file
      const isMagnet = file.includes('.torrent.magnet')
      const torrent = isMagnet ? fs.readFileSync(path, 'utf8') : path

      client.add(torrent, webtorrentOpts, t => {
        console.log('Torrent added : ' + t.name )

        // Pause torrent if it was in paused state
        if ( state.paused[t.infoHash] ) t.pause()

        // If we had a magnet link, just push it to the list
        if (isMagnet) {
          fs.writeFile(torrentFolder + (t.name || t.infoHash) + '.torrent', t.torrentFile,  "binary")
          fs.unlinkSync(torrentFolder + t.infoHash + '.torrent.magnet')
        }
      })
    })
  })
}

function pauseTorrent(infoHash) {
  client.get(infoHash).pause()
  state.paused[infoHash] = true
  storeState()
}

function resumeTorrent(infoHash) {
  client.get(infoHash).resume()
  delete state.paused[infoHash]
  storeState()
}

// magnet:?xt=urn:btih:88928d3ca7f5d71e39037279c1ee787a80de6ea0&dn=archlinux-2017.07.01-x86_64.iso&tr=http%3A%2F%2Ftracker.archlinux.org%3A6969%2Fannounce&tr=wss%3A%2F%2Ftracker.btorrent.xyz&ws=http%3A%2F%2Fwww.mirrorservice.org%2Fsites%2Fftp.archlinux.org%2Fiso%2F2017.07.01%2F&ws=http%3A%2F%2Fza.mirror.archlinux-br.org%2Fiso%2F2017.07.01%2F
function add(args) {
  function cb(t) {
    console.log('Torrent added : ' + t.name )

    if (args.paused) {
      t.pause()
      state.paused[t.infoHash] = true
      storeState()
    }

    // We have meta - write torrent and delete infohash file
    fs.writeFile(torrentFolder + (t.name || t.infoHash) + '.torrent', t.torrentFile,  "binary")
    fs.unlinkSync(torrentFolder + t.infoHash + '.torrent.magnet')
  }

  // Magnet
  if (args.filename) {
    client.add(args.filename, webtorrentOpts, cb)
    fs.writeFileSync(torrentFolder + parseTorrent(args.filename).infoHash + '.torrent.magnet', args.filename, 'utf8')
  // Torrent file
  } else if (args.metainfo) {
    client.add(Buffer.from(args.metainfo, 'base64'), webtorrentOpts, cb )
  }
}

function remove(args) {
  args.ids.forEach( id => {
    const torrent = client.get(id)
    const name = torrent.name || torrent.infoHash
    const infoHash = torrent.infoHash
    const torrentReady = torrent.files[0  ]
    const files = torrent.files

    client.remove(id)
    delete state.paused[infoHash]
    delete state.up[infoHash]

    removed.push( infoHash )

    // Delete torrent file, or magnet link in file
    if (!torrentReady) {
      fs.unlinkSync(torrentFolder + infoHash + '.torrent.magnet')
    } else {
      fs.unlinkSync(torrentFolder + name + '.torrent')
      if ( args['delete-local-data'] ) {
        files.forEach( file => rimraf(downloadFolder + file.path, err => console.log(err || 'Saving done !')) )
      }

    }
  })
}

function select(id, wanted) {
  const torrent = client.get( id )
  torrent.files[ wanted ].deselect()
}

function deselect(id, unwanted) {
  const torrent = client.get( id )
  torrent.files[ unwanted ].deselect()
}

module.exports = {
  client,
  returnState,
  returnRemoved,
  start,
  add,
  remove,
  pauseTorrent,
  resumeTorrent,
  select,
  deselect,
}
