# Infoboxer

## Project set-up
* `git clone ...`
* `npm install`

## Data structure
```
data/
   raw/
   pre-processed/
      included/
      excluded/
   parsed/
```

## Commands

### Run Pre-processor
```npm run pre-processor <file-num>```
* `file-num` - number of the file to be processed from `/data/raw/` directory
* the files must be downloaded from [wikipedia dump](https://dumps.wikimedia.org/enwiki/latest/)

### Run Parser
```npm run parser <file-num>```
* `file-num` - number of the file to be processed from `/data/pre-processed/included/` directory
