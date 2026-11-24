export function adjust(id, state, rows, fixed) {
  const eligible = rows.filter(row => !row.interrupted && row.offered !== false);
  const count = eligible.length;
  const goals = eligible.filter(row => row.target === true);
  const distractors = eligible.filter(row => row.target === false);
  const next = {...state};
  const minimum = {puzzle:state.level===1?6:9,cups:3,poker:10,shooting:3,potion:2}[id];
  if (fixed || count < minimum || (id === 'poker' && (goals.length < 5 || distractors.length < 5))) {
    return {...next, reason:fixed ? '固定條件' : '樣本不足'};
  }
  const independent = eligible.filter(row => row.outcome === 'independent').length / count;
  const errors = eligible.filter(row => row.errors > 0).length;
  const hits = goals.filter(row => row.outcome === 'independent').length / (goals.length || 1);
  const falseAlarms = distractors.filter(row => row.errors > 0).length / (distractors.length || 1);
  const participated = eligible.some(row => row.acted);
  const lower = id === 'poker' ? participated && (hits <= .5 || falseAlarms >= .5) : errors >= 2 && errors / count >= .5;
  const raise = id === 'poker' ? hits >= .8 && falseAlarms <= .2 : independent >= .8;
  if (lower) return {level:Math.max(1,state.level-1), streak:0, reason:'達到降階門檻'};
  if (!raise) return {...next, streak:0, reason:'維持'};
  if (state.level === 3) return {...next, streak:0, reason:'已達最高等級'};
  if (state.streak >= 1) return {level:state.level+1, streak:0, reason:'連續兩次達標'};
  return {...next, streak:1, reason:'首次達標'};
}
