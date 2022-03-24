const util = require('util')
const fs = require('fs-extra')
const { exit } = require('process')
const path = require('path')
const zlib = require('zlib')
const xml2js = require('xml2js')
const { create, convert } = require('xmlbuilder2')

// songs to pass in (input_filename, input_filename, input_filename)
let input_als = [path.join(`${__dirname}`, "../", "/test_single.als"), path.join(`${__dirname}`, "../", "/test_multi.als"),]
// check exists
for (let i = 0; i < input_als.length; i++) {
    if (!fs.existsSync(input_als[i])) {
        console.log(`ERROR: Input .als does not exist: ${input_als[0]}`)
        exit(1);
    }
}

// output_filename
let output_als = path.join(`${__dirname}`, "../", "/test_out/template_10.als")
// check exists
if (!fs.existsSync(output_als)) {
    fs.copySync(path.join(`${__dirname}`, "../", "/template_10/"), "test_out/")
    output_als = path.join(`${__dirname}`, "../", "/test_out/template_10.als")
}

// offset between in beats
let track_offset = 20

async function main() {
    let main_locators = []
    let main_time_signatures = []
    let main_ends = []

    // Extract Metadata
    for (let i = 0; i < input_als.length; i++) {
        console.log(input_als[i])

        // decompress als
        let data = fs.readFileSync(input_als[0])
        data = await zlib.unzipSync(data)

        let parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: false , explicitCharkey: true})
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

        //exit()
        
        main_locators.push(locators)
        main_time_signatures.push(time_signatures)
        main_ends.push(end)
    }

    // Concat Metadata
    let current_offset = 0;

    let final_locators = []
    let final_time_signatures = []

    let taken_ids = {"0": 1}
    let largest_id = 0

    for (let i = 0; i < main_locators.length; i++) {
        let locators = main_locators[i]
        for (let j = 0; j < main_locators[i].length; j++) {
            let current_locator = locators[j]
            
            // assigning new ids
            console.log(taken_ids[current_locator['$']["Id"]])

            while (taken_ids[current_locator['$']["Id"]]) {
                current_locator['$']["Id"] = largest_id + 1
            }

           taken_ids[current_locator['$']["Id"]] = 1

            if (current_locator['$']["Id"] > largest_id) {
                largest_id = current_locator['$']["Id"]
            }

            current_locator["Time"]['$']["Value"] = Number(current_locator["Time"]['$']["Value"]) + current_offset
            final_locators.push(current_locator)
        }
        current_offset += Number(main_ends[i]) + Number(track_offset)
        console.log(current_offset)
    }
    console.log(final_locators)

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
    let parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: false , explicitCharkey: true})
    let xml_obj = await parser.parseStringPromise(data.toString())

    let params = ["Ableton", "LiveSet", "Locators", "Locators", "Locator"]

    if (!xml_obj["Ableton"]["LiveSet"]["Locators"]) {
        xml_obj["Ableton"]["LiveSet"]["Locators"] = {}
    }

    if (!xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"]) {
        xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"] = {}
    }

    xml_obj["Ableton"]["LiveSet"]["Locators"]["Locators"]["Locator"] = final_locators

    let xml = new xml2js.Builder({headless: false, explicitArray: false, mergeAttrs: false , explicitCharkey: true}).buildObject(xml_obj)
    out_data = await zlib.gzipSync(xml)
    //console.log(xml)
    fs.writeFileSync("mix.als", out_data)
}

main()
