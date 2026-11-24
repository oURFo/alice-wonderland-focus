export function sample(days,queues) {
  return Array.from({length:days},(_,index)=>{
    const day=index+1;
    const date=new Date();
    date.setDate(date.getDate()-days+day);
    const started=[date.getFullYear(),date.getMonth()+1,date.getDate()].map(value=>String(value).padStart(2,'0')).join('-');
    const results=queues[index].map(id=>{
      const fixed=id==='poker'&&[3,6,10,13].includes(day);
      const rows=Array.from({length:fixed?24:id==='cups'?3:id==='puzzle'?2:12},(_,unit)=>{
        const phase=fixed?Math.floor(unit/12):0;
        const target=id==='poker'?unit%2===0:undefined;
        const miss=(day+unit)%7===0;
        const outcome=target===false?(miss?'incorrect':'withheld'):miss?(target?'omission':'hinted'):'independent';
        return {unit:unit+1,phase,target,outcome,acted:['independent','incorrect','hinted'].includes(outcome),
          errors:Number(outcome==='incorrect'),rt:outcome==='independent'&&id!=='puzzle'?540+unit*7-day*8:undefined,
          hints:outcome==='hinted'?[{reason:'等待過久',at:8000}]:[]};
      });
      return {id,status:'完成',parameters:{version:2},attempt:'sample-'+day+'-'+id,fixed,level:1,nextLevel:1,reason:'模擬資料',rows};
    });
    return {day,started,closed:started,energy:['滿格','一半','快沒電'][index%3],time:'下午',queue:queues[index],results,attempts:[],spent:128000,advanced:true};
  });
}
