const fs = require('fs-extra')
const { exit } = require('process')
const path = require('path')
const zlib = require('zlib')
const xml2js = require('xml2js')

// use this to put an empty loop locator block
const LOOP_ALS = path.join(`${__dirname}`, "../", "/templates/sample_loop_project/sample_loop.als")

// songs to pass in (input_filename, input_filename, input_filename)
let input_als = [LOOP_ALS, LOOP_ALS, "C:/Users/Chris/Desktop/projects/ableton_set_creator/spirit_of_the_living_god.als", "C:/Users/Chris/Desktop/projects/ableton_set_creator/build_my_life_d.als",]

// check exists
for (let i = 0; i < input_als.length; i++) {
    if (!fs.existsSync(input_als[i])) {
        console.log(`ERROR: Input .als does not exist: ${input_als[0]}`)
        exit(1);
    }
}

// name of exported file
let output_als = "mix.als"

// output template
let output_template = path.join(`${__dirname}`, "../", "/templates/main_template_project/template.als")
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
    }

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
                current_locator['$']["Id"] = largest_loc_id + 1
            }

            taken_loc_ids[current_locator['$']["Id"]] = 1

            if (current_locator['$']["Id"] > largest_loc_id) {
                largest_loc_id = current_locator['$']["Id"]
            }

            current_locator["Time"]['$']["Value"] = Number(current_locator["Time"]['$']["Value"]) + current_offset
            final_locators.push(current_locator)
        }
        current_offset += Number(main_ends[i]) + Number(TRACK_OFFSET)
        //console.log(current_offset)
        final_locators[lowest_index]["Name"]["$"]["Value"] = `START ${path.basename(input_als[i])}: ${final_locators[lowest_index]["Name"]["$"]["Value"]}`
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
        current_offset += Number(main_ends[i]) + Number(TRACK_OFFSET)
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

    xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"].concat(xml_obj["Ableton"]["LiveSet"]["MasterTrack"]["AutomationEnvelopes"]["Envelopes"]["AutomationEnvelope"][0]["Automation"]["Events"]["EnumEvent"], final_time_signatures)

    let xml = new xml2js.Builder({ headless: false, explicitArray: false, mergeAttrs: false, explicitCharkey: true }).buildObject(xml_obj)
    out_data = await zlib.gzipSync(xml)
    //console.log(xml)
    fs.writeFileSync(output_als, out_data)
}

main()
