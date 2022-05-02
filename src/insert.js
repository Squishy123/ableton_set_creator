const fs = require('fs-extra')
const { exit } = require('process')
const path = require('path')
const zlib = require('zlib')
const xml2js = require('xml2js')

// use this to put an empty loop locator block
const LOOP_ALS = path.join(`${__dirname}`, "../", "/templates/sample_loop_project/sample_loop.als")

// songs to pass in (input_filename, input_filename, input_filename)
//let input_als = [LOOP_ALS, LOOP_ALS, "C:/Users/Chris/Desktop/projects/ableton_set_creator/spirit_of_the_living_god.als", "C:/Users/Chris/Desktop/projects/ableton_set_creator/build_my_life_d.als",]
let input_als = [
    "C:/Users/Chris/Desktop/worship_multitracks/Spirit Of The Living God-D-67bpm Project/Spirit Of The Living God-D-67bpm.als",
    "C:/Users/Chris/Desktop/worship_multitracks/Build My Life - D - 72bpm Project/Build My Life - D - 72bpm.als"
    //"C:/Users/chris/Desktop/3-27-2022/3-27-2022 Project/3-27-2022.als"
    //"C:/Users/Chris/Desktop/projects/ableton_set_creator/CS-Holy-Is-The-Lord-D-84.00bpm.als",
    //"C:/Users/Chris/Desktop/projects/ableton_set_creator/CS-King-of-Kings-D.als",
    //"C:/Users/Chris/Desktop/projects/ableton_set_creator/Come-to-the-altar-D+.als",
    //"C:/Users/Chris/Desktop/projects/ableton_set_creator/CS-Desert-Song-D-110.00bpm.als"
]

// check exists
for (let i = 0; i < input_als.length; i++) {
    if (!fs.existsSync(input_als[i])) {
        console.log(`ERROR: Input .als does not exist: ${input_als[0]}`)
        //exit(1);
    }
}

// name of exported file
let output_als = "mix.als"

// output template
let output_template = path.join(`${__dirname}`, "../", "template.als")//"/templates/main_template_project/template.als")

//input_als.push(output_template)

// check exists
/*
if (!fs.existsSync(output_template)) {
    fs.copySync(path.join(`${__dirname}`, "../", "/template_10/"), "test_out/")
    output_template = path.join(`${__dirname}`, "../", "/test_out/template_10.als")
}*/

// offset between tracks in beats
let TRACK_OFFSET = 100

// offset from the start of the file
const START_OFFSET = 4 * 10

