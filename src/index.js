const util = require('util')
const fs = require('fs-extra')
const { exit } = require('process')
const path = require('path')
const zlib = require('zlib')
const xml2js = require('xml2js')
const { create, convert } = require('xmlbuilder2')

// songs to pass in (input_filename, input_filename, input_filename)
let input_als = [path.join(`${__dirname}`, "../", "test_single_Project/test_single.als"), path.join(`${__dirname}`, "../", "test_multi_Project/test_multi.als"),]
// check exists
/*
for (let i = 0; i < input_als.length; i++) {
    if (!fs.existsSync(input_als[i])) {
        console.log(`ERROR: Input .als does not exist: ${input_als[0]}`)
        exit(1);
    }
}*/
//C:\Users\Chris\Desktop\projects\ableton_set_creator\test_single_Project\test_single.als

// output_filename
let output_als = path.join(`${__dirname}`, "../", "/test_out/template_10.als")
// check exists
if (!fs.existsSync(output_als)) {
    fs.copySync(path.join(`${__dirname}`, "../", "/template_10/"), "test_out/")
    output_als = path.join(`${__dirname}`, "../", "/test_out/template_10.als")
}

// offset between in beats
let track_offset = 200

async function main() {
    let main_locators = []
    let main_time_signatures = []
    let main_ends = []
    let main_tracks = []

    // Extract Metadata
    for (let i = 0; i < input_als.length; i++) {
        console.log(input_als[i])

        // decompress als
        let data = fs.readFileSync(input_als[i])
        data = await zlib.unzipSync(data)

        let parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: false, explicitCharkey: true })
        let xml_obj = await parser.parseStringPromise(data.toString())

        //console.log(xml_obj["Ableton"])
        //exit()

        // locators
        let locators = xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"]["Locator"]

        // time signatures
        let time_signatures = xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"]

        // end loc
        let tracks = xml_obj["Ableton"]["LiveSet"]["Tracks"]["AudioTrack"]

        let end = 0

        try {
            // if multiple
            if (tracks.length) {
                tracks.forEach(t => {
                    let t_end = t["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]["CurrentEnd"]['$']["Value"]
                    if (t_end > end) {
                        end = t_end
                    }
                });
            } else {
                end = tracks["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]["CurrentEnd"]['$']["Value"]
            }
        } catch (e) {
            //console.error(e)
        }

        //console.log(locators)
        //console.log(time_signatures)
        //console.log(end)
        //console.log(tracks)
        //exit()

        main_locators.push(locators)
        main_time_signatures.push(time_signatures)
        main_ends.push(end)
        main_tracks.push(tracks)
    }

    // Concat Metadata

    let final_locators = []
    let final_time_signatures = []
    let final_tracks = []

    let taken_loc_ids = { "0": 1 }
    let largest_loc_id = 0
    let current_offset = 0;

    for (let i = 0; i < main_locators.length; i++) {
        let locators = main_locators[i]
        for (let j = 0; j < main_locators[i].length; j++) {
            let current_locator = locators[j]

            // assigning new ids
            //console.log(taken_loc_ids[current_locator['$']["Id"]])

            while (taken_loc_ids[current_locator['$']["Id"]]) {
                current_locator['$']["Id"] = largest_loc_id + 1
            }

            taken_loc_ids[current_locator['$']["Id"]] = 1

            if (current_locator['$']["Id"] > largest_loc_id) {
                largest_loc_id = current_locator['$']["Id"]
            }

            current_locator["Time"]['$']["Value"] = Number(current_locator["Time"]['$']["Value"]) + current_offset
            final_locators.push(current_locator)
        }
        current_offset += Number(main_ends[i]) + Number(track_offset)
        //console.log(current_offset)
    }
    //console.log(final_locators)

    let taken_tim_ids = { "0": 1 }
    let largest_tim_id = 0
    current_offset = 0;

    //console.log(main_time_signatures)

    for (let i = 0; i < main_time_signatures.length; i++) {
        let signatures = main_time_signatures[i]
        for (let j = 0; j < main_time_signatures[i].length; j++) {
            let current_signature = signatures[j]
            //console.log(current_signature)

            // assigning new ids
            //console.log(taken_tim_ids[current_signature['$']["Id"]])

            while (taken_tim_ids[current_signature['$']["Id"]]) {
                current_signature['$']["Id"] = largest_tim_id + 1
            }

            taken_tim_ids[current_signature['$']["Id"]] = 1

            if (current_signature['$']["Id"] > largest_tim_id) {
                largest_tim_id = Number(current_signature['$']["Id"])
            }

            current_signature['$']["Time"] = Number(current_signature["$"]["Time"]) + current_offset

            if (Number(current_signature['$']["Time"]) < 0) {
                current_signature['$']["Time"] = current_offset
            }

            final_time_signatures.push(current_signature)
        }
        current_offset += Number(main_ends[i]) + Number(track_offset)
        //console.log(current_offset)
    }
    //console.log(final_time_signatures)

    let taken_tra_ids = { "30": 1 }
    let largest_tra_id = 30
    current_offset = 0;

    //console.log(main_time_signatures)

    for (let i = 0; i < main_tracks.length; i++) {
        let track = main_tracks[i]

        //console.log(track)
        if (!track.length) {
            let current_track = track
            while (taken_tra_ids[track['$']["Id"]]) {
                current_track['$']["Id"] = largest_tra_id + 1
            }

            taken_tra_ids[current_track['$']["Id"]] = 1

            if (current_track['$']["Id"] > largest_tra_id) {
                largest_tra_id = Number(current_track['$']["Id"])
            }

            let clips = current_track['DeviceChain']['MainSequencer']['Sample']['ArrangerAutomation']['Events']['AudioClip']

            if (!clips.length) {
                clips['CurrentStart']['$']['Value'] = Number(clips['CurrentStart']['$']['Value']) + current_offset
                clips['$']['Time'] = Number(clips['$']['Time']) + current_offset
                console.log(clips['CurrentStart']['$']['Value'])
                console.log(clips['$']['Time'])

                while (taken_tra_ids[clips['$']["Id"]]) {
                    clips['$']["Id"] = largest_tra_id + 1
                }
    
                taken_tra_ids[clips['$']["Id"]] = 1
    
                if (clips['$']["Id"] > largest_tra_id) {
                    largest_tra_id = Number(clips['$']["Id"])
                }
            }

            for (let c = 0; c < clips.length; c++) {
                clips[c]['CurrentStart']['$']['Value'] = Number(clips[c]['CurrentStart']['$']['Value']) + current_offset
                clips[c]['$']['Time'] = Number(clips[c]['$']['Time']) + current_offset
                console.log(clips[c]['CurrentStart']['$']['Value'])
                console.log(clips[c]['$']['Time'])

                while (taken_tra_ids[clips[c]['$']["Id"]]) {
                    clips[c]['$']["Id"] = largest_tra_id + 1
                }
    
                taken_tra_ids[clips[c]['$']["Id"]] = 1
    
                if (clips[c]['$']["Id"] > largest_tra_id) {
                    largest_tra_id = Number(clips[c]['$']["Id"])
                }
            }

            current_offset += Number(main_ends[i]) + Number(track_offset)
            current_track['DeviceChain']['MainSequencer']['Sample']['ArrangerAutomation']['Events']['AudioClip'] = clips
            final_tracks.push(current_track)
        }

        for (let j = 0; j < main_tracks[i].length; j++) {
            let current_track = track[j]
            console.log(current_track['$']['Id'])
            while (taken_tra_ids[current_track['$']['Id']]) {
                current_track['$']["Id"] = largest_tra_id + 1
            }

            taken_tra_ids[current_track['$']["Id"]] = 1

            if (current_track['$']["Id"] > largest_tra_id) {
                largest_tra_id = Number(current_track['$']["Id"])
            }

            let clips = current_track['DeviceChain']['MainSequencer']['Sample']['ArrangerAutomation']['Events']['AudioClip']

            if (!clips.length) {
                clips['CurrentStart']['$']['Value'] = Number(clips['CurrentStart']['$']['Value']) + current_offset
                clips['$']['Time'] = Number(clips['$']['Time']) + current_offset
                console.log(clips['CurrentStart']['$']['Value'])
                console.log(clips['$']['Time'])

                while (taken_tra_ids[clips['$']["Id"]]) {
                    clips['$']["Id"] = largest_tra_id + 1
                }
    
                taken_tra_ids[clips['$']["Id"]] = 1
    
                if (clips['$']["Id"] > largest_tra_id) {
                    largest_tra_id = Number(clips['$']["Id"])
                }
            }

            for (let c = 0; c < clips.length; c++) {
                clips[c]['CurrentStart']['$']['Value'] = Number(clips[c]['CurrentStart']['$']['Value']) + current_offset
                clips[c]['$']['Time'] = Number(clips[c]['$']['Time']) + current_offset
                console.log(clips[c]['CurrentStart']['$']['Value'])
                console.log(clips[c]['$']['Time'])

                while (taken_tra_ids[clips[c]['$']["Id"]]) {
                    clips[c]['$']["Id"] = largest_tra_id + 1
                }
    
                taken_tra_ids[clips[c]['$']["Id"]] = 1
    
                if (clips[c]['$']["Id"] > largest_tra_id) {
                    largest_tra_id = Number(clips[c]['$']["Id"])
                }
            }

            current_offset += Number(main_ends[i]) + Number(track_offset)
            current_track['DeviceChain']['MainSequencer']['Sample']['ArrangerAutomation']['Events']['AudioClip'] = clips
            final_tracks.push(current_track)
        }
        current_offset += Number(main_ends[i]) + Number(track_offset)
        //console.log(current_offset)
    }
    //console.log(taken_tra_ids)

    // Build XML
    console.log(output_als)
    let data = fs.readFileSync(output_als)
    data = await zlib.unzipSync(data)
    /*
    const obj = convert(data.toString(), {format: "object"})

    const doc = create(xml_obj)
    const xml_ = doc.end({prettyPrint: true})
    console.log(xml_)
    exit()
*/
    let parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: false, explicitCharkey: true })
    let xml_obj = await parser.parseStringPromise(data.toString())

    let params = ["Ableton", "LiveSet", "Locators", "Locators", "Locator"]

    if (!xml_obj["Ableton"]["LiveSet"]["Locators"]) {
        xml_obj["Ableton"]["LiveSet"]["Locators"] = {}
    }

    if (!xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"]) {
        xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"] = {}
    }

    xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"]["Locator"] = final_locators

    xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"] = final_time_signatures

    xml_obj["Ableton"]["LiveSet"]["Tracks"]["AudioTrack"] = xml_obj["Ableton"]["LiveSet"]["Tracks"]["AudioTrack"].concat(final_tracks)
    //console.log()
    //fs.writeFileSync("test.xml", JSON.stringify(xml_obj["Ableton"]["LiveSet"]["Tracks"]["AudioTrack"]))

    xml_obj["Ableton"]["LiveSet"]["NextPointeeId"]['$']['Value'] = 21794

    let xml = new xml2js.Builder({ headless: false, explicitArray: false, mergeAttrs: false, explicitCharkey: true }).buildObject(xml_obj)
    out_data = await zlib.gzipSync(xml)
    //console.log(xml)
    fs.writeFileSync("mix.als", out_data)
}

main()
