// Streaming progress also lets the local server detect a cancelled request and
// stop its exhaustive Node subprocess instead of leaving it running indefinitely.
export function createLocalClient(){
 const select=document.getElementById('solver-time-limit');
 if(select){select.insertAdjacentHTML('afterbegin','<option value="0">No time limit</option>');select.value='0';}
 const note=document.getElementById('optimizer-search-note');
 if(note)note.textContent='Local unlimited search: runs until the search stages finish or you cancel. Bounded shortlists and calibration remain heuristic; global optimality is not proven. Completion percentage is unknown.';
 return async(action,payload,{signal,onProgress}={})=>{
  const response=await fetch(`/api/${action}`,{method:'POST',headers:{'Content-Type':'application/json',...(action==='optimize'?{'X-Progress-Stream':'1'}:{})},body:JSON.stringify(payload),signal});
  if(!response.headers.get('Content-Type')?.includes('application/x-ndjson')){
   const body=await response.json();if(!response.ok)throw Error(body.error??'Request failed');return body;
  }
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result;
  const consume=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.error)throw Error(event.error);if(event.progress)onProgress?.(event.progress);if(event.result)result=event.result;};
  try{
   for(;;){const {done,value}=await reader.read();if(done){buffer+=decoder.decode();break;}buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);}}
   consume(buffer);if(!result)throw Error('Search ended before exhaustive screening and calibration completed.');return result;
  }finally{reader.releaseLock();}
 };
}
