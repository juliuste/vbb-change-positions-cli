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
	let fromStation, toStation, samePlatform, fromLines, previousStation, fromTrack, fromPosition, toLines, nextStation, toTrack, toPosition, reverse

	// query arrival station
	fromStation = yield lib.queryStation('From/Arrival station?')
	try {
		fromStation = yield lib.parseStation(fromStation)
	} catch (err) {
		showError(err)
	}

	// query departure station
	toStation = yield lib.queryStation('To/Departure station? (leave empty to set to same as arrival station)')
	try {
		if(!toStation) toStation = fromStation
		else toStation = yield lib.parseStation(toStation)
	} catch (err) {
		showError(err)
	}

	// query SAMEPLATFORM
	samePlatform = yield lib.querySamePlatform('Arrival and departure the same platform?')

	// FROM
	// query fromStation
	previousStation = yield lib.queryStation('Previous station?')
	try {
		previousStation = yield lib.parseStation(previousStation)
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
	nextStation = yield lib.queryStation('Next station?')
	try {
		nextStation = yield lib.parseStation(nextStation)
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
		fromStation,
		toStation,
		samePlatform,
		previousStation,
		fromLines,
		fromTrack,
		fromPosition,
		nextStation,
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
