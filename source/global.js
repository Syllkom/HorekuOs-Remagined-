// folder: source

// globales
import path from 'path';
import fs from 'fs'

const settinsPath = path.resolve('./settings.json')
const BufferFile = fs.readFileSync(settinsPath)

const datPath = path.resolve('./source/datos.json')
const BufferDat = fs.readFileSync(datPath)

global.readMore = String.fromCharCode(8206).repeat(850);
global.settings = JSON.parse(BufferFile)
global.sabiasQue = JSON.parse(BufferDat)

//textos
global.textBot = 'Powered by @Simple.bot'
global.author = '○ HorekuOs - 𝟸𝟺/𝟽'
global.nmbot = 'HorekuOs'
global.own = 'Syllkom'
global.desc = "HorekuOs | SyllsCode"

// images
global.imghelp = fs.readFileSync('./images/menu.png')