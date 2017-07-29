const types = require('./types')
const wtHandler = require('./handlerWebtorrent')

function wtToTransmissionTorrentDetail (wt) {
  if ( !wt ) return

  let t = types.torrentDetail

  t.id               = wt.infoHash
  t.comment          = wt.comment
  t.percentDone      = wt.progress
  t.haveValid        = wt.downloaded
  t.downloadedEver   = wt.info ? wt.info.length : -1
  t.pieceCount       = wt.pieces ? wt.pieces.length : -1
  t.pieceSize        = wt.pieceLength
  t.dateCreated      = wt.created ? wt.created.getTime() : 9999999999

  t.fileStats = []
  t.files = []

  files = wt.files || []
  t.fileStats = files.map( file => {
    return {
      bytesCompleted: file.downloaded,
      priority: 0,
      wanted: true,
    }
  })

  t.files = files.map( file => {
    return {
      bytesCompleted: file.downloaded,
      length: file.length,
      name: file.name,
    }
  })

  // Can't use that yet
  // const trackers = wt.announce || []
  // t.trackerStats = trackers.map( (tracker, i) => {})

  t.trackerStats = []
  return Object.assign({}, t)
}

function wtToTransmissionTorrent( wt, i ){
  let t = types.torrent

  t.metadataPercentComplete = wt.files && wt.files.length ? 1 : 0

  t.status             = wt.paused ? 0 : ( wt.progress === 1 ? 6 : 4 ) // See types for details
  t.name               = wt.name
  t.id                 = wt.infoHash // otherwise i
  t.isFinished         = wt.progress === 1
  t.eta                = wt.timeRemaining ? Math.floor(wt.timeRemaining/1000) : 9999999999999
  t.peersConnected     = wt.numPeers
  t.peersGettingFromUs = wt.numPeers
  t.peersSendingToUs   = wt.numPeers
  t.downloadDir        = wt.path
  t.percentDone        = wt.progress
  t.rateDownload       = wt.downloadSpeed
  t.rateUpload         = wt.uploadSpeed
  t.uploadRatio        = wtHandler.returnState().up[ wt.infoHash ]/wt.downloaded || wt.ratio
  t.uploadedEver       = wtHandler.returnState().up[ wt.infoHash ] || wt.uploaded

  // sizeWhenDone - leftUntilDone
  const total = wt.info ? wt.info.length : -1
  t.totalSize        = total
  t.sizeWhenDone     = total
  t.leftUntilDone    = Math.floor(total - wt.downloaded)

  // Can't use that yet
  // const trackers = wt.announce || []
  // t.trackers = trackers.map( (tracker, i) => {
  //    return {
  //     id: i,
  //     tier: 0,
  //     announce: tracker,
  //     scrape: tracker,
  //   }
  // })
  t.trackers = []

  return Object.assign({}, t) // Fancy JSON.parse( JSON.stringify(t) ) ...
}

module.exports = {
  wtToTransmissionTorrent,
  wtToTransmissionTorrentDetail
}
