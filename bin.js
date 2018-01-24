#!/usr/bin/env node
'use strict'

const mri = require('mri')
const so = require('so')
const chalk = require('chalk')
const fs = require('fs')

const pkg = require('./package.json')
const lib = require('./lib')

const argv = mri(process.argv.slice(2), {
	boolean: ['help', 'h', 'version', 'v']
})

const opt = {
	datafile: argv._[0] || './data.ndjson',
	help: argv.help || argv.h,
	version: argv.version || argv.v
}

if (opt.help === true) {
	process.stdout.write(`
vbb-change-positions [datafile] [options]

Arguments:
    datafile        NDJSON data file path (default: './data.ndjson').

Options:
    --help      -h  Show help dialogue (this)
    --version   -v  Show version
`)
	process.exit(0)
}

if (opt.version === true) {
	process.stdout.write(`vbb-change-positions-cli v${pkg.version}\n`)
	process.exit(0)
}


const showError = function (err) {
	if (process.env.NODE_DEBUG === 'vbb-change-positions-cli') console.error(err)
	process.stderr.write(chalk.red(err.message) + '\n')
	process.exit(err.code || 1)
}

const main = so(function* (opt) {
	let station, samePlatform, fromLines, fromStation, fromTrack, fromPosition, toLines, toStation, toTrack, toPosition, reverse

	// query (interchange) station
	station = yield lib.queryStation('Station?')
	try {
		station = yield lib.parseStation(station)
	} catch (err) {
		showError(err)
	}

	// query SAMEPLATFORM
	samePlatform = yield lib.querySamePlatform('Arrival and departure the same platform?')

	// FROM
	// query fromStation
	fromStation = yield lib.queryStation('From station?')
	try {
		fromStation = yield lib.parseStation(fromStation)
	} catch (err) {
		showError(err)
	}
	// query fromLines
	fromLines = yield lib.queryLines('From lines (multiple selections allowed)?', fromStation.id)
	try {
		fromLines = lib.parseLines(fromLines)
	} catch (err) {
		showError(err)
	}
	// query fromTrack
	fromTrack = yield lib.queryTrack('From track (optional)?')
	try {
		fromTrack = lib.parseTrack(fromTrack)
	} catch (err) {
		showError(err)
	}
	// query fromPosition
	if(!samePlatform){
		fromPosition = yield lib.queryPosition('From position?')
		try {
			fromPosition = lib.parsePosition(fromPosition)
		} catch (err) {
			showError(err)
		}
	}
	else{
		fromPosition = 0.5
	}


	// TO
	// query toStation
	toStation = yield lib.queryStation('To station?')
	try {
		toStation = yield lib.parseStation(toStation)
	} catch (err) {
		showError(err)
	}
	// query toLines
	toLines = yield lib.queryLines('To lines (multiple selections allowed)?', toStation.id)
	try {
		toLines = lib.parseLines(toLines)
	} catch (err) {
		showError(err)
	}
	// query toTrack
	toTrack = yield lib.queryTrack('To track (optional)?')
	try {
		toTrack = lib.parseTrack(toTrack)
	} catch (err) {
		showError(err)
	}
	// query toPosition
	if(!samePlatform){
		toPosition = yield lib.queryPosition('To position?')
		try {
			toPosition = lib.parsePosition(toPosition)
		} catch (err) {
			showError(err)
		}
	}
	else{
		toPosition = 0.5
	}

	// query reverse
	reverse = yield lib.queryReverse('Also add reverse route?')

	const entries = lib.buildEntries({
		station,
		samePlatform,
		fromStation,
		fromLines,
		fromTrack,
		fromPosition,
		toStation,
		toLines,
		toTrack,
		toPosition,
		reverse
	}, reverse)

	const ndjson = entries.map(JSON.stringify).join("\n")+"\n"

	try{
		fs.appendFileSync(opt.datafile, ndjson)
		console.log('Appended to '+opt.datafile)
	} catch(err) {
		showError(err)
	}

	process.stdout.write(ndjson)
})

main(opt).catch(showError)
