import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,basename,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {sha256,canonicalize,boardGeometrySha256,hasBottomComponents} from '../lib/dataset.mjs'
import {applySourceCorrection} from '../lib/corrections.mjs'
import {pinnedSources,readGitSnapshot,readPublicLegacyDatasets} from './curation-sources.mjs'
const correctionRegistry=JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../corrections.json'),'utf8'))
const args=process.argv.slice(2)
const readArg=name=>{const index=args.indexOf(name);if(index<0||!args[index+1])throw new Error(`Required: ${name} PATH`);return resolve(args[index+1])}
const root=args.includes('--output-root')?readArg('--output-root'):resolve(dirname(fileURLToPath(import.meta.url)), '..')
const upstream=readArg('--autorouter-root')
const upstreamCommit=pinnedSources.autorouter.commit
const legacyRoot=args.includes('--legacy-root')?readArg('--legacy-root'):undefined
if(legacyRoot&&(args.includes('--dataset01-root')||args.includes('--srj18-root')))throw new Error('Choose public source roots or --legacy-root, not both')
const legacy=legacyRoot?JSON.parse(readFileSync(resolve(legacyRoot,'manifest.json'),'utf8')):{datasets:readPublicLegacyDatasets(readArg('--dataset01-root'),readArg('--srj18-root'))}
const bugReports=readGitSnapshot(upstream,pinnedSources.autorouter)
mkdirSync(resolve(root,'samples'),{recursive:true})
const selected=[],decisions=[],geometry=new Set(),contents=new Set()
function consider(candidate,bytes,raw,srj){
 const common={source:candidate.source,path:candidate.source.path}
 if(![1,2,4].includes(srj.layerCount)){decisions.push({...common,decision:'excluded-unsupported-layer-count'});return false}
 if(hasBottomComponents(srj)){decisions.push({...common,decision:'excluded-bottom-components'});return false}
 const canonicalSrjSha256=sha256(canonicalize(srj)), boardHash=boardGeometrySha256(srj)
 if(contents.has(canonicalSrjSha256)||geometry.has(boardHash)){decisions.push({...common,decision:'excluded-duplicate-board',boardGeometrySha256:boardHash});return false}
 const sample={...candidate,sha256:sha256(bytes),canonicalSrjSha256,boardGeometrySha256:boardHash,
   layerCount:srj.layerCount,connectionCount:srj.connections.length,
   terminalCount:srj.connections.reduce((n,c)=>n+c.pointsToConnect.length,0),obstacleCount:srj.obstacles.length}
 contents.add(canonicalSrjSha256);geometry.add(boardHash);selected.push(sample)
 writeFileSync(resolve(root,sample.file),bytes)
 decisions.push({...common,decision:'selected',sample:sample.name})
 return true
}
for(const dataset of legacy.datasets.filter(d=>d.name==='dataset01'||d.name==='dataset-srj18'))for(const sample of dataset.samples){
 const pinned=pinnedSources[dataset.name]
 if(dataset.repository!==pinned.repository||dataset.commit!==pinned.commit||dataset.samples.length!==pinned.count)throw new Error('Legacy manifest differs from the pinned public source set')
 const bytes=legacyRoot?readFileSync(resolve(legacyRoot,sample.file)):sample.bytes,srj=JSON.parse(bytes)
 if(legacyRoot&&sha256(bytes)!==sample.sha256)throw new Error('Legacy checksum changed')
 const path=dataset.name==='dataset01'?`lib/dataset/${basename(sample.file)}`:`samples/${basename(sample.file)}`
 consider({name:`${dataset.name}-${sample.name}`,file:`samples/${dataset.name}-${sample.name}.json`,category:'legacy-dataset',
 srjJsonPointer:'',source:{repository:dataset.repository,commit:dataset.commit,path,url:`${dataset.repository}/blob/${dataset.commit}/${path}`,
 license:dataset.name==='dataset01'?'MIT':'Apache-2.0 (source board)',dataset:dataset.name}},bytes,srj,srj)
}
if(selected.length!==25)throw new Error(`Expected 25 unique eligible legacy inputs, found ${selected.length}`)
bugReports.sort((a,b)=>(Number(a.path.match(/bugreport(\d+)/)?.[1]??Infinity)-Number(b.path.match(/bugreport(\d+)/)?.[1]??Infinity))||a.path.localeCompare(b.path))
let bugCount=0
for(const {path,bytes} of bugReports){
 let raw;try{raw=JSON.parse(bytes)}catch{continue}
 const srj=raw.simple_route_json
 if(!raw.autorouting_bug_report_id||!srj?.obstacles||!srj?.connections||!srj?.bounds)continue
 const source={repository:'https://github.com/tscircuit/tscircuit-autorouter',commit:upstreamCommit,path,
 url:`https://github.com/tscircuit/tscircuit-autorouter/blob/${upstreamCommit}/${path}`,license:'MIT',
 bugReportId:raw.autorouting_bug_report_id}
 if(/0000-0000/.test(raw.autorouting_bug_report_id)){decisions.push({source,path,decision:'excluded-placeholder-report-id'});continue}
 if(bugCount>=25){decisions.push({source,path,decision:'not-selected-quota-reached'});continue}
 if(consider({name:basename(path,'.json'),file:`samples/${basename(path)}`,category:'bug-report',srjJsonPointer:'/simple_route_json',source},bytes,raw,srj))bugCount++
}
if(selected.length!==50)throw new Error(`Expected 50 actual unique originals, found ${selected.length}`)
// Selection remains based on the original upstream files. Apply reviewed corrections afterward.
for(const {sample:name,...correction} of correctionRegistry.corrections){
 const sample=selected.find(sample=>sample.name===name)
 if(!sample)throw new Error(`Correction references unselected sample: ${name}`)
 const original=readFileSync(resolve(root,sample.file))
 mkdirSync(dirname(resolve(root,correction.originalFile)),{recursive:true})
 writeFileSync(resolve(root,correction.originalFile),original)
 const corrected=applySourceCorrection(original,correction),srj=JSON.parse(corrected).simple_route_json
 writeFileSync(resolve(root,sample.file),corrected)
 Object.assign(sample,{sha256:sha256(corrected),canonicalSrjSha256:sha256(canonicalize(srj)),boardGeometrySha256:boardGeometrySha256(srj),correction})
}
writeFileSync(resolve(root,'corrections.json'),JSON.stringify(correctionRegistry,null,2)+'\n')
const manifest={version:1,name:'dataset-srj34-single-side-four-layer',repository:'https://github.com/tscircuit/dataset-srj34-single-side-four-layer',
 selection:{legacyCount:25,bugReportCount:25,policy:'All unique eligible inputs from pinned dataset01/dataset-srj18; then first 25 unique eligible genuine wrapped bug reports in numeric fixture order. Selection never invokes any router.',
 duplicatePolicy:'Canonical SRJ hash plus conservative board geometry hash: sorted obstacle layout and bounds rounded to 0.00001 mm, ignoring IDs and existing routes.',
 bottomPolicy:'Exclude bottom SMT pads and bottom-only terminals without plated-hole or same-net existing-copper evidence; retain PTH and bottom routing copper.'},samples:selected}
writeFileSync(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
writeFileSync(resolve(root,'selection-audit.json'),JSON.stringify({version:1,decisions},null,2)+'\n')
console.log(JSON.stringify({count:selected.length,bugReports:selected.filter(x=>x.category==='bug-report').map(x=>x.name),excludedDuplicate:decisions.filter(x=>x.decision==='excluded-duplicate-board').map(x=>x.path)},null,2))
