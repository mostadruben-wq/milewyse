// Wandelt die Sprachdaten für die Vorschau in ein JS-Modul um (manche Hosts liefern .traineddata nicht aus).
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const dir = 'dist-artifact/ocr/';
const b64 = readFileSync(dir + 'deu.traineddata').toString('base64');
writeFileSync(dir + 'deu-traineddata.js', `export default "${b64}";\n`);
rmSync(dir + 'deu.traineddata');
console.log('deu-traineddata.js erzeugt');
