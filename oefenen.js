const view = document.querySelector('#view');
const modes = [
  {key: 'cards', icon: '▤', title: 'Woordkaarten', detail: 'Bekijk de foto en draai de kaart om'},
  {key: 'picture', icon: '◈', title: 'Fotoquiz', detail: 'Kies het woord bij de foto'},
  {key: 'listen', icon: '♪', title: 'Luisterquiz', detail: 'Luister en kies wat je hoort'},
  {key: 'race', icon: '⏱', title: 'Tegen de klok', detail: 'Zoveel mogelijk woorden in 60 seconden'},
  {key: 'memory', icon: '▦', title: 'Memory', detail: 'Zoek foto en woord bij elkaar, alleen of in duo'},
];
const all = groepen.flatMap((group, groupIndex) =>
  group.cards.map((card, index) => ({...card, group: group.name, id: groupIndex + '-' + index})));
const key = 'verkeerswoorden-herhalen-v1';
let review = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  if (Array.isArray(saved)) review = new Set(saved.filter(id => all.some(card => card.id === id)));
} catch {}
let mode = 'cards';
let round;
let playing;
function stopAudio() {
  if (playing) playing.pause();
  playing = null;
}
let timer;
function stopTimer() {
  clearInterval(timer);
  timer = null;
}
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const label = card => card.lines[0];
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function watchCount() {
  document.querySelector('#count').textContent = review.size;
}
function mark(card, correct) {
  if (correct) review.delete(card.id);
  else review.add(card.id);
  try { localStorage.setItem(key, JSON.stringify([...review])); } catch {}
  watchCount();
}
function headingFocus() {
  const heading = view.querySelector('h1');
  heading.tabIndex = -1;
  heading.focus({preventScroll: true});
}
function goHome(focus = true) {
  stopAudio();
  stopTimer();
  round = null;
  view.innerHTML = `
    <section class="hero"><div class="hero-copy"><p class="kicker">Verkeerstheorie</p>
      <h1>Oefen je<br><span>verkeerswoorden</span></h1>
      <p>Kijk, luister en herhaal de woorden uit je lessen.</p></div><div class="road" aria-hidden="true"></div></section>
    <section class="section"><h2>1. Hoe wil je oefenen?</h2><div class="modes">
      ${modes.map(item => `<button class="tile" data-mode="${item.key}" aria-pressed="${mode === item.key}"><span class="icon" aria-hidden="true">${item.icon}</span><span><strong>${item.title}</strong><small>${item.detail}</small></span></button>`).join('')}
    </div></section>
    <section class="section"><div class="section-head"><h2>2. Kies een les</h2><button class="primary" id="mix">Mix van 10 woorden</button></div><div class="lessons">
    ${groepen.map((group,i) => `<button class="tile" data-lesson="${i}"><span><strong>${group.name}</strong><small>${group.cards.length} kaarten</small></span><span class="arrow" aria-hidden="true">→</span></button>`).join('')}
    </div></section>`;
  view.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
    mode = button.dataset.mode;
    view.querySelectorAll('[data-mode]').forEach(tile => tile.setAttribute('aria-pressed', tile === button));
  });
  view.querySelectorAll('[data-lesson]').forEach(button => button.onclick = () => {
    const group = groepen[Number(button.dataset.lesson)].name;
    start(all.filter(card => card.group === group), group);
  });
  view.querySelector('#mix').onclick = () => mode === 'race' || mode === 'memory'
    ? start(all, 'Alle lessen') : start(shuffle(all).slice(0,10), 'Mix van 10 woorden');
  if (focus) { window.scrollTo(0,0); headingFocus(); }
}
function start(cards, title, exerciseMode = mode) {
  stopAudio();
  stopTimer();
  round = {cards: shuffle(cards), title, mode: exerciseMode, index: 0, correct: 0, missed: []};
  if (exerciseMode === 'race' && cards.length) { startRace(); return; }
  if (exerciseMode === 'memory' && cards.length) { memorySetup(); return; }
  draw();
  window.scrollTo(0,0);
  headingFocus();
}
function exerciseHeader() {
  return `<div class="topline"><button class="back" id="back">← Naar de lessen</button><span>${escape(round.title)}</span></div>`;
}
function images(card, reveal) {
  return `<div class="images ${card.imgs.length > 1 ? 'multi' : ''}">${card.imgs.map((file,i) =>
    `<img src="beelden/${file}" alt="${escape(reveal ? label(card) : 'Oefenafbeelding ' + (i + 1))}">`).join('')}</div>`;
}
function lines(card) {
  return `<div class="lines"><strong>${escape(label(card))}</strong>${card.lines.slice(1).map(line => `<p>${escape(line)}</p>`).join('')}</div>`;
}
function sayWord(card) {
  stopAudio();
  const audio = new Audio('spraak/' + card.id + '.wav');
  playing = audio;
  audio.preservesPitch = true;
  audio.playbackRate = 0.85; // iets trager voorlezen
  return audio;
}
function speak(card) {
  const status = document.querySelector('#audio-status');
  status.textContent = '';
  const audio = sayWord(card);
  audio.play().catch(() => {
    if (playing === audio) status.textContent = 'De audio kon niet worden afgespeeld. Probeer het opnieuw.';
  });
}
function answer(card, correct) {
  mark(card, correct);
  if (correct) round.correct++;
  else round.missed.push(card);
}
function next() {
  stopAudio();
  round.index++;
  draw();
  headingFocus();
}
function optionsFor(card) {
  const others = [...new Set(shuffle(all.filter(item => item.group === card.group)).map(label))]
    .filter(word => word.toLowerCase() !== label(card).toLowerCase()).slice(0,3);
  return shuffle([label(card), ...others]);
}
function draw() {
  const card = round.cards[round.index];
  if (!card) { finish(); return; }
  const isCards = round.mode === 'cards';
  const isListen = round.mode === 'listen';
  view.innerHTML = `<section class="exercise">${exerciseHeader()}
    <div class="topline"><strong>${modes.find(item => item.key === round.mode).title}</strong><span>Kaart ${round.index + 1} van ${round.cards.length}</span></div>
    <progress aria-label="Voortgang" max="${round.cards.length}" value="${round.index}"></progress>
    <div class="panel"><h1>${isCards ? 'Ken je dit woord?' : isListen ? 'Welk woord hoor je?' : 'Welk woord past bij de foto?'}</h1>
    ${isListen ? '' : images(card,false)}<div id="prompt"></div>
    <p id="audio-status" class="muted" role="status"></p></div></section>`;
  view.querySelector('#back').onclick = () => goHome();
  const prompt = view.querySelector('#prompt');
  if (isCards) {
    prompt.innerHTML = '<button class="primary" id="flip">Toon het woord</button>';
    prompt.querySelector('#flip').onclick = () => {
      view.querySelector('.images').outerHTML = images(card,true);
      prompt.innerHTML = lines(card) + `<div class="actions"><button class="secondary" id="audio">♪ Luister</button>
        <button class="secondary" id="again">Nog oefenen</button><button class="primary" id="known">Ik ken het</button></div>`;
      prompt.querySelector('#audio').onclick = () => speak(card);
      prompt.querySelector('#again').onclick = () => { answer(card,false); next(); };
      prompt.querySelector('#known').onclick = () => { answer(card,true); next(); };
      prompt.querySelector('#audio').focus();
    };
    return;
  }
  const options = optionsFor(card);
  prompt.innerHTML = `${isListen ? '<button class="primary listen" id="audio">♪ Luister naar het woord</button>' : ''}
    <div class="choices">${options.map((option,i) => `<button class="choice" data-choice="${i}">${escape(option)}</button>`).join('')}</div>
    <div class="feedback" role="status"></div><div id="continue"></div>`;
  if (isListen) prompt.querySelector('#audio').onclick = () => speak(card);
  const choices = [...prompt.querySelectorAll('.choice')];
  choices.forEach(button => button.onclick = () => {
    const correct = options[Number(button.dataset.choice)] === label(card);
    answer(card,correct);
    choices.forEach((choice,i) => {
      choice.disabled = true;
      if (options[i] === label(card)) choice.classList.add('correct');
      else if (choice === button) choice.classList.add('wrong');
    });
    prompt.querySelector('.feedback').textContent = correct ? 'Goed gedaan!' : 'Het juiste antwoord is: ' + label(card);
    const followup = prompt.querySelector('#continue');
    followup.innerHTML = (isListen ? images(card,true) : '') + lines(card) +
      `<div class="actions"><button class="primary" id="next">${round.index + 1 === round.cards.length ? 'Bekijk je resultaat' : 'Volgende kaart →'}</button></div>`;
    followup.querySelector('#next').onclick = next;
    followup.querySelector('#next').focus();
  });
}
function finish() {
  const {cards, correct, missed, title, mode: exerciseMode} = round;
  view.innerHTML = `<section class="exercise">${exerciseHeader()}<div class="panel"><h1>${cards.length ? 'Ronde klaar!' : 'Alles geoefend?'}</h1>
    <p>${cards.length ? `Je ${exerciseMode === 'cards' ? 'kende' : 'had'} ${correct} van de ${cards.length} ${exerciseMode === 'cards' ? 'woorden' : 'antwoorden juist'}.` : 'Je hebt nog geen woorden om te herhalen.'}</p>
    <div class="actions">${cards.length ? '<button class="secondary" id="repeat">Zelfde ronde opnieuw</button>' : ''}
    ${missed.length ? '<button class="primary" id="missed">Oefen de moeilijke woorden</button>' : ''}</div></div></section>`;
  view.querySelector('#back').onclick = () => goHome();
  if (cards.length) view.querySelector('#repeat').onclick = () => start(cards,title,exerciseMode);
  if (missed.length) view.querySelector('#missed').onclick = () => start(missed,'Te herhalen',exerciseMode);
}
// ---- Tegen de klok ----
const raceSeconds = 60;
const penalty = 3;
const recordKey = 'verkeerswoorden-records-v1';
function records() {
  try { return JSON.parse(localStorage.getItem(recordKey) || '{}') || {}; } catch { return {}; }
}
const ting = new Audio('geluiden/ting.mp3');
ting.preload = 'auto';
const buzzer = new Audio('geluiden/buzzer.mp3');
buzzer.preload = 'auto';
function playSound(source) {
  const sound = source.cloneNode();
  sound.play().catch(() => {});
}
const multiplier = streak => streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
function startRace() {
  Object.assign(round, {score: 0, streak: 0, bestStreak: 0, wrong: 0, locked: false,
    end: Date.now() + raceSeconds * 1000, record: records()[round.title] || 0});
  drawRace();
  timer = setInterval(tick, 100);
}
function tick() {
  const left = Math.max(0, round.end - Date.now());
  const clock = view.querySelector('#clock');
  if (clock) {
    clock.textContent = Math.ceil(left / 1000);
    clock.closest('.stat').classList.toggle('hurry', left <= 10000);
    view.querySelector('#timebar').style.width = (left / (raceSeconds * 10)) + '%';
  }
  if (!left) finishRace();
}
function raceCard() {
  if (round.index && round.index % round.cards.length === 0) {
    const last = round.cards[round.cards.length - 1];
    round.cards = shuffle(round.cards);
    if (round.cards.length > 1 && round.cards[0] === last) round.cards.push(round.cards.shift());
  }
  return round.cards[round.index % round.cards.length];
}
function drawRace() {
  const card = raceCard();
  const options = optionsFor(card);
  const x = multiplier(round.streak);
  view.innerHTML = `<section class="exercise race">${exerciseHeader()}
    <div class="scoreboard">
      <div class="stat"><small>Tijd</small><strong id="clock">${Math.ceil((round.end - Date.now()) / 1000)}</strong></div>
      <div class="stat"><small>Punten</small><strong id="score">${round.score}</strong></div>
      <div class="stat ${x > 1 ? 'hot' : ''}"><small>Reeks</small><strong>${round.streak}${x > 1 ? ` <em>×${x}</em>` : ''}</strong></div>
      <div class="stat"><small>Record</small><strong>${round.record}</strong></div>
    </div>
    <div class="timebar"><span id="timebar"></span></div>
    <div class="panel"><h1>Welk woord past bij de foto?</h1>${images(card,false)}
    <div class="choices">${options.map((option,i) => `<button class="choice" data-choice="${i}"><kbd>${i + 1}</kbd> ${escape(option)}</button>`).join('')}</div>
    <div class="feedback" role="status"></div></div></section>`;
  view.querySelector('#back').onclick = () => goHome();
  tick();
  const choices = [...view.querySelectorAll('.choice')];
  choices.forEach(button => button.onclick = () => {
    if (round.locked) return;
    round.locked = true;
    const correct = options[Number(button.dataset.choice)] === label(card);
    mark(card, correct);
    choices.forEach((choice,i) => {
      choice.disabled = true;
      if (options[i] === label(card)) choice.classList.add('correct');
      else if (choice === button) choice.classList.add('wrong');
    });
    const feedback = view.querySelector('.feedback');
    if (correct) {
      round.streak++;
      round.bestStreak = Math.max(round.bestStreak, round.streak);
      const points = 10 * multiplier(round.streak);
      round.score += points;
      round.correct++;
      playSound(ting);
      view.querySelector('#score').textContent = round.score;
      feedback.textContent = '+' + points + (multiplier(round.streak) > 1 ? ' 🔥' : '');
    } else {
      round.streak = 0;
      round.wrong++;
      playSound(buzzer);
      round.end -= penalty * 1000;
      if (!round.missed.includes(card)) round.missed.push(card);
      feedback.textContent = `−${penalty} seconden · het was: ${label(card)}`;
    }
    setTimeout(() => {
      if (!timer) return;
      round.index++;
      round.locked = false;
      drawRace();
    }, correct ? 450 : 1300);
  });
}
function finishRace() {
  stopTimer();
  const {score, correct, wrong, bestStreak, missed, title, cards, record} = round;
  const isRecord = score > record;
  if (isRecord) {
    const saved = records();
    saved[title] = score;
    try { localStorage.setItem(recordKey, JSON.stringify(saved)); } catch {}
  }
  view.innerHTML = `<section class="exercise race">${exerciseHeader()}<div class="panel result">
    <p class="kicker">${isRecord ? 'Nieuw record!' : 'De tijd is om'}</p>
    <h1>${score} punten</h1>
    <p>${isRecord && record ? `Je vorige record was ${record}.` : !isRecord ? `Je record voor ${escape(title)} is ${record}.` : 'Dat is je eerste record voor deze les.'}</p>
    <div class="scoreboard"><div class="stat"><small>Juist</small><strong>${correct}</strong></div>
      <div class="stat"><small>Fout</small><strong>${wrong}</strong></div>
      <div class="stat"><small>Langste reeks</small><strong>${bestStreak}</strong></div></div>
    <div class="actions">${missed.length ? '<button class="secondary" id="missed">Bekijk de foute woorden</button>' : ''}
      <button class="primary" id="repeat">Nog eens spelen</button></div></div></section>`;
  view.querySelector('#back').onclick = () => goHome();
  view.querySelector('#repeat').onclick = () => start(cards, title, 'race');
  if (missed.length) view.querySelector('#missed').onclick = () => start(missed, 'Foute woorden', 'cards');
  headingFocus();
}
// ---- Memory ----
let memoryCount = 14;
let memoryDuo = false;
const teams = ['Rood', 'Blauw'];
function uniqueCards(cards) {
  const seen = new Set();
  return cards.filter(card => {
    const word = label(card).toLowerCase();
    if (seen.has(word)) return false;
    seen.add(word);
    return true;
  });
}
function memorySizes(cards) {
  const max = Math.min(28, uniqueCards(cards).length * 2);
  const sizes = [14, 20, 28].filter(size => size <= max);
  if (max >= 4 && !sizes.includes(max)) sizes.push(max);
  return sizes.sort((a,b) => a - b);
}
function memorySetup() {
  const sizes = memorySizes(round.cards);
  if (!sizes.includes(memoryCount)) memoryCount = sizes.filter(size => size <= memoryCount).pop() || sizes[0];
  view.innerHTML = `<section class="exercise">${exerciseHeader()}<div class="panel"><h1>Memory</h1>
    <p class="muted">Zoek bij elke foto het juiste woord. Elke kaart die je omdraait, wordt voorgelezen.</p>
    <h2 class="setup-label">Hoeveel kaarten?</h2>
    <div class="chips" role="group" aria-label="Aantal kaarten">${sizes.map(size =>
      `<button class="chip" data-size="${size}" aria-pressed="${size === memoryCount}">${size}</button>`).join('')}</div>
    ${sizes[sizes.length - 1] < 28 ? `<p class="muted small">Deze les heeft genoeg woorden voor maximaal ${sizes[sizes.length - 1]} kaarten.</p>` : ''}
    <h2 class="setup-label">Wie speelt?</h2>
    <div class="chips" role="group" aria-label="Spelers">
      <button class="chip" data-duo="false" aria-pressed="${!memoryDuo}">Alleen</button>
      <button class="chip" data-duo="true" aria-pressed="${memoryDuo}"><span class="dot red"></span>Rood tegen <span class="dot blue"></span>Blauw</button></div>
    <div class="actions"><button class="primary" id="play">Start memory</button></div></div></section>`;
  view.querySelector('#back').onclick = () => goHome();
  view.querySelectorAll('[data-size]').forEach(button => button.onclick = () => {
    memoryCount = Number(button.dataset.size);
    view.querySelectorAll('[data-size]').forEach(chip => chip.setAttribute('aria-pressed', chip === button));
  });
  view.querySelectorAll('[data-duo]').forEach(button => button.onclick = () => {
    memoryDuo = button.dataset.duo === 'true';
    view.querySelectorAll('[data-duo]').forEach(chip => chip.setAttribute('aria-pressed', chip === button));
  });
  view.querySelector('#play').onclick = startMemory;
}
function memoryColumns(count) {
  let best = 4;
  for (let cols = 4; cols <= 7; cols++) {
    const empty = (cols - count % cols) % cols;
    const bestEmpty = (best - count % best) % best;
    if (empty <= bestEmpty) best = cols;
  }
  return best;
}
function startMemory() {
  stopAudio();
  const chosen = shuffle(uniqueCards(round.cards)).slice(0, memoryCount / 2);
  const deck = shuffle(chosen.flatMap(card => [{card, kind: 'img'}, {card, kind: 'word'}]));
  Object.assign(round, {memory: {deck, open: [], gone: new Set(), locked: false, turns: 0,
    team: 0, scores: [0, 0], duo: memoryDuo, pairs: chosen.length, found: 0}});
  drawMemory();
  headingFocus();
}
function memoryFace(item) {
  if (item.kind === 'word') return `<span class="mword ${label(item.card).length > 34 ? 'long' : ''}">${escape(label(item.card))}</span>`;
  return `<span class="mimgs ${item.card.imgs.length > 1 ? 'multi' : ''}">${item.card.imgs.map(file =>
    `<img src="beelden/${file}" alt="">`).join('')}</span>`;
}
function memoryStatus() {
  const m = round.memory;
  if (m.duo) return teams.map((team,i) => `<div class="stat team-${i ? 'blue' : 'red'} ${m.team === i ? 'active' : ''}">
    <small>Team ${team}${m.team === i ? ' · aan de beurt' : ''}</small><strong>${m.scores[i]}</strong></div>`).join('');
  return `<div class="stat"><small>Paren</small><strong>${m.found} / ${m.pairs}</strong></div>
    <div class="stat"><small>Beurten</small><strong>${m.turns}</strong></div>`;
}
function drawMemory() {
  const m = round.memory;
  view.innerHTML = `<section class="exercise memory">${exerciseHeader()}
    <h1 class="sr-only">Memory</h1>
    <div class="scoreboard ${m.duo ? 'duo' : 'solo'}" id="mstatus">${memoryStatus()}</div>
    <p class="sr-only" id="mlive" role="status"></p>
    <div class="mgrid" style="--cols:${memoryColumns(m.deck.length)}">${m.deck.map((item,i) =>
      `<button class="mcard" data-card="${i}" aria-label="Kaart ${i + 1}, dicht"><span class="inner">
        <span class="face face-back" aria-hidden="true">↗</span><span class="face face-front">${memoryFace(item)}</span></span></button>`).join('')}</div>
    </section>`;
  view.querySelector('#back').onclick = () => goHome();
  view.querySelectorAll('.mcard').forEach(button => button.onclick = () => flipMemory(Number(button.dataset.card)));
}
function updateMemoryStatus(message) {
  view.querySelector('#mstatus').innerHTML = memoryStatus();
  if (message) view.querySelector('#mlive').textContent = message;
}
function whenDone(audio, min, max) {
  return new Promise(resolve => {
    const startTime = Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(resolve, Math.max(0, min - (Date.now() - startTime)));
    };
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    setTimeout(finish, max);
  });
}
function flipMemory(index) {
  const game = round;
  const m = game.memory;
  if (m.locked || m.open.includes(index) || m.gone.has(index)) return;
  const item = m.deck[index];
  const button = view.querySelector(`[data-card="${index}"]`);
  button.classList.add('open');
  button.setAttribute('aria-label', `Kaart ${index + 1}, ${item.kind === 'word' ? 'woord' : 'foto'}: ${label(item.card)}`);
  const audio = sayWord(item.card);
  audio.play().catch(() => {});
  m.open.push(index);
  if (m.open.length < 2) return;
  m.locked = true;
  m.turns++;
  const [first, second] = m.open.map(i => view.querySelector(`[data-card="${i}"]`));
  const match = m.deck[m.open[0]].card === m.deck[m.open[1]].card;
  if (match) {
    m.found++;
    m.scores[m.team]++;
    if (m.duo) [first, second].forEach(card => card.classList.add(m.team ? 'won-blue' : 'won-red'));
    whenDone(audio, 700, 2500).then(() => {
      if (round !== game) return;
      playSound(ting);
      m.open.forEach(i => m.gone.add(i));
      [first, second].forEach(card => { card.classList.add('gone'); card.disabled = true; });
      m.open = [];
      m.locked = false;
      updateMemoryStatus(`Juist: ${label(item.card)}.${m.duo ? ` Team ${teams[m.team]} mag nog eens.` : ''}`);
      if (m.found === m.pairs) setTimeout(() => { if (round === game) finishMemory(); }, 700);
    });
  } else {
    updateMemoryStatus();
    whenDone(audio, 1400, 3000).then(() => {
      if (round !== game) return;
      [first, second].forEach((card,i) => {
        card.classList.remove('open');
        card.setAttribute('aria-label', `Kaart ${m.open[i] + 1}, dicht`);
      });
      m.open = [];
      if (m.duo) m.team = 1 - m.team;
      m.locked = false;
      updateMemoryStatus(m.duo ? `Geen paar. Team ${teams[m.team]} is aan de beurt.` : 'Geen paar.');
    });
  }
}
function finishMemory() {
  stopAudio();
  const {title, memory: m} = round;
  let heading, text = '';
  if (m.duo) {
    const [red, blue] = m.scores;
    heading = red === blue ? 'Gelijkspel!' : `Team ${red > blue ? 'Rood' : 'Blauw'} wint!`;
    text = `Rood vond ${red} ${red === 1 ? 'paar' : 'paren'}, Blauw vond ${blue} ${blue === 1 ? 'paar' : 'paren'}.`;
  } else {
    const recordName = `memory:${title}:${m.deck.length}`;
    const saved = records();
    const record = saved[recordName];
    heading = `Klaar in ${m.turns} beurten`;
    if (!record || m.turns < record) {
      saved[recordName] = m.turns;
      try { localStorage.setItem(recordKey, JSON.stringify(saved)); } catch {}
      text = record ? `Nieuw record! Je vorige record was ${record} beurten.` : `Dat is je eerste record met ${m.deck.length} kaarten.`;
    } else {
      text = `Je record met ${m.deck.length} kaarten is ${record} beurten.`;
    }
  }
  view.innerHTML = `<section class="exercise">${exerciseHeader()}<div class="panel result ${m.duo ? (m.scores[0] > m.scores[1] ? 'win-red' : m.scores[1] > m.scores[0] ? 'win-blue' : '') : ''}">
    <p class="kicker">Alle paren gevonden</p><h1>${heading}</h1><p>${text}</p>
    <div class="actions"><button class="secondary" id="settings">Andere instellingen</button>
      <button class="primary" id="repeat">Nog eens spelen</button></div></div></section>`;
  view.querySelector('#back').onclick = () => goHome();
  view.querySelector('#settings').onclick = memorySetup;
  view.querySelector('#repeat').onclick = startMemory;
  headingFocus();
}
document.addEventListener('keydown', event => {
  if (!timer || round?.mode !== 'race' || round.locked) return;
  const button = view.querySelectorAll('.choice')[Number(event.key) - 1];
  if (button) button.click();
});
document.querySelector('#home').onclick = () => goHome();
document.querySelector('#review').onclick = () => start(all.filter(card => review.has(card.id)),'Te herhalen');
watchCount();
goHome(false);
