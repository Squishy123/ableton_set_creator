# ABLETON SET CREATOR

## REQUIREMENTS 
- Node.JS

## INSTALLATION
```
git clone https://github.com/Squishy123/ableton_set_creator.git
cd ableton_set_creator
npm i 
```

## USAGE
### Configuration
*all in src/index.js
- input_als is the string paths of .als files with locators and time signatures you want to add to the set (in order).
- Use the LOOP_ALS const to have an empty block
- output_als (default=mix.als) is the string path of the exported .als file
- TRACK_OFFSET (default=100) is the offset between set tracks in beats
- START_OFFSET (default=400) is the offset from the start of the file

### To Run the Script
```
npm start
```

