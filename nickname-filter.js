'use strict';
/**
 * Event-only nickname filtering. This is deliberately a *small*, locally editable
 * block list, not a classifier and not a complete hate-speech detection system.
 * Do not expose the list or the matching reason in public/API responses.
 */
const fs = require('node:fs');
const path = require('node:path');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname,'nickname-rules.json'),'utf8'));
const MAX_LENGTH = 18;
const MIN_LENGTH = 2;
// Minimal lookalike map, useful against basic copy/paste bypasses. Not exhaustive.
const LOOKALIKES = {
  '\u0430':'a', '\u0435':'e', '\u0456':'i', '\u043e':'o', '\u0441':'c', '\u0440':'p',
  '\u0445':'x', '\u0443':'y', '\u043d':'h', '\u043a':'k', '\u043c':'m', '\u0442':'t',
  '\u0432':'b', '\u0455':'s', '\u03b1':'a', '\u03b5':'e', '\u03b9':'i', '\u03bf':'o',
  '\u03c1':'p', '\u03c7':'x', '\u03ba':'k'
};
const LEET={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','@':'a','$':'s','!':'i','+':'t'};
function normalize(input) {
  return String(input ?? '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g,'')
    .split('').map(c=>LOOKALIKES[c]||LEET[c]||c).join('')
    .replace(/[^a-z]/g,'');
}
const blocked = Object.entries(rules)
  .filter(([key,value])=>!key.startsWith('_') && key!=='reserved_exact_names' && Array.isArray(value))
  .flatMap(([_,terms])=>terms.map(normalize).filter(Boolean));
const reserved = new Set((rules.reserved_exact_names||[]).map(normalize));
function check(rawName) {
  // Normalize the *display* name too, removing hidden control/bidi characters.
  const name=String(rawName??'').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g,'')
    .trim().replace(/\s+/g,' ').slice(0,MAX_LENGTH);
  if(name.length<MIN_LENGTH)return {ok:false,message:'Choose a nickname of at least 2 characters'};
  const compact=normalize(name);
  if(compact.length<2)return {ok:false,message:'Please use at least two letters in your nickname'};
  if(reserved.has(compact))return {ok:false,message:'Nickname not available. Please choose another.'};
  if(blocked.some(word=>compact.includes(word)))return {ok:false,message:'Nickname not allowed. Please choose another.'};
  return {ok:true,name};
}
module.exports={check,normalize};
