'use strict'

const client = require('vbb-client')
const autocompletePrompt = require('cli-autocomplete')
const switchPrompt = require('switch-prompt')
const textPrompt = require('text-prompt')
const util = require('vbb-util')
const chalk = require('chalk')
const multiselectPrompt = require('multiselect-prompt')
const selectPrompt = require('select-prompt')
const linesAt = require('vbb-lines-at')
const uniqBy = require('lodash.uniqby')
const sortBy = require('lodash.sortby')

// STATIONS
const isStationId = (s) => /^\d{12}$/.test(s.toString())
const parseStation = (query) => {
	if (isStationId(query)) return client.station(+query)

	return client.stations({
		query, results: 1,
		identifier: 'vbb-change-positions-cli'
	})
	.then(([station]) => {
		if (!station) throw new Error('Station not found.')
		return station
	})
}
const suggestStations = (input) => {
	if (!input || input === '') return Promise.resolve([])

	return client.stations({
		query: input, completion: true, results: 5,
		identifier: 'vbb-change-positions-cli'
	})
	.then((stations) => stations.slice(0, 5).map((s) => ({
		title: s.name + ' – ' + s.id, value: s.id
	})))
}
const queryStation = (msg) => {
	return new Promise((yay, nay) => {
		autocompletePrompt(chalk.bold(msg), suggestStations)
		.on('submit', yay)
		.on('abort', (val) => {
			nay(new Error(`Rejected with ${val}.`))
		})
	})
}

// LINES
const lineColor = (l) => util.lines.colors[l.product][l.name].bg
const lines = (stationId) =>
	uniqBy(
		linesAt[stationId]
		.filter(l => ['subway', 'suburban'].includes(l.product)),
		l => l.name
	).map(l => {
		l.color = lineColor(l)
		return l
	})
const lineChoices = (stationId) => sortBy(lines(stationId), l => l.name).map((line) => ({
	value: line.name,
	title: chalk.hex(line.color || '#fff')(line.name),
	selected: false
}))
const queryLines = (msg, stationId) => new Promise((yay, nay) =>
	multiselectPrompt(msg, lineChoices(stationId))
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', (lines) => yay(lines.reduce((acc, l) => {
		acc[l.value] = l.selected
		return acc
	}, {}))))
const isValidLine = (l) => l in lines.map(l => l.name)
const reduceLines = (acc, l) => {
	acc[l] = true
	return acc
}
const parseLines = (l) => {
	if(Object.keys(l).every(k => l[k]===false)) throw new Error('At least one line must be selected.')
	return l
}

// POSITION
const parsePosition = (x) => {
	x = parseFloat(x)
	if(Number.isNaN(x) || x < 0 || x > 1) throw new Error('Invalid platform position.')
	return x
}
const queryPosition = (msg) => new Promise((yay, nay) =>
	textPrompt(msg)
	.on('submit', yay)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
)

// SAMEPLATFORM
const querySamePlatform = (msg) => new Promise((yay, nay) =>
	switchPrompt(msg, 'yes', 'no', false)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', yay)
)

// TRACK
const parseTrack = (t) => {
	t = t+''
	if(t.length === 0) return null
	return t
}
const queryTrack = (msg) => new Promise((yay, nay) =>
	textPrompt(msg)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', yay)
)

// REVERSE
const queryReverse = (msg) => new Promise((yay, nay) =>
	switchPrompt(msg, 'yes', 'no', false)
	.on('abort', (v) => nay(new Error(`Rejected with ${v}.`)))
	.on('submit', yay)
)

const buildEntry = (station, samePlatform, fromLines, fromStation, fromTrack, fromPosition, toLines, toStation, toTrack, toPosition) => {
	const res = {
		station: station.id,
		stationName: station.name,
		fromLines: Object.keys(fromLines).filter(k => fromLines[k]),
		fromStation: fromStation.id,
		fromStationName: fromStation.name,
		fromTrack,
		fromPosition,
		toLines: Object.keys(toLines).filter(k => toLines[k]),
		toStation: toStation.id,
		toStationName: toStation.name,
		toTrack,
		toPosition,
		samePlatform
	}
	if(!res.fromTrack) delete res.fromTrack
	if(!res.toTrack) delete res.toTrack
	return res
}

const revertLines = (lines) => {
	if(lines.S41){
		lines.S42 = true
		lines.S41 = false
	}
	else if(lines.S42){
		lines.S42 = false
		lines.S41 = true
	}
	return lines
}

const buildEntries = (props, reverse) => {
	const entries = []
	entries.push(buildEntry(props.station, props.samePlatform, props.fromLines, props.fromStation, props.fromTrack, props.fromPosition, props.toLines, props.toStation, props.toTrack, props.toPosition))
	if(reverse) entries.push(buildEntry(props.station, props.samePlatform, revertLines(props.toLines), props.toStation, props.toTrack, 1-props.toPosition, revertLines(props.fromLines), props.fromStation, props.fromTrack, 1-props.fromPosition))
	return entries
}

module.exports = {
	parseStation, queryStation,
	parseLines, queryLines,
	parsePosition, queryPosition,
	parseTrack, queryTrack,
	querySamePlatform,
	queryReverse,
	buildEntries
}