async function main() {
    let main_locators = []
    let main_time_signatures = []
    let main_ends = []
    let main_tracks = []
    let main_clips = {}
    let taken_tracks = 0
    let taken_tracks_id = {"1": 1, "": 1}
    let taken_clips = 0
    let main_midi_tracks = []
    let main_return_tracks = []

    // Extract Start Locators from Template
    let t_data = fs.readFileSync(output_template)
    t_data = await zlib.unzipSync(t_data)

    let t_parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: false, explicitCharkey: true })
    let t_xml_obj = await t_parser.parseStringPromise(t_data.toString())

    let t_locators = t_xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"]["Locator"].map(a => {
        return Number(a['Time']['$']['Value'])
    }).sort((a, b) => a - b)

    //console.log(t_locators)

    // Extract Metadata
    for (let i = 0; i < input_als.length; i++) {
        console.log(input_als[i])
        console.log(taken_tracks)

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
        let time_signatures = []


        let envs = xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"]

        for (let i = 0; i < envs.length; i++) {
            if (envs[i]["Automation"]["Events"]["EnumEvent"])
                time_signatures = time_signatures.concat(envs[i]["Automation"]["Events"]["EnumEvent"])
        }

        // end loc
        let tracks = xml_obj["Ableton"]["LiveSet"]["Tracks"]["AudioTrack"]
        let midi_tracks = xml_obj["Ableton"]["LiveSet"]["Tracks"]["MidiTrack"]
        let return_tracks = xml_obj["Ableton"]["LiveSet"]["Tracks"]["ReturnTrack"]

        let end = 0

        try {
            // if multiple
            /* WIP TRACK END
            if (tracks.length) {
                tracks.forEach(t => {
                    let t_end = t["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]["CurrentEnd"]['$']["Value"]
                    if (t_end > end) {
                        end = t_end
                    }
                });
            } else {
                end = tracks["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]["CurrentEnd"]['$']["Value"]
            } */
            //For now we use end locator
            let last_index = 0
            let last_value = -100
            for (let j = 0; j < locators.length; j++) {
                if (Number(locators[j]["Time"]["$"]["Value"]) > last_value) {
                    last_value = Number(locators[j]["Time"]["$"]["Value"])
                    last_index = j
                }
            }

            end = last_value
        } catch (e) {
            //console.error(e)
        }

        //console.log(locators)
        //console.log(time_signatures)
        //console.log(end)

        main_locators.push(locators)
        main_time_signatures.push(time_signatures)
        main_ends.push(end)

        console.log(taken_tracks_id)
        
        
        if (return_tracks) {
            if (return_tracks.length) {
                for (let t = 0; t < return_tracks.length; t++) {
                    if (!return_tracks[t]["$"]["Id"]) {
                        return_tracks[t]["$"]["Id"] = 0
                    }
                    if (taken_tracks_id[return_tracks[t]["$"]["Id"]]) {
                        return_tracks[t]["$"]["Id"] = Math.max(Number(...Object.keys(taken_tracks_id))) + 1
                        taken_tracks_id[return_tracks[t]["$"]["Id"]] = 1
                        //taken_tracks++
                    } else {
                        taken_tracks_id[return_tracks[t]["$"]["Id"]] = 1
                    }
                }
                main_return_tracks = main_return_tracks.concat(return_tracks)
            } else {
                if (!return_tracks["$"]["Id"]) {
                    return_tracks["$"]["Id"] = 0
                }
                if (taken_tracks_id[return_tracks["$"]["Id"]]) {
                    return_tracks["$"]["Id"] = Math.max(Number(...Object.keys(taken_tracks_id))) + 1
                    taken_tracks_id[return_tracks["$"]["Id"]] = 1
                    
                    //taken_tracks++
                } else {
                    taken_tracks_id[return_tracks["$"]["Id"]] = 1
                }
                main_return_tracks.push(return_tracks)
            }
        }
        
        if (midi_tracks) {
            if (midi_tracks.length) {
                for (let t = 0; t < midi_tracks.length; t++) {
                    if (taken_tracks_id[midi_tracks[t]["$"]["Id"]]) {
                        midi_tracks[t]["$"]["Id"] = Math.max(Number(...Object.keys(taken_tracks_id))) + 1
                        taken_tracks_id[midi_tracks[t]["$"]["Id"]] = 1
                        //taken_tracks++
                    } else {
                        taken_tracks_id[midi_tracks[t]["$"]["Id"]] = 1
                    }
                    main_midi_tracks.push(midi_tracks[t])
                }
            } else {
                console.log("NO")
                if (taken_tracks_id[midi_tracks["$"]["Id"]]) {
                    midi_tracks["$"]["Id"] = Math.max(Number(...Object.keys(taken_tracks_id))) + 1
                    ///taken_tracks = Math.max(Number(...Object.keys(taken_tracks_id))) 
                    taken_tracks_id[midi_tracks["$"]["Id"]] = 1
                } else {
                    taken_tracks_id[midi_tracks["$"]["Id"]] = 1
                }
            }
            main_midi_tracks.push(midi_tracks)
        }
        
       // consle.log(tracks

        
        if (tracks) {
            if (tracks.length) {
                for (let t = 0; t < tracks.length; t++) {
                    console.log(tracks[t]["$"]["Id"])
                    if (taken_tracks_id[tracks[t]["$"]["Id"]]) {
                        tracks[t]["$"]["Id"] = Math.max(Number(...Object.keys(taken_tracks_id))) + 1
                        taken_tracks_id[tracks[t]["$"]["Id"]] = 1
                        //taken_tracks++
                    } else {
                        taken_tracks_id[tracks[t]["$"]["Id"]] = 1
                    }

                    let clips = tracks[t]["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]
                    if (clips) {
                        if (clips.length) {
                            for (let c = 0; c < clips.length; c++) {
                                tracks[t]["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"][c]["$"]["Time"] += t_locators[i]
                                tracks[t]["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"][c]["$"]["Id"] = taken_clips
                                taken_clips++
                            }
                        } else {
                            tracks[t]["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]["$"]["Time"] += t_locators[i]
                            tracks[t]["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]["$"]["Id"] = taken_clips
                            taken_clips++
                        }
                    }
                }
                main_tracks = main_tracks.concat(tracks)
            } else {
                console.log(tracks["$"]["Id"])
                if (taken_tracks_id[tracks["$"]["Id"]]) {
                    tracks["$"]["Id"] = Math.max(Number(...Object.keys(taken_tracks_id))) + 1
                    taken_tracks_id[tracks["$"]["Id"]] = 1
                    //taken_tracks++
                } else {
                    taken_tracks_id[tracks["$"]["Id"]] = 1
                }

                let clips = tracks["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]
                if (clips) {
                    if (clips.length) {
                        for (let c = 0; c < clips.length; c++) {
                            tracks["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"][c]["$"]["Time"] += t_locators[i]
                            tracks["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"][c]["$"]["Id"] = taken_clips
                            taken_clips++
                        }
                    } else {
                        tracks["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]["$"]["Time"] += t_locators[i]
                        tracks["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"]["$"]["Id"] = taken_clips
                        taken_clips++
                    }
                }
                main_tracks.push(tracks)
            }
        }
    }
    //console.log(taken_tracks_id)

    //console.log(main_clips)
    // exit()

    // Concat Metadata

    let final_locators = []
    let final_time_signatures = []

    let taken_loc_ids = { "0": 1 }
    let largest_loc_id = 0
    let current_offset = START_OFFSET;

    for (let i = 0; i < main_locators.length; i++) {
        let locators = main_locators[i]
        if (!locators)
            continue

        let lowest_val = 100000
        let lowest_index = 0

        for (let j = 0; j < main_locators[i].length; j++) {
            let current_locator = locators[j]

            if (Number(current_locator["Time"]["$"]["Value"]) < lowest_val) {
                lowest_index = final_locators.length
                lowest_val = Number(current_locator["Time"]["$"]["Value"])
            }

            // assigning new ids
            //console.log(taken_loc_ids[current_locator['$']["Id"]])

            while (taken_loc_ids[current_locator['$']["Id"]]) {
                current_locator['$']["Id"] = Number(largest_loc_id) + 1
            }

            taken_loc_ids[current_locator['$']["Id"]] = 1

            if (current_locator['$']["Id"] > largest_loc_id) {
                largest_loc_id = current_locator['$']["Id"]
            }

            current_locator["Time"]['$']["Value"] = Number(current_locator["Time"]['$']["Value"]) + t_locators[i] //current_offset
            final_locators.push(current_locator)
        }
        //current_offset += t_locators[i]//Number(main_ends[i]) + Number(TRACK_OFFSET)
        //console.log(current_offset)
        final_locators[lowest_index]["Name"]["$"]["Value"] = `START ${path.basename(input_als[i])}: ${final_locators[lowest_index]["Name"]["$"]["Value"]}`
    }
    //console.log(final_locators)

    let taken_tim_ids = { "0": 1 }
    let largest_tim_id = 0
    current_offset = 0;

    //console.log(main_time_signatures)

    //main_time_signatures[2] = null

    for (let i = 0; i < main_time_signatures.length; i++) {
        let signatures = main_time_signatures[i]

        if (!signatures)
            continue
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

            current_signature['$']["Time"] = Number(current_signature["$"]["Time"]) + t_locators[i]//current_offset

            if (Number(current_signature['$']["Time"]) < 0) {
                current_signature['$']["Time"] = t_locators[i]
            }

            final_time_signatures.push(current_signature)
        }
        //current_offset += Number(main_ends[i]) + Number(TRACK_OFFSET)
        //console.log(current_offset)
    }
    //console.log(final_time_signatures)

    // Build XML
    console.log(output_template)
    let data = fs.readFileSync(output_template)
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
        xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"] = {}
    }

    //console.log(xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"])

    xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"]["Locator"] = final_locators

    if (!xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]) {
        xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"] = {
            "AutomationEnvelope": [
                {
                    "Automation": {
                        "Events": {
                            "EnumEvent": []
                        }
                    }
                }
            ]
        }
    }
    /*
    for (let m = 0; m < main_tracks.length; m++) {
        let name = main_tracks[m]["Name"]["EffectiveName"]["$"]["Value"]
        //console.log(main_clips[name])
        // console.log(main_tracks[m]["$"]["Id"])
 
        //main_tracks[m]["DeviceChain"]["MainSequencer"]["Sample"]["ArrangerAutomation"]["Events"]["AudioClip"] = main_clips[name]
    }*/

    //console.log(main_tracks)

    xml_obj["Ableton"]["LiveSet"]["Tracks"]["AudioTrack"] = main_tracks
    xml_obj["Ableton"]["LiveSet"]["Tracks"]["MidiTrack"] = main_midi_tracks.slice(0,2)

    console.log(main_midi_tracks)
    xml_obj["Ableton"]["LiveSet"]["Tracks"]["ReturnTrack"] = main_return_tracks.slice(0,2)
    //main_tracks = xml_obj["Ableton"]["LiveSet"]["Tracks"]["AudioTrack"] 

    //    fs.writeFileSync("test.json", JSON.stringify({ "Root": main_tracks }))
    if (xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"].length) {
        let arr = xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"]

        for (let a = 0; a < arr.length; a++) {
            arr[a]["$"]["Id"] = largest_tim_id + 1
            largest_tim_id++
        }

        xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"] = arr.concat(final_time_signatures)
    } else {
        let arr = xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"]
        arr["$"]["Id"] = largest_tim_id + 1
        largest_tim_id++
        xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"] = [arr].concat(final_time_signatures)

    }
    
    xml_obj["Ableton"]["LiveSet"]["NextPointeeId"]["$"]["Value"] = 30000

    let xml = new xml2js.Builder({ headless: false, explicitArray: false, mergeAttrs: false, explicitCharkey: true }).buildObject(xml_obj)
    out_data = await zlib.gzipSync(xml)
    //console.log(xml)  
    fs.writeFileSync(output_als, out_data)
}

main()
