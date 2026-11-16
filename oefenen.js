const view = document.querySelector('#view');
const modes = [
  {key: 'cards', icon: '▤', title: 'Woordkaarten', detail: 'Bekijk de foto en draai de kaart om'},
  {key: 'picture', icon: '◈', title: 'Fotoquiz', detail: 'Kies het woord bij de foto'},
  {key: 'listen', icon: '♪', title: 'Luisterquiz', detail: 'Luister en kies wat je hoort'},
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
  view.querySelector('#mix').onclick = () => start(shuffle(all).slice(0,10), 'Mix van 10 woorden');
  if (focus) { window.scrollTo(0,0); headingFocus(); }
}
function start(cards, title, exerciseMode = mode) {
  stopAudio();
  round = {cards: shuffle(cards), title, mode: exerciseMode, index: 0, correct: 0, missed: []};
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
function speak(card) {
  const status = document.querySelector('#audio-status');
  status.textContent = '';
  stopAudio();
  const audio = new Audio('spraak/' + card.id + '.wav');
  playing = audio;
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
  const others = [...new Set(shuffle(all.filter(item => item.group === card.group)).map(label))]
    .filter(word => word.toLowerCase() !== label(card).toLowerCase()).slice(0,3);
  const options = shuffle([label(card), ...others]);
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
document.querySelector('#home').onclick = () => goHome();
document.querySelector('#review').onclick = () => start(all.filter(card => review.has(card.id)),'Te herhalen');
watchCount();
goHome(false);
