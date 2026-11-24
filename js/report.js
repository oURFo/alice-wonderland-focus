import {el,button} from './ui.js';
import {download,demo} from './storage.js';
const outcomes={independent:'獨立作答',hinted:'提示後完成',assisted:'角色協助',incorrect:'答錯',corrected:'修正後完成',omission:'遺漏',withheld:'略過非目標'};
const columns=['日','關卡','條件','結果','有效挑戰','獨立正確','提示次數','正確作答平均毫秒','作答時間標準差毫秒','有效速度樣本','入場難度','下次難度','難度判定'];
const details=['日','關卡','嘗試','條件','回合','盤或段','目標','結果','提示前錯誤','提示','作答毫秒','耗時毫秒','排除原因','實際參數'];
const eligible=rows=>rows.filter(row=>row.offered!==false && !row.interrupted);
const rtRows=rows=>eligible(rows).filter(row=>row.outcome==='independent'&&!row.timingInterrupted&&Number.isFinite(row.rt));
const mean=rows=>rows.length?Math.round(rows.reduce((sum,row)=>sum+row.rt,0)/rows.length):null;
function deviation(rows){
  if(rows.length<2)return null;
  const average=rows.reduce((sum,row)=>sum+row.rt,0)/rows.length;
  return Math.round(Math.sqrt(rows.reduce((sum,row)=>sum+(row.rt-average)**2,0)/(rows.length-1)));
}
function grid(headers,rows){
  const wrap=el('div',undefined,'table'),table=el('table'),head=el('thead'),body=el('tbody');
  const line=(values,tag)=>{
    const tr=el('tr');
    tr.append(...values.map(value=>el(tag,value??'—')));
    return tr;
  };
  head.append(line(headers,'th'));
  body.append(...rows.map(row=>line(row,'td')));
  table.append(head,body);wrap.append(table);return wrap;
}
function csv(rows){
  return '\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
}
export function report(root,data,stages){
  const summary=[],units=[];
  const display=(result,id)=>stages[result.id].name;
  for(const session of data.history){
    for(const result of session.results){
      const rows=['完成','協助收尾','時間收尾'].includes(result.status)?eligible(result.rows):[];
      const rt=rtRows(rows);
      summary.push([session.day,display(result),result.fixed?'固定':'一般',result.status,rows.length,
        rows.filter(row=>row.outcome==='independent').length,result.rows.reduce((sum,row)=>sum+(row.hints?.length||0),0),
        mean(rt),deviation(rt),rt.length,result.level,result.nextLevel,result.reason]);
    }
    for(const result of [...(session.attempts||[]),...session.results]){
      for(const row of result.rows){
        units.push([session.day,display(result),result.attempt,result.fixed?'固定':'一般',row.unit,row.group??(row.phase===undefined?null:row.phase+1),
          row.target===undefined?null:row.target?'是':'否',outcomes[row.outcome]||'未完成',row.errors,
          row.hints?.map(hint=>hint.reason+' '+hint.at+'ms').join('／'),row.rt,row.duration,
          result.status==='中斷'||result.status==='跳過'?result.status:row.interrupted?'試次中斷':row.timingInterrupted?'計時中斷':row.offered===false?'未開放作答':'',JSON.stringify(result.parameters||{})]);
      }
    }
  }
  root.append(el('h1',data.day===15?'14 日遊玩報告':data.day>=8?'第 1 週遊玩報告':'遊玩紀錄'));
  if(demo)root.append(el('p','模擬資料模式'));
  const action=el('div',undefined,'actions'),prefix=demo?'模擬資料-':'';
  action.append(button('逐關 CSV',()=>download(prefix+'逐關摘要.csv',csv([columns,...summary]),'text/csv;charset=utf-8')),
    button('逐回合 CSV',()=>download(prefix+'逐回合明細.csv',csv([details,...units]),'text/csv;charset=utf-8')),
    button('完整 JSON',()=>download(prefix+'奇境紀錄.json',JSON.stringify({...data,dataset:demo?'simulation':'play'},null,2))),
    button('列印',()=>print()));
  root.append(action);
  if(data.day>=8){
    const versionOf=result=>result.parameters?.version??1;
    const comparable=data.history.flatMap(session=>session.results.filter(result=>result.fixed&&result.status==='完成'));
    const comparisonVersion=Math.max(1,...comparable.map(versionOf));
    if(comparable.some(result=>versionOf(result)!==comparisonVersion))root.append(el('p','固定關卡的介面或出場規則已更新。兩週比較採用相同版本的作答，其他紀錄仍可在明細查看。'));
    const weeks=[1,8].map(start=>{
      const fixed=data.history.filter(session=>session.advanced&&session.day>=start&&session.day<start+7)
        .flatMap(session=>session.results.filter(result=>result.fixed&&result.status==='完成'&&versionOf(result)===comparisonVersion));
      const rows=eligible(fixed.flatMap(result=>result.rows));
      const goals=rows.filter(row=>row.target),distractors=rows.filter(row=>row.target===false),rts=rtRows(rows);
      const enough=fixed.length>=2&&goals.length>=10&&distractors.length>=10;
      const rate=(number,total)=>Math.round(number*100/total)+'%';
      const costs=fixed.flatMap(result=>{
        const first=[0,1].map(phase=>eligible(result.rows).find(row=>row.target&&row.phase===phase));
        return first.every(row=>row&&Number.isFinite(row.rt)&&row.outcome==='independent')?[first[1].rt-first[0].rt]:[];
      });
      return [start===1?'第 1 週':'第 2 週',fixed.length+'／2',goals.length,distractors.length,
        enough?rate(goals.filter(row=>row.outcome==='independent').length,goals.length):'資料不足',
        enough?rate(distractors.filter(row=>row.errors).length,distractors.length):'資料不足',
        enough&&rts.length>=5?mean(rts):'資料不足',rts.length,
        enough&&costs.length>=2?Math.round(costs.reduce((a,b)=>a+b,0)/costs.length):'資料不足'];
    });
    root.append(el('h2','固定條件大閱兵'),grid(['週','有效／原訂','目標','非目標','獨立命中率','誤報率','平均毫秒','速度樣本','切換差值毫秒'],data.day===15?weeks:weeks.slice(0,1)));
  }
  const overview=Object.entries(stages).map(([id,stage])=>{
    const results=data.history.flatMap(day=>day.results).filter(result=>result.id===id&&['完成','協助收尾','時間收尾'].includes(result.status));
    const normal=results.filter(result=>!result.fixed);
    const rows=eligible(normal.flatMap(result=>result.rows));
    const count=outcome=>rows.filter(row=>row.outcome===outcome).length;
    return [stage.name,results.length,count('independent'),count('hinted'),count('assisted'),
      normal.reduce((total,result)=>total+result.rows.reduce((sum,row)=>sum+(row.hints?.length||0),0),0),data.dda[id].level];
  });
  root.append(el('h2','各關足跡'),grid(['關卡','結算次數','一般關獨立正確','一般關提示後完成','一般關角色協助','一般關提示次數','目前難度'],overview));
  root.append(el('h2','逐關摘要'),grid(columns,summary));
  const more=el('details');more.append(el('summary','逐回合明細'),grid(details,units));root.append(more);
}
